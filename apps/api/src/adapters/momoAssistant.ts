import { nanoid } from "nanoid";
import type {
  MomoLocale,
  MomoMessage,
  MomoReply,
  PlantAnalysisResult,
  Recommendation,
  TelemetrySample,
  WeatherInterpretation,
} from "@verdia/contracts";
import type { MomoAssistantPort } from "../domain/ports.js";

/**
 * momo.ai assistant — template replies grounded in evidence only.
 * Never fabricates sensor values, diagnoses, or recommendations.
 * Supports English + Tamil simple farmer-friendly wording.
 */
export class MomoTemplateAssistant implements MomoAssistantPort {
  reply(input: {
    question: string;
    locale: MomoLocale;
    sensors?: TelemetrySample["sensors"] | null;
    validatedEvidence?: string[];
    analysis?: PlantAnalysisResult | null;
    recommendation?: Recommendation | null;
    weather?: WeatherInterpretation | null;
  }): MomoReply {
    const locale = input.locale === "ta" ? "ta" : "en";
    const q = input.question.toLowerCase();
    const evidenceIds: string[] = [];
    const evidenceLines: string[] = [...(input.validatedEvidence ?? [])];

    if (input.sensors) {
      const s = input.sensors;
      if (s.soilMoisturePct != null)
        evidenceLines.push(`moisture=${s.soilMoisturePct}%`);
      if (s.temperatureC != null) evidenceLines.push(`temp=${s.temperatureC}°C`);
      if (s.humidityPct != null) evidenceLines.push(`humidity=${s.humidityPct}%`);
      if (s.soilPh != null) evidenceLines.push(`pH=${s.soilPh}`);
      if (s.waterLevelPct != null) evidenceLines.push(`tank=${s.waterLevelPct}%`);
    }
    if (input.analysis && !input.analysis.rejected) {
      evidenceIds.push(input.analysis.id);
      evidenceLines.push(
        input.analysis.isMock
          ? `analysis_mock:${input.analysis.diagnosis}`
          : `analysis:${input.analysis.diagnosis}`,
      );
    }
    if (input.recommendation) {
      evidenceIds.push(input.recommendation.id);
      evidenceLines.push(...input.recommendation.evidence);
    }
    if (input.weather) {
      evidenceLines.push(
        `weather:${input.weather.weather.conditionLabel}@${input.weather.weather.temperatureC}°C`,
      );
    }

    const topic = detectTopic(q);
    let content: string;
    let confidence: number | null;
    let uncertain = false;

    if (evidenceLines.length === 0) {
      content = locale === "ta" ? TA.noEvidence : EN.noEvidence;
      confidence = 0;
      uncertain = true;
    } else if (topic === "sensors") {
      content = formatSensors(locale, input.sensors, evidenceLines);
      confidence = 0.85;
    } else if (topic === "analysis") {
      ({ content, confidence, uncertain } = formatAnalysis(locale, input.analysis));
    } else if (topic === "recommendation") {
      ({ content, confidence, uncertain } = formatRecommendation(
        locale,
        input.recommendation,
      ));
    } else if (topic === "weather") {
      ({ content, confidence, uncertain } = formatWeather(locale, input.weather));
    } else {
      content = formatGeneral(locale, evidenceLines, input.recommendation);
      confidence = input.recommendation?.confidence ?? 0.5;
      if (!input.recommendation && !input.analysis) uncertain = true;
    }

    const message: MomoMessage = {
      id: `momo_${nanoid(10)}`,
      role: "assistant",
      content,
      locale,
      confidence,
      evidenceIds,
      createdAt: new Date().toISOString(),
      uncertain: uncertain || undefined,
    };

    return {
      message,
      availability: { status: "available" },
    };
  }
}

function detectTopic(
  q: string,
): "sensors" | "analysis" | "recommendation" | "weather" | "general" {
  if (/moisture|sensor|soil|ph|tank|humidity|வெப்ப|ஈர|மண்|சென்சார்/.test(q))
    return "sensors";
  if (/analy|camera|leaf|disease|vision|நோய்|இலை|கேமரா/.test(q))
    return "analysis";
  if (/recommend|advice|what should|irrigat|பரிந்து|நீர்ப்பாசன/.test(q))
    return "recommendation";
  if (/weather|rain|wind|வெயில்|மழை|காற்று/.test(q)) return "weather";
  return "general";
}

const EN = {
  noEvidence:
    "I do not have verified sensor, weather, or analysis evidence yet. Connect a device or capture a clear plant photo, then ask again. I will not guess.",
  analysisUnavailable:
    "No verified plant analysis is available. I will not invent a diagnosis.",
  analysisMock:
    "The camera result is demo/mock-labeled and must not be treated as a real field diagnosis.",
  analysisRejected: "The image was rejected by quality checks before analysis.",
  recUnavailable:
    "No evidence-based recommendation is ready. Collect validated sensors or a live analysis first.",
  weatherUnavailable: "No live weather snapshot is loaded for this location yet.",
};

const TA = {
  noEvidence:
    "இப்போது உறுதியான சென்சார்/வானிலை/பகுப்பாய்வு தரவு இல்லை. சாதனத்தை இணைக்கவும் அல்லது தெளிவான இலைப் படம் எடுக்கவும். ஊகித்து சொல்ல மாட்டேன்.",
  analysisUnavailable:
    "உறுதியான தாவரப் பகுப்பாய்வு இல்லை. நோயை ஊகித்து சொல்ல மாட்டேன்.",
  analysisMock:
    "இது டெமோ/மாதிரி கேமரா முடிவு — உண்மையான வயல் நோயறிதலாக எடுக்க வேண்டாம்.",
  analysisRejected: "படம் தரச் சரிபார்ப்பில் நிராகரிக்கப்பட்டது.",
  recUnavailable:
    "ஆதார அடிப்படையிலான பரிந்துரை தயாராக இல்லை. முதலில் சென்சார் அல்லது நேரடி பகுப்பாய்வு தேவை.",
  weatherUnavailable: "இந்த இடத்திற்கு நேரடி வானிலை தரவு இன்னும் இல்லை.",
};

function formatSensors(
  locale: MomoLocale,
  sensors: TelemetrySample["sensors"] | null | undefined,
  evidenceLines: string[],
): string {
  if (!sensors) {
    return locale === "ta"
      ? `கிடைத்த ஆதாரம்: ${evidenceLines.join(", ")}`
      : `Evidence on hand: ${evidenceLines.join(", ")}`;
  }
  const parts: string[] = [];
  if (sensors.soilMoisturePct != null)
    parts.push(
      locale === "ta"
        ? `மண் ஈரம் ${sensors.soilMoisturePct}%`
        : `soil moisture ${sensors.soilMoisturePct}%`,
    );
  if (sensors.temperatureC != null)
    parts.push(
      locale === "ta"
        ? `வெப்பம் ${sensors.temperatureC}°C`
        : `temperature ${sensors.temperatureC}°C`,
    );
  if (sensors.humidityPct != null)
    parts.push(
      locale === "ta"
        ? `காற்று ஈரம் ${sensors.humidityPct}%`
        : `humidity ${sensors.humidityPct}%RH`,
    );
  if (sensors.waterLevelPct != null)
    parts.push(
      locale === "ta"
        ? `தண்ணீர் தொட்டி ${sensors.waterLevelPct}%`
        : `water tank ${sensors.waterLevelPct}%`,
    );
  if (sensors.soilPh != null)
    parts.push(locale === "ta" ? `pH ${sensors.soilPh}` : `soil pH ${sensors.soilPh}`);

  if (parts.length === 0) {
    return locale === "ta"
      ? "சென்சார் மதிப்புகள் இல்லை அல்லது செல்லாதவை."
      : "No valid sensor values are present.";
  }
  return locale === "ta"
    ? `உங்கள் சென்சார் ஆதாரம்: ${parts.join("; ")}. நம்பிக்கை உயர்வு — அளவீடுகளின் அடிப்படையில் மட்டும்.`
    : `Your sensor evidence: ${parts.join("; ")}. Confidence is based only on these readings.`;
}

function formatAnalysis(
  locale: MomoLocale,
  analysis: PlantAnalysisResult | null | undefined,
): { content: string; confidence: number | null; uncertain: boolean } {
  if (!analysis) {
    return {
      content: locale === "ta" ? TA.analysisUnavailable : EN.analysisUnavailable,
      confidence: 0,
      uncertain: true,
    };
  }
  if (analysis.rejected) {
    return {
      content: `${locale === "ta" ? TA.analysisRejected : EN.analysisRejected} (${analysis.rejectionReason ?? "quality"})`,
      confidence: 0,
      uncertain: true,
    };
  }
  if (analysis.isMock || analysis.provider === "mock-verdia") {
    return {
      content: `${locale === "ta" ? TA.analysisMock : EN.analysisMock} Label: ${analysis.diagnosis}`,
      confidence: Math.min(0.4, analysis.confidence),
      uncertain: true,
    };
  }
  if (analysis.provider === "unavailable") {
    return {
      content: analysis.diagnosis,
      confidence: 0,
      uncertain: true,
    };
  }
  const tips = analysis.careTips.slice(0, 2).join(" ");
  return {
    content:
      locale === "ta"
        ? `பகுப்பாய்வு: ${analysis.diagnosis}. நம்பிக்கை ${(analysis.confidence * 100).toFixed(0)}%. ${tips}`
        : `Analysis: ${analysis.diagnosis}. Confidence ${(analysis.confidence * 100).toFixed(0)}%. ${tips}`,
    confidence: analysis.confidence,
    uncertain: analysis.confidence < 0.5,
  };
}

function formatRecommendation(
  locale: MomoLocale,
  rec: Recommendation | null | undefined,
): { content: string; confidence: number | null; uncertain: boolean } {
  if (!rec || rec.unavailableReason) {
    return {
      content: locale === "ta" ? TA.recUnavailable : EN.recUnavailable,
      confidence: 0,
      uncertain: true,
    };
  }
  return {
    content:
      locale === "ta"
        ? `பரிந்துரை: ${rec.primary} ஆதாரம்: ${rec.evidence.join("; ")}. நம்பிக்கை ${(rec.confidence * 100).toFixed(0)}%.`
        : `Recommendation: ${rec.primary} Evidence: ${rec.evidence.join("; ")}. Confidence ${(rec.confidence * 100).toFixed(0)}%.`,
    confidence: rec.confidence,
    uncertain: rec.confidence < 0.5,
  };
}

function formatWeather(
  locale: MomoLocale,
  weather: WeatherInterpretation | null | undefined,
): { content: string; confidence: number | null; uncertain: boolean } {
  if (!weather) {
    return {
      content: locale === "ta" ? TA.weatherUnavailable : EN.weatherUnavailable,
      confidence: 0,
      uncertain: true,
    };
  }
  const w = weather.weather;
  const impact = weather.impacts[0];
  return {
    content:
      locale === "ta"
        ? `வானிலை: ${w.conditionLabel}, ${w.temperatureC}°C. ${impact?.suggestedAction ?? ""}`
        : `Weather: ${w.conditionLabel}, ${w.temperatureC}°C, humidity ${w.humidityPct}%RH. ${impact?.suggestedAction ?? ""}`,
    confidence: 0.8,
    uncertain: false,
  };
}

function formatGeneral(
  locale: MomoLocale,
  evidenceLines: string[],
  rec: Recommendation | null | undefined,
): string {
  if (rec && !rec.unavailableReason) {
    return locale === "ta"
      ? `ஆதாரம் உள்ளது. முக்கிய பரிந்துரை: ${rec.primary}`
      : `I have evidence. Primary advice: ${rec.primary}`;
  }
  return locale === "ta"
    ? `கிடைத்த ஆதாரம்: ${evidenceLines.slice(0, 6).join("; ")}. குறிப்பிட்ட கேள்வி கேளுங்கள் (சென்சார்/பகுப்பாய்வு/பரிந்துரை).`
    : `Evidence on hand: ${evidenceLines.slice(0, 6).join("; ")}. Ask specifically about sensors, analysis, or recommendations.`;
}
