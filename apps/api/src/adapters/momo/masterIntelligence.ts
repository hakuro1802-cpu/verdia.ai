import { nanoid } from "nanoid";
import type { MomoLocale, MomoMessage, MomoReply } from "@verdia/contracts";
import { MOMO_SYSTEM_PROMPT, MOMO_VOICE_HINTS } from "./persona.js";
import type { MomoAssistantPort, MomoEvidenceContext } from "./types.js";
import { answerLocally } from "./localIntelligence.js";

/**
 * Optional OpenAI-compatible chat completion for momo.ai Master Intelligence.
 * Only used when MOMO_LLM_API_KEY (or OPENAI_API_KEY) is configured.
 * Never fabricates VERDIA evidence — verified context is injected as system facts.
 */
export class MomoLlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  static fromEnv(): MomoLlmProvider | null {
    const apiKey =
      process.env.MOMO_LLM_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      "";
    if (!apiKey) return null;
    const baseUrl = (
      process.env.MOMO_LLM_BASE_URL?.trim() || "https://api.openai.com/v1"
    ).replace(/\/$/, "");
    const model = process.env.MOMO_LLM_MODEL?.trim() || "gpt-4o-mini";
    return new MomoLlmProvider(apiKey, baseUrl, model);
  }

  async complete(input: MomoEvidenceContext): Promise<MomoReply> {
    const locale = input.locale === "ta" ? "ta" : "en";
    const evidenceBlock = buildEvidenceBlock(input);
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: `${MOMO_SYSTEM_PROMPT}\n\nVoice hint: ${MOMO_VOICE_HINTS[locale]}\nRespond in ${locale === "ta" ? "Tamil" : "English"}.\n\nVERIFIED VERDIA CONTEXT (do not invent beyond this):\n${evidenceBlock}`,
      },
    ];

    for (const turn of input.history ?? []) {
      if (turn.role === "user" || turn.role === "assistant") {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
    messages.push({ role: "user", content: input.question });

    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.55,
        messages,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`momo_llm_http_${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("momo_llm_empty_response");
    }

    const uncertain =
      /uncertain|not sure|i don't have|i do not have|insufficient|cannot confirm|won't guess|will not guess/i.test(
        content,
      ) || !hasVerifiedFarmEvidence(input);

    const message: MomoMessage = {
      id: `momo_${nanoid(10)}`,
      role: "assistant",
      content,
      locale,
      confidence: uncertain ? 0.45 : 0.75,
      evidenceIds: collectEvidenceIds(input),
      createdAt: new Date().toISOString(),
      uncertain: uncertain || undefined,
    };

    return { message, availability: { status: "available" } };
  }
}

export function buildEvidenceBlock(input: MomoEvidenceContext): string {
  const lines: string[] = [];
  if (input.validatedEvidence?.length) {
    lines.push(`Validated sensors: ${input.validatedEvidence.join("; ")}`);
  } else if (input.sensors) {
    const s = input.sensors;
    const bits = [
      s.soilMoisturePct != null ? `moisture=${s.soilMoisturePct}%` : null,
      s.temperatureC != null ? `temp=${s.temperatureC}C` : null,
      s.humidityPct != null ? `humidity=${s.humidityPct}%` : null,
      s.soilPh != null ? `pH=${s.soilPh}` : null,
      s.waterLevelPct != null ? `tank=${s.waterLevelPct}%` : null,
    ].filter(Boolean);
    if (bits.length) lines.push(`Sensors: ${bits.join(", ")}`);
    else lines.push("Sensors: none verified");
  } else {
    lines.push("Sensors: none available");
  }

  if (input.analysis) {
    if (input.analysis.rejected || input.analysis.provider === "unavailable") {
      lines.push(
        `Camera: rejected/unavailable — ${input.analysis.rejectionReason ?? input.analysis.diagnosis}`,
      );
    } else if (input.analysis.isMock) {
      lines.push(`Camera: MOCK ONLY — ${input.analysis.diagnosis} (do not treat as field diagnosis)`);
    } else {
      lines.push(
        `Camera: ${input.analysis.diagnosis} (confidence ${input.analysis.confidence}, health ${input.analysis.health})`,
      );
    }
  } else {
    lines.push("Camera: no recent analysis");
  }

  if (input.weather) {
    const w = input.weather.weather;
    lines.push(
      `Weather: ${w.conditionLabel}, ${w.temperatureC}C, humidity ${w.humidityPct}%RH, rainProb ${w.precipitationProbabilityPct ?? "n/a"}%`,
    );
    for (const i of input.weather.impacts.slice(0, 3)) {
      lines.push(`Weather impact: ${i.signal} → ${i.suggestedAction}`);
    }
  } else {
    lines.push("Weather: not loaded");
  }

  if (input.recommendation && !input.recommendation.unavailableReason) {
    lines.push(
      `Recommendation: ${input.recommendation.primary} (confidence ${input.recommendation.confidence})`,
    );
    lines.push(`Evidence: ${input.recommendation.evidence.join("; ")}`);
  } else {
    lines.push("Recommendation: insufficient verified evidence");
  }

  return lines.join("\n");
}

function hasVerifiedFarmEvidence(input: MomoEvidenceContext): boolean {
  const hasSensors = Boolean(input.validatedEvidence?.length);
  const hasLiveAnalysis =
    Boolean(input.analysis) &&
    !input.analysis!.rejected &&
    !input.analysis!.isMock &&
    input.analysis!.provider !== "unavailable";
  const hasWeather = Boolean(input.weather);
  const hasRec = Boolean(input.recommendation && !input.recommendation.unavailableReason);
  return hasSensors || hasLiveAnalysis || hasWeather || hasRec;
}

function collectEvidenceIds(input: MomoEvidenceContext): string[] {
  const ids: string[] = [];
  if (input.analysis && !input.analysis.rejected) ids.push(input.analysis.id);
  if (input.recommendation) ids.push(input.recommendation.id);
  return ids;
}

/**
 * momo.ai Master Intelligence — local reasoning always available;
 * optional LLM for deeper generalized conversation when configured.
 */
export class MomoMasterIntelligence implements MomoAssistantPort {
  constructor(private readonly llm: MomoLlmProvider | null = MomoLlmProvider.fromEnv()) {}

  async reply(input: MomoEvidenceContext): Promise<MomoReply> {
    if (this.llm) {
      try {
        return await this.llm.complete(input);
      } catch (err) {
        // Fall back to local intelligence — never invent LLM output
        const local = answerLocally(input);
        local.message.content = `${local.message.content}\n\n${input.locale === "ta" ? "குறிப்பு: மேம்பட்ட மொழி மாதிரி தற்காலிகமாக கிடைக்கவில்லை. உள்ளூர் அறிவால் தொடர்கிறேன்." : "Note: the advanced language model was briefly unavailable, so I continued with my local intelligence. I did not invent any missing farm data."}`;
        return local;
      }
    }
    return answerLocally(input);
  }
}

/** Back-compat alias used by older imports/tests. */
export { MomoMasterIntelligence as MomoTemplateAssistant };
