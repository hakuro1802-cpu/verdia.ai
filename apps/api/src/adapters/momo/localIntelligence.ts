import { nanoid } from "nanoid";
import type {
  MomoLocale,
  MomoMessage,
  MomoReply,
  PlantAnalysisResult,
  Recommendation,
  WeatherInterpretation,
} from "@verdia/contracts";
import type { MomoEvidenceContext } from "./types.js";

type Topic =
  | "greeting"
  | "identity"
  | "sensors"
  | "analysis"
  | "recommendation"
  | "weather"
  | "irrigation"
  | "verdia"
  | "esp32"
  | "agriculture"
  | "science"
  | "tech"
  | "productivity"
  | "clarify"
  | "general";

/**
 * Local Master Intelligence — warm, voice-ready, evidence-honest.
 * Handles VERDIA explanations and educational guidance without fabricating live farm data.
 */
export function answerLocally(input: MomoEvidenceContext): MomoReply {
  const locale = input.locale === "ta" ? "ta" : "en";
  const q = input.question.trim();
  const topic = detectTopic(q, input.history);
  const evidenceIds = collectEvidenceIds(input);

  let content: string;
  let confidence: number | null;
  let uncertain = false;

  switch (topic) {
    case "greeting":
      ({ content, confidence } = greet(locale, input));
      break;
    case "identity":
      ({ content, confidence } = aboutMomo(locale));
      break;
    case "sensors":
      ({ content, confidence, uncertain } = explainSensors(locale, input));
      break;
    case "analysis":
      ({ content, confidence, uncertain } = explainAnalysis(locale, input.analysis));
      break;
    case "recommendation":
    case "irrigation":
      ({ content, confidence, uncertain } = explainRecommendation(
        locale,
        input.recommendation,
        input,
        topic === "irrigation",
      ));
      break;
    case "weather":
      ({ content, confidence, uncertain } = explainWeather(locale, input.weather));
      break;
    case "verdia":
      ({ content, confidence } = explainVerdia(locale));
      break;
    case "esp32":
      ({ content, confidence } = explainEsp32(locale));
      break;
    case "agriculture":
      ({ content, confidence, uncertain } = explainAgriculture(locale, q, input));
      break;
    case "science":
      ({ content, confidence, uncertain } = explainScience(locale, q));
      break;
    case "tech":
      ({ content, confidence } = explainTech(locale, q));
      break;
    case "productivity":
      ({ content, confidence } = explainProductivity(locale, q));
      break;
    case "clarify":
      ({ content, confidence, uncertain } = clarify(locale, q));
      break;
    default:
      ({ content, confidence, uncertain } = generalHelp(locale, q, input));
  }

  // Continuity: lightly acknowledge prior topic if present
  const prior = input.history?.filter((h) => h.role === "user").at(-1);
  if (prior && topic !== "greeting" && locale === "en" && Math.random() < 0) {
    // disabled random — keep deterministic
  }

  const message: MomoMessage = {
    id: `momo_${nanoid(10)}`,
    role: "assistant",
    content: speakable(content),
    locale,
    confidence,
    evidenceIds,
    createdAt: new Date().toISOString(),
    uncertain: uncertain || undefined,
  };

  return { message, availability: { status: "available" } };
}

function speakable(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

function detectTopic(
  q: string,
  history?: Array<{ role: string; content: string }>,
): Topic {
  const t = q.toLowerCase();
  if (/^(hi|hello|hey|vanakkam|வணக்கம்|good (morning|afternoon|evening))\b/.test(t))
    return "greeting";
  if (/who are you|what are you|your name|momo\.?ai|நீ யார்|உன் பெயர்/.test(t))
    return "identity";
  if (/verdia|platform|dashboard|farm management|what can you do|features/.test(t))
    return "verdia";
  if (/esp32|firmware|heartbeat|rssi|gpio|mqtt|iot device|pair(ing)?/.test(t))
    return "esp32";
  if (/moisture|sensor|soil|ph|tank|humidity|temperature reading|வெப்ப|ஈர|மண்|சென்சார்/.test(t))
    return "sensors";
  if (/analy|camera|leaf|disease|vision|pest|deficiency|நோய்|இலை|கேமரா/.test(t))
    return "analysis";
  if (/irrigat|water(?:ing)?(?:\s|$|\?|!)|pump|நீர்ப்பாசன|பம்ப்|should i water|do i (need to )?water/.test(t))
    return "irrigation";
  if (/recommend|advice|what should|next step|பரிந்து/.test(t))
    return "recommendation";
  if (/weather|rain|wind|climate|forecast|வெயில்|மழை|காற்று|வானிலை/.test(t))
    return "weather";
  if (
    /crop|plant|fertiliz|compost|mulch|germination|photosynthesis|chlorosis|blight|fungus|வேளாண்|பயிர்|உரம்/.test(
      t,
    )
  )
    return "agriculture";
  if (
    /physics|chemistry|biology|math|molecule|cell|force|equation|atom|இயல்|வேதிய|உயிர்|கணித/.test(
      t,
    )
  )
    return "science";
  if (
    /program|javascript|python|react|api|algorithm|ai model|machine learning|code|குறியீடு/.test(
      t,
    )
  )
    return "tech";
  if (/productiv|focus|habit|time management|plan my|study tip/.test(t))
    return "productivity";
  if (t.length < 3 || /^(ok|yes|no|thanks|thank you|நன்றி)$/.test(t)) {
    if (history?.length) return "clarify";
  }
  return "general";
}

function greet(locale: MomoLocale, input: MomoEvidenceContext) {
  const hasData = Boolean(input.validatedEvidence?.length || input.weather);
  if (locale === "ta") {
    return {
      content: hasData
        ? "வணக்கம். நான் momo.ai. உங்கள் பண்ணைத் தரவு கையில் உள்ளது. சென்சார், வானிலை, அல்லது பயிர் பராமரிப்பு பற்றி கேளுங்கள்."
        : "வணக்கம். நான் momo.ai — VERDIA.AI இன் நம்பகமான துணை. இன்று எப்படி உதவட்டும்?",
      confidence: 0.95,
    };
  }
  return {
    content: hasData
      ? "Hi. I'm momo.ai. I can see verified farm context on hand, so ask me about your sensors, weather, or what to do next. I'll keep it clear and honest."
      : "Hi. I'm momo.ai, your companion in VERDIA.AI. I can help with farming, science, tech, and everyday questions. What would you like to understand today?",
    confidence: 0.95,
  };
}

function aboutMomo(locale: MomoLocale) {
  if (locale === "ta") {
    return {
      content:
        "நான் momo.ai. VERDIA.AI இன் மைய அறிவு துணை. நான் உங்களுக்கு வேளாண்மை, அறிவியல், தொழில்நுட்பம் மற்றும் பொது அறிவைப் புரிய வைக்க உதவுகிறேன். பண்ணை தரவை ஊகித்து சொல்ல மாட்டேன் — உறுதியான ஆதாரம் இருக்கும்போது மட்டுமே விளக்குவேன்.",
      confidence: 0.95,
    };
  }
  return {
    content:
      "I'm momo.ai — the central intelligence companion of VERDIA.AI. I'm here to help you understand agriculture, science, technology, and everyday questions with clarity and care. When we talk about your farm, I stick to verified sensors, weather, and camera results. If something isn't available yet, I'll say so and still help you think through the next step.",
    confidence: 0.95,
  };
}

function explainSensors(
  locale: MomoLocale,
  input: MomoEvidenceContext,
): { content: string; confidence: number | null; uncertain: boolean } {
  const s = input.sensors;
  if (!s || !input.validatedEvidence?.length) {
    return {
      content:
        locale === "ta"
          ? "இப்போது உறுதியான சென்சார் அளவீடு இல்லை. ESP32 இணைத்து தரவு வரட்டும். அதுவரை பொதுவான மண் ஈர மேலாண்மை பற்றி கேட்கலாம் — ஆனால் உங்கள் வயலின் எண்ணை ஊகிக்க மாட்டேன்."
          : "I don't have a verified sensor reading yet. Once your ESP32 is online and posting telemetry, I can interpret moisture, temperature, humidity, pH, and tank level with you. Until then I can still teach the concepts — I just won't invent your field numbers.",
      confidence: 0,
      uncertain: true,
    };
  }

  const parts: string[] = [];
  if (s.soilMoisturePct != null) {
    parts.push(
      locale === "ta"
        ? `மண் ஈரம் ${s.soilMoisturePct}%. பல காய்கறிகளுக்கு சுமார் 35%க்கு கீழ் நீர்ப்பாசனம் பரிசீலிக்கலாம்; 70%க்கு மேல் வடிகால் கவனிக்கவும்.`
        : `Soil moisture is ${s.soilMoisturePct}%. For many vegetables, values under about 35% often mean it's time to consider irrigation, while readings above about 70% suggest holding water and watching drainage.`,
    );
  }
  if (s.temperatureC != null) {
    parts.push(
      locale === "ta"
        ? `காற்று வெப்பம் ${s.temperatureC}°C.`
        : `Air temperature is ${s.temperatureC}°C.`,
    );
    if (s.temperatureC >= 35) {
      parts.push(
        locale === "ta"
          ? "இது வெப்ப அழுத்த அபாய வரம்பு. காலை அல்லது மாலை நீர்ப்பாசனம் பாதுகாப்பானது."
          : "That's in a heat-stress risk range for many crops, so cooler watering windows are usually safer.",
      );
    }
  }
  if (s.humidityPct != null) {
    parts.push(
      locale === "ta"
        ? `காற்று ஈரம் ${s.humidityPct}%RH.`
        : `Humidity is ${s.humidityPct}%RH.`,
    );
    if (s.humidityPct >= 85) {
      parts.push(
        locale === "ta"
          ? "உயர் ஈரம் பூஞ்சை அழுத்தத்தை உயர்த்தலாம் — இலைகளை உன்னிப்பாகப் பாருங்கள்."
          : "High humidity can raise fungal pressure, so it's worth scouting leaves more closely.",
      );
    }
  }
  if (s.waterLevelPct != null) {
    parts.push(
      locale === "ta"
        ? `தண்ணீர் தொட்டி ${s.waterLevelPct}%.`
        : `The water tank is at ${s.waterLevelPct}%.`,
    );
    if (s.waterLevelPct < 15) {
      parts.push(
        locale === "ta"
          ? "தொட்டி குறைவு — பம்பை இயக்கும் முன் நிரப்புவது பாதுகாப்பானது."
          : "That's low enough that refilling before running the pump is the safer move.",
      );
    }
  }
  if (s.soilPh != null) {
    parts.push(
      locale === "ta"
        ? `மண் pH ${s.soilPh}. பல பயிர்களுக்கு 6.0 முதல் 7.0 வரை பொதுவாக ஏற்றது.`
        : `Soil pH is ${s.soilPh}. Many crops prefer roughly 6.0 to 7.0, though needs vary by species.`,
    );
  }

  return {
    content:
      locale === "ta"
        ? `${parts.join(" ")} இவை உறுதிசெய்யப்பட்ட அளவீடுகளின் அடிப்படையில் மட்டும்.`
        : `${parts.join(" ")} I'm basing this only on verified readings, not guesses.`,
    confidence: 0.85,
    uncertain: false,
  };
}

function explainAnalysis(
  locale: MomoLocale,
  analysis: PlantAnalysisResult | null | undefined,
): { content: string; confidence: number | null; uncertain: boolean } {
  if (!analysis) {
    return {
      content:
        locale === "ta"
          ? "சமீபத்திய கேமரா பகுப்பாய்வு இல்லை. தெளிவான இலைப் படம் எடுத்து பதிவேற்றினால் விளக்குகிறேன். படம் இல்லாமல் நோயை ஊகிக்க மாட்டேன்."
          : "There's no recent camera analysis on file. If you capture a clear leaf or plant photo, I can walk through the result with you. I won't invent a diagnosis without that evidence.",
      confidence: 0,
      uncertain: true,
    };
  }
  if (analysis.rejected || analysis.provider === "unavailable") {
    return {
      content:
        locale === "ta"
          ? `பகுப்பாய்வு நிராகரிக்கப்பட்டது அல்லது கிடைக்கவில்லை. ${analysis.rejectionReason ?? analysis.diagnosis} மற்றொரு தெளிவான படம் முயற்சிக்கவும்.`
          : `The analysis was rejected or isn't available yet. ${analysis.rejectionReason ?? analysis.diagnosis} Try another clear photo in good light when you're ready.`,
      confidence: 0,
      uncertain: true,
    };
  }
  if (analysis.isMock) {
    return {
      content:
        locale === "ta"
          ? `இது டெமோ/மாதிரி முடிவு மட்டுமே: ${analysis.diagnosis}. உண்மையான வயல் நோயறிதலாக எடுக்க வேண்டாம்.`
          : `This camera result is demo-labeled only: ${analysis.diagnosis}. Please don't treat it as a real field diagnosis.`,
      confidence: Math.min(0.35, analysis.confidence),
      uncertain: true,
    };
  }

  const tips = analysis.careTips.slice(0, 2).join(" ");
  const confPct = Math.round(analysis.confidence * 100);
  return {
    content:
      locale === "ta"
        ? `கேமரா முடிவு: ${analysis.diagnosis}. நம்பிக்கை சுமார் ${confPct}%. உடல்நிலை குறி ${analysis.health}. ${tips} நம்பிக்கை குறைவாக இருந்தால் மற்றொரு கோணத்தில் படம் எடுப்பது நல்லது.`
        : `Here's what the camera analysis found: ${analysis.diagnosis}. Confidence is about ${confPct}%, with a health tag of ${analysis.health}. ${tips} If confidence feels low, another photo from a clearer angle is a smart next step. I'm explaining the model output — not changing it.`,
    confidence: analysis.confidence,
    uncertain: analysis.confidence < 0.55,
  };
}

function explainRecommendation(
  locale: MomoLocale,
  rec: Recommendation | null | undefined,
  input: MomoEvidenceContext,
  irrigationFocus: boolean,
): { content: string; confidence: number | null; uncertain: boolean } {
  if (!rec || rec.unavailableReason) {
    return {
      content:
        locale === "ta"
          ? "ஆதார அடிப்படையிலான பரிந்துரை தயாராக இல்லை. சென்சார் அல்லது நேரடி பகுப்பாய்வு வந்ததும் விரிவாகச் சொல்கிறேன்."
          : "I don't have enough verified evidence for a field recommendation yet. Once sensors or a live camera analysis arrive, I can explain the safest next step with reasons and trade-offs.",
      confidence: 0,
      uncertain: true,
    };
  }

  const evidence = rec.evidence.slice(0, 4).join("; ");
  const alt = rec.alternative ? (locale === "ta" ? ` மாற்று: ${rec.alternative}` : ` As an alternative: ${rec.alternative}`) : "";
  const risk =
    rec.potentialRisks[0] != null
      ? locale === "ta"
        ? ` கவனிக்க: ${rec.potentialRisks[0]}`
        : ` Keep in mind: ${rec.potentialRisks[0]}`
      : "";

  const lead = irrigationFocus
    ? locale === "ta"
      ? "நீர்ப்பாசனம் குறித்து,"
      : "On irrigation,"
    : locale === "ta"
      ? "என் பரிந்துரை,"
      : "Here's what I'd suggest,";

  return {
    content:
      locale === "ta"
        ? `${lead} ${rec.primary}${alt} ஆதாரம்: ${evidence}. நம்பிக்கை சுமார் ${Math.round(rec.confidence * 100)}%.${risk}`
        : `${lead} ${rec.primary}${alt} That rests on this evidence: ${evidence}. Confidence is about ${Math.round(rec.confidence * 100)}%.${risk}`,
    confidence: rec.confidence,
    uncertain: rec.confidence < 0.55,
  };
}

function explainWeather(
  locale: MomoLocale,
  weather: WeatherInterpretation | null | undefined,
): { content: string; confidence: number | null; uncertain: boolean } {
  if (!weather) {
    return {
      content:
        locale === "ta"
          ? "நேரடி வானிலை இன்னும் ஏற்றப்படவில்லை. இருப்பிட அனுமதி கொடுத்து Weather திரையில் புதுப்பிக்கவும்."
          : "I don't have a live weather snapshot loaded yet. Allow location on the Weather screen, or enter coordinates, and I'll interpret the agricultural impact with you.",
      confidence: 0,
      uncertain: true,
    };
  }
  const w = weather.weather;
  const impacts = weather.impacts
    .slice(0, 2)
    .map((i) =>
      locale === "ta"
        ? `${i.signal}: ${i.suggestedAction}`
        : `${i.signal}. ${i.suggestedAction}`,
    )
    .join(" ");
  return {
    content:
      locale === "ta"
        ? `வானிலை: ${w.conditionLabel}, ${w.temperatureC}°C, ஈரம் ${w.humidityPct}%RH. ${impacts}`
        : `Right now it's ${w.conditionLabel}, about ${w.temperatureC}°C, with humidity around ${w.humidityPct}%RH. ${impacts}`,
    confidence: 0.82,
    uncertain: false,
  };
}

function explainVerdia(locale: MomoLocale) {
  if (locale === "ta") {
    return {
      content:
        "VERDIA.AI ஒரு நுண்ணறிவு வேளாண் தளம். கேமரா பகுப்பாய்வு, சென்சார் கண்காணிப்பு, பண்ணை மேலாண்மை, வானிலை விளக்கம், பரிந்துரைகள், அறிக்கைகள் ஆகியவை உள்ளன. நான் momo.ai — அவற்றைப் புரிய வைக்கும் துணை. Live Mode-இல் போலித் தரவு காட்டாது.",
      confidence: 0.9,
    };
  }
  return {
    content:
      "VERDIA.AI is an intelligent agriculture platform. It brings together camera analysis, sensor monitoring, farm and device management, weather interpretation, recommendations, reports, and alerts. I'm momo.ai — here to explain those systems clearly. In Live Mode we never invent readings or diagnoses. If something isn't configured yet, you'll see an honest empty or unavailable state and a path to finish setup.",
    confidence: 0.9,
  };
}

function explainEsp32(locale: MomoLocale) {
  if (locale === "ta") {
    return {
      content:
        "ESP32 சென்சார்களைப் படித்து, telemetry அனுப்பி, பம்ப் கட்டளைகளைப் பெறும். Heartbeat, மறுஇணைப்பு, RSSI, firmware பதிப்பு ஆகியவை Device Manager-இல் தெரியும். சாதனம் இல்லாவிட்டால் பயன்பாடு செயலிழக்காது — காலியான நிலையைக் காட்டும்.",
      confidence: 0.88,
    };
  }
  return {
    content:
      "Your ESP32 reads sensors, sends telemetry, and receives pump commands. Healthy devices show heartbeat, reconnect behavior, firmware version, and RSSI in Device Manager. If hardware is missing, VERDIA stays up and simply shows that no verified device data is available — it shouldn't crash or invent values.",
    confidence: 0.88,
  };
}

function explainAgriculture(
  locale: MomoLocale,
  q: string,
  input: MomoEvidenceContext,
): { content: string; confidence: number | null; uncertain: boolean } {
  const t = q.toLowerCase();
  let core: string;
  if (/yellow|chlorosis|மஞ்சள்/.test(t)) {
    core =
      locale === "ta"
        ? "இலை மஞ்சள் நிறம் ஊட்டக்குறை, அதிக நீர், அல்லது நோயால் வரலாம். ஒரே காரணம் என உறுதியாகச் சொல்ல முடியாது. புதிய இலைகளா பழைய இலைகளா என்பதைக் கவனியுங்கள்."
        : "Yellowing leaves can come from nutrient imbalance, overwatering, pests, or disease. I won't pretend there's one answer. Notice whether new or old leaves yellow first, check soil moisture, and capture a clear photo if you can.";
  } else if (/fungus|blight|mildew|பூஞ்சை/.test(t)) {
    core =
      locale === "ta"
        ? "பூஞ்சை அறிகுறிகளுக்கு காற்று ஓட்டம், இலை ஈரம், மற்றும் அடர்த்தியான நடவு முக்கியம். உயர் ஈரப்பதத்தில் கண்காணிப்பை அதிகரிக்கவும்."
        : "Fungal issues often love humid, still air on wet leaves. Improving airflow and avoiding late overhead watering can help, and high humidity is a cue to scout more often.";
  } else if (/fertiliz|உரம்|compost|mulch/.test(t)) {
    core =
      locale === "ta"
        ? "உரம் பயிர் மற்றும் மண் பரிசோதனையைப் பொறுத்தது. அளவுக்கு மிகுந்த நைட்ரஜன் இலை வளர்ச்சியைத் தூண்டி பூக்களைக் குறைக்கலாம்."
        : "Fertilizer needs depend on the crop and soil. More nitrogen isn't always better — it can push leafy growth at the expense of fruiting. Compost and mulch often help moisture and soil life with lower risk.";
  } else {
    core =
      locale === "ta"
        ? "பயிர் ஆரோக்கியம் மண் ஈரம், ஊட்டம், ஒளி, காற்று, மற்றும் பூச்சி அழுத்தத்தின் சமநிலை. குறிப்பிட்ட அறிகுதியைச் சொன்னால் இன்னும் இலக்காக உதவுகிறேன்."
        : "Crop health is usually a balance of water, nutrition, light, airflow, and pest pressure. Share a symptom, crop name, or growth stage and I'll walk through likely causes and safer next checks.";
  }

  if (input.validatedEvidence?.length) {
    core +=
      locale === "ta"
        ? ` உங்கள் தற்போதைய சென்சார் ஆதாரமும் கையில் உள்ளது.`
        : ` I also have your current verified sensor context if you want me to connect it to this.`;
  }

  return { content: core, confidence: 0.7, uncertain: true };
}

function explainScience(
  locale: MomoLocale,
  q: string,
): { content: string; confidence: number | null; uncertain: boolean } {
  const t = q.toLowerCase();
  if (/photosynthesis|ஒளிச்சேர்க்கை/.test(t)) {
    return {
      content:
        locale === "ta"
          ? "ஒளிச்சேர்க்கையில் தாவரங்கள் ஒளி ஆற்றலைக் கொண்டு கார்பன் டை ஆக்சைடையும் நீரையும் சர்க்கரையாக மாற்றுகின்றன. ஆக்சிஜன் துணை விளைபொருள்."
          : "Photosynthesis is how plants turn light energy into chemical energy. They combine carbon dioxide and water to make sugars, and release oxygen along the way. That's why light and healthy leaves matter so much for growth.",
      confidence: 0.9,
      uncertain: false,
    };
  }
  if (/ph\b|அமில/.test(t)) {
    return {
      content:
        locale === "ta"
          ? "pH அமிலத்தன்மையைக் காட்டும். 7 நடுநிலை; அதற்குக் கீழ் அமிலம், மேல் காரம். ஊட்ட உறிஞ்சுதல் pH-ஐப் பொறுத்தது."
          : "pH tells you how acidic or alkaline something is. Seven is neutral. Below that is acidic, above is alkaline. In soil, pH changes which nutrients plants can take up easily.",
      confidence: 0.9,
      uncertain: false,
    };
  }
  return {
    content:
      locale === "ta"
        ? "அந்த அறிவியல் தலைப்பைச் சுருக்கி விளக்க முடியும். குறிப்பிட்ட கருத்தைச் சொல்லுங்கள் — உதாரணம்: ஒளிச்சேர்க்கை, pH, அல்லது நீரின் சுழற்சி."
        : "I can walk through that science topic in plain language. Name the idea you want — for example photosynthesis, pH, capillary action in soil, or the water cycle — and I'll explain it step by step.",
    confidence: 0.65,
    uncertain: true,
  };
}

function explainTech(locale: MomoLocale, q: string) {
  if (/esp32|iot|sensor/.test(q.toLowerCase())) {
    return explainEsp32(locale);
  }
  return {
    content:
      locale === "ta"
        ? "தொழில்நுட்பக் கேள்விகளில் படிப்படியாக உதவ முடியும். எந்தப் பகுதியில் சிக்கல் — குறியீடு, API, அல்லது சாதன இணைப்பு?"
        : "I can help with technology step by step. Tell me whether you're stuck on code, an API, device connectivity, or an AI concept, and we'll take the safest practical path first.",
    confidence: 0.7,
  };
}

function explainProductivity(locale: MomoLocale, _q: string) {
  return {
    content:
      locale === "ta"
        ? "ஒரு சிறிய அடுத்த அடியைத் தேர்ந்தெடுங்கள். இருபது நிமிடம் ஒரு பணிக்கு மட்டும் ஒதுக்கி, முடிவில் ஒரு வரி குறிப்பு எழுதுங்கள். தொடர்ச்சி வேகம்விட முக்கியம்."
        : "A simple approach: pick one next action, give it twenty quiet minutes, then write one line about what moved. Consistency usually beats intensity, and clearing one small loop often unlocks the rest.",
    confidence: 0.75,
  };
}

function clarify(locale: MomoLocale, q: string) {
  if (/thanks|thank you|நன்றி/.test(q.toLowerCase())) {
    return {
      content:
        locale === "ta"
          ? "வரவேற்கிறேன். வேறு ஏதேனும் விளக்க வேண்டுமா?"
          : "You're welcome. I'm here if you want to go one level deeper or check another part of your farm.",
      confidence: 0.9,
      uncertain: false,
    };
  }
  return {
    content:
      locale === "ta"
        ? "சற்று விரிவாகச் சொல்லுங்கள். சென்சார், கேமரா, வானிலை, அல்லது பொதுக் கேள்வியா?"
        : "Could you share a little more detail? Are we talking about sensors, a camera result, weather, or a general question?",
    confidence: 0.6,
    uncertain: true,
  };
}

function generalHelp(
  locale: MomoLocale,
  q: string,
  input: MomoEvidenceContext,
): { content: string; confidence: number | null; uncertain: boolean } {
  const hasFarm = Boolean(
    input.validatedEvidence?.length ||
      (input.recommendation && !input.recommendation.unavailableReason) ||
      input.weather,
  );

  if (hasFarm) {
    return {
      content:
        locale === "ta"
          ? `உங்கள் கேள்வி: “${trimQ(q)}”. பண்ணை ஆதாரம் கையில் உள்ளது. சென்சார், வானிலை, அல்லது பரிந்துரையைப் பற்றி குறிப்பிட்டால் நேரடியாக விளக்குகிறேன்.`
          : `You asked about “${trimQ(q)}.” I have some verified farm context available. If you point me at sensors, weather, irrigation, or the latest camera result, I can explain it directly. For broader topics, ask me to teach the concept and I'll keep farm numbers separate from general knowledge.`,
      confidence: 0.55,
      uncertain: true,
    };
  }

  return {
    content:
      locale === "ta"
        ? `நான் “${trimQ(q)}” பற்றி உதவ விரும்புகிறேன். சுருக்கமான பதிலா அல்லது விரிவான விளக்கமா எனச் சொல்லுங்கள். பண்ணை எண்களை ஊகிக்க மாட்டேன்.`
        : `I'd like to help with “${trimQ(q)}.” Tell me if you want a short answer or a deeper walkthrough. I can reason with you about agriculture, science, and technology — and when farm data isn't on hand yet, I'll say that clearly instead of inventing it.`,
    confidence: 0.5,
    uncertain: true,
  };
}

function trimQ(q: string) {
  return q.length > 120 ? `${q.slice(0, 117)}…` : q;
}

function collectEvidenceIds(input: MomoEvidenceContext): string[] {
  const ids: string[] = [];
  if (input.analysis && !input.analysis.rejected) ids.push(input.analysis.id);
  if (input.recommendation) ids.push(input.recommendation.id);
  return ids;
}
