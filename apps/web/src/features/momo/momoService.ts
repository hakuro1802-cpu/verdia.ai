import type { MomoLocale, MomoReply } from "@verdia/contracts";
import { apiFetch } from "../../shared/api/client";

export async function sendMomoChat(input: {
  message: string;
  locale?: MomoLocale;
  conversationId?: string;
}): Promise<MomoReply> {
  return apiFetch<MomoReply>("/momo/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: input.message,
      message: input.message,
      locale: input.locale ?? "en",
      conversationId: input.conversationId,
    }),
  });
}
