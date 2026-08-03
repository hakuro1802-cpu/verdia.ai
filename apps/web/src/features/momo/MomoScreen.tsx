import { useRef, useState } from "react";
import type { MomoMessage } from "@verdia/contracts";
import { ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import { sendMomoChat } from "./momoService";

type ChatItem = MomoMessage;

export function MomoScreen() {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<FeatureStateKind>("ready");
  const [message, setMessage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const lastFailedUserText = useRef<string | null>(null);

  const sendText = async (text: string, opts?: { appendUser?: boolean }) => {
    if (!text || busy) return;

    if (opts?.appendUser !== false) {
      const userMsg: ChatItem = {
        id: `u_${crypto.randomUUID()}`,
        role: "user",
        content: text,
        locale: "en",
        confidence: null,
        evidenceIds: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
    }
    setBusy(true);
    setState("loading");
    setMessage(undefined);
    lastFailedUserText.current = null;

    try {
      const reply = await sendMomoChat({ message: text });
      if (reply.availability.status === "unavailable") {
        lastFailedUserText.current = text;
        setState("unavailable");
        setMessage(reply.availability.reason);
        return;
      }
      setMessages((prev) => [...prev, reply.message]);
      setState("ready");
    } catch (e) {
      lastFailedUserText.current = text;
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Chat failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setState(mapped.state);
      setMessage(mapped.message);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    await sendText(text);
  };

  const retryLast = async () => {
    const text = lastFailedUserText.current;
    if (!text || busy) {
      setState("ready");
      return;
    }
    await sendText(text, { appendUser: false });
  };

  return (
    <main className="feature-screen momo-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">momo.ai</p>
          <h1>Ask momo</h1>
          <p className="feature-lede">
            Answers include confidence. When momo is unsure, uncertainty is shown clearly.
          </p>
        </div>
      </header>

      <div className="momo-thread">
        {messages.length === 0 && state === "ready" ? (
          <FeatureState state="empty" message="Ask about irrigation, pests, or plant care." compact />
        ) : null}
        {messages.map((m) => (
          <article key={m.id} className={`momo-bubble momo-bubble--${m.role}`}>
            <p>{m.content}</p>
            {m.role === "assistant" ? (
              <p className="momo-meta">
                {m.uncertain || (m.confidence != null && m.confidence < 0.55)
                  ? "Uncertain — treat as guidance, not a firm diagnosis."
                  : null}
                {m.confidence != null
                  ? ` Confidence ${Math.round(m.confidence * 100)}%`
                  : " Confidence unavailable"}
              </p>
            ) : null}
          </article>
        ))}
        {state !== "ready" && state !== "empty" ? (
          <FeatureState
            state={state}
            message={message}
            onRetry={state === "loading" ? undefined : () => void retryLast()}
            compact
          />
        ) : null}
      </div>

      <form
        className="momo-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask momo.ai…"
          aria-label="Message to momo.ai"
          disabled={busy}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
    </main>
  );
}
