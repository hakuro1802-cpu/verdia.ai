import { useEffect, useMemo, useRef, useState } from "react";
import type { MomoLocale, MomoMessage } from "@verdia/contracts";
import { ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import { sendMomoChat } from "./momoService";

type ChatItem = MomoMessage;

const SUGGESTIONS_EN = [
  "Who are you?",
  "How is my soil moisture?",
  "What does VERDIA do?",
  "Should I irrigate today?",
  "Explain photosynthesis simply",
];

const SUGGESTIONS_TA = [
  "நீ யார்?",
  "மண் ஈரம் எப்படி உள்ளது?",
  "VERDIA என்ன செய்கிறது?",
  "இன்று நீர்ப்பாசனம் வேண்டுமா?",
  "ஒளிச்சேர்க்கையை எளிதாக விளக்கு",
];

function sessionId(): string {
  try {
    const key = "momo.ai.sessionId";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = `momo_${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
    return id;
  } catch {
    return `momo_${crypto.randomUUID()}`;
  }
}

export function MomoScreen() {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [locale, setLocale] = useState<MomoLocale>("en");
  const [state, setState] = useState<FeatureStateKind>("ready");
  const [message, setMessage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const lastFailedUserText = useRef<string | null>(null);
  const sid = useMemo(() => sessionId(), []);
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, state]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = (item: ChatItem) => {
    if (!("speechSynthesis" in window)) {
      setMessage("Speech is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(item.content);
    utter.lang = item.locale === "ta" ? "ta-IN" : "en-US";
    utter.rate = 0.95;
    utter.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith(item.locale === "ta" ? "ta" : "en") &&
        /female|woman|zira|samantha|google uk english female|natural/i.test(v.name),
    );
    if (preferred) utter.voice = preferred;
    setSpeakingId(item.id);
    utter.onend = () => setSpeakingId(null);
    utter.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utter);
  };

  const sendText = async (text: string, opts?: { appendUser?: boolean }) => {
    if (!text || busy) return;

    if (opts?.appendUser !== false) {
      const userMsg: ChatItem = {
        id: `u_${crypto.randomUUID()}`,
        role: "user",
        content: text,
        locale,
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
      const reply = await sendMomoChat({
        message: text,
        locale,
        conversationId: sid,
      });
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

  const suggestions = locale === "ta" ? SUGGESTIONS_TA : SUGGESTIONS_EN;

  return (
    <main className="feature-screen momo-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">momo.ai</p>
          <h1>{locale === "ta" ? "உங்கள் அறிவுத் துணை" : "Your intelligence companion"}</h1>
          <p className="feature-lede">
            {locale === "ta"
              ? "அன்பான, நேர்மையான விளக்கங்கள். பண்ணைத் தரவை ஊகிக்காது. பேசுவதற்கேற்ற மொழி."
              : "Warm, honest guidance. Never invents farm readings. Written for a natural spoken voice."}
          </p>
        </div>
        <div className="momo-locale" role="group" aria-label="Language">
          <button
            type="button"
            className={locale === "en" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
            onClick={() => setLocale("en")}
          >
            English
          </button>
          <button
            type="button"
            className={locale === "ta" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
            onClick={() => setLocale("ta")}
          >
            தமிழ்
          </button>
        </div>
      </header>

      {messages.length === 0 && state === "ready" ? (
        <div className="momo-suggestions">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => void sendText(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <div className="momo-thread" ref={threadRef}>
        {messages.length === 0 && state === "ready" ? (
          <FeatureState
            state="empty"
            message={
              locale === "ta"
                ? "வணக்கம். சென்சார், பயிர், அறிவியல், அல்லது VERDIA பற்றி கேளுங்கள்."
                : "Say hello, ask about sensors, crops, science, or how VERDIA works."
            }
            compact
          />
        ) : null}
        {messages.map((m) => (
          <article key={m.id} className={`momo-bubble momo-bubble--${m.role}`}>
            <p>{m.content}</p>
            {m.role === "assistant" ? (
              <div className="momo-meta-row">
                <p className="momo-meta">
                  {m.uncertain || (m.confidence != null && m.confidence < 0.55)
                    ? locale === "ta"
                      ? "நிச்சயமற்றது — வழிகாட்டுதல் மட்டும்."
                      : "Uncertain — guidance, not a firm diagnosis."
                    : null}
                  {m.confidence != null
                    ? ` ${locale === "ta" ? "நம்பிக்கை" : "Confidence"} ${Math.round(m.confidence * 100)}%`
                    : ""}
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => speak(m)}
                  disabled={speakingId === m.id}
                >
                  {speakingId === m.id
                    ? locale === "ta"
                      ? "பேசுகிறது…"
                      : "Speaking…"
                    : locale === "ta"
                      ? "கேள்"
                      : "Listen"}
                </button>
              </div>
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
          placeholder={locale === "ta" ? "momo.ai இடம் கேளுங்கள்…" : "Ask momo.ai…"}
          aria-label="Message to momo.ai"
          disabled={busy}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
          {busy ? (locale === "ta" ? "அனுப்புகிறது…" : "Sending…") : locale === "ta" ? "அனுப்பு" : "Send"}
        </button>
      </form>
    </main>
  );
}
