import type {
  MomoLocale,
  MomoMessage,
  MomoReply,
  PlantAnalysisResult,
  Recommendation,
  TelemetrySample,
  WeatherInterpretation,
} from "@verdia/contracts";

export type MomoEvidenceContext = {
  question: string;
  locale: MomoLocale;
  sensors?: TelemetrySample["sensors"] | null;
  validatedEvidence?: string[];
  analysis?: PlantAnalysisResult | null;
  recommendation?: Recommendation | null;
  weather?: WeatherInterpretation | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  sessionId?: string;
};

export interface MomoAssistantPort {
  reply(input: MomoEvidenceContext): Promise<MomoReply> | MomoReply;
}

export type ConversationTurn = {
  role: "user" | "assistant" | "system";
  content: string;
  at: string;
};

/**
 * In-memory conversation continuity for momo.ai sessions.
 * Does not invent farm data — only stores what was said.
 */
export class MomoConversationMemory {
  private readonly sessions = new Map<string, ConversationTurn[]>();
  private readonly maxTurns = 24;

  append(sessionId: string, turn: ConversationTurn): void {
    const list = this.sessions.get(sessionId) ?? [];
    list.push(turn);
    while (list.length > this.maxTurns) list.shift();
    this.sessions.set(sessionId, list);
  }

  history(sessionId: string): ConversationTurn[] {
    return [...(this.sessions.get(sessionId) ?? [])];
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
