"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type MessageRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  subject?: string;
  concept?: string;
  canSave?: boolean;
  saveStatus?: "idle" | "saving" | "saved" | "error";
};

type DetectResponse = {
  subject: string;
  concept: string;
};

type SavePayload = {
  subject: string;
  concept: string;
  masteryLevel: string;
  overviewGist: string;
  deepDiveGist: string[];
  strongAreas: string[];
  weakAreas: string[];
  nextSteps: string[];
  notes: string;
};

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "Welcome! Ask a study question and I can help explain the concept, detect the topic, and save your progress.",
  },
];

function extractJSONField(message: string, keys: string[]): string[] {
  const lower = message.toLowerCase();
  const items: string[] = [];
  const lines = message.split(/\r?\n/).map((line) => line.trim());

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].toLowerCase();
    if (keys.some((key) => line.includes(key))) {
      for (let j = i + 1; j < lines.length; j += 1) {
        const nextLine = lines[j];
        if (!nextLine) break;
        if (/^[-*•]\s+/.test(nextLine)) {
          items.push(nextLine.replace(/^[-*•]\s+/, ""));
        } else if (nextLine.toLowerCase().includes(":")) {
          break;
        } else {
          items.push(nextLine);
        }
      }
      break;
    }
  }

  return items;
}

function parseSavePayload(
  message: string,
  subject: string,
  concept: string
): SavePayload {
  const masteryMatch = message.match(/\b(Introduced|Developing|Proficient|Strong)\b/i);
  const masteryLevel = masteryMatch ? masteryMatch[1] : "Developing";
  const overviewGist = message
    .split(/[\.\?\!]\s+/)
    .slice(0, 2)
    .join(". ")
    .trim();

  const strongAreas = extractJSONField(message, ["strong areas", "strengths", "areas of strength"]);
  const weakAreas = extractJSONField(message, ["weak areas", "weaknesses", "areas to focus on", "areas for improvement"]);
  const nextSteps = extractJSONField(message, ["next steps", "next step", "what to do next", "recommendations", "actions"]);
  const deepDiveGist = extractJSONField(message, ["deep dive", "details", "in depth", "go deeper"]);

  return {
    subject,
    concept,
    masteryLevel,
    overviewGist: overviewGist || message.slice(0, 120),
    deepDiveGist: deepDiveGist.length ? deepDiveGist : [overviewGist || message.slice(0, 120)],
    strongAreas,
    weakAreas,
    nextSteps,
    notes: message,
  };
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const updateAssistantMessage = (id: string, update: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === id ? { ...message, ...update } : message))
    );
  };

  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage || sending) return;

    setInput("");
    setSending(true);

    const userId = crypto.randomUUID();
    appendMessage({ id: userId, role: "user", text: userMessage });

    let detected: DetectResponse = { subject: "", concept: "" };

    try {
      console.log('[CHAT-PAGE] Calling /api/detect-concept with message:', userMessage.slice(0, 100));
      const detectRes = await fetch("/api/detect-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage }),
      });
      detected = (await detectRes.json()) as DetectResponse;
      console.log('[CHAT-PAGE] Raw response from /api/detect-concept:', detected);
      console.log('[CHAT-PAGE] Subject:', detected.subject, '| Concept:', detected.concept);
    } catch (error) {
      console.error("Detect concept error", error);
    }

    const canSaveValue = Boolean(detected.subject && detected.concept);
    console.log('[CHAT-PAGE] canSave calculated as:', canSaveValue);
    console.log('[CHAT-PAGE] detected.subject truthy?', Boolean(detected.subject));
    console.log('[CHAT-PAGE] detected.concept truthy?', Boolean(detected.concept));

    const assistantId = crypto.randomUUID();
    appendMessage({
      id: assistantId,
      role: "assistant",
      text: "",
      subject: detected.subject,
      concept: detected.concept,
      canSave: canSaveValue,
      saveStatus: "idle",
    });

    try {
      console.log('[CHAT-PAGE] Calling /api/chat with subject:', detected.subject, 'concept:', detected.concept);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage,
          subject: detected.subject,
          concept: detected.concept,
        }),
      });

      if (!response.body) {
        throw new Error("No response stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        updateAssistantMessage(assistantId, { text: accumulated });
      }

      updateAssistantMessage(assistantId, { text: accumulated });
    } catch (error) {
      console.error("Chat stream error", error);
      updateAssistantMessage(assistantId, {
        text: "Sorry, something went wrong while generating the response.",
        canSave: false,
      });
    } finally {
      setSending(false);
    }
  };

  const handleSaveProgress = async (message: ChatMessage) => {
    if (!message.subject || !message.concept || message.saveStatus === "saving") return;

    updateAssistantMessage(message.id, { saveStatus: "saving" });

    const payload = parseSavePayload(message.text, message.subject, message.concept);

    try {
      const saveRes = await fetch("/api/save-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!saveRes.ok) {
        throw new Error("Failed to save progress");
      }

      updateAssistantMessage(message.id, { saveStatus: "saved" });
    } catch (error) {
      console.error("Save concept error", error);
      updateAssistantMessage(message.id, { saveStatus: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex h-screen max-w-4xl flex-col px-4 py-6 sm:px-6">
        <nav className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/95 px-4 py-4 shadow-xl shadow-slate-950/20 sm:px-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Study Agent
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-full px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800/80"
              >
                Chat
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full bg-slate-800 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-700"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </nav>
        <div className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Study Agent</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Chat with your learning coach</h1>
            </div>
            <p className="max-w-2xl text-slate-400">
              Ask a question, detect the concept, and stream a tailored explanation. Save your progress when a concept is recognized.
            </p>
          </div>
        </div>

        <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 shadow-xl shadow-slate-950/50">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-3xl p-4 text-sm leading-6 ${
                      message.role === "user"
                        ? "bg-slate-800 text-slate-100 ring-1 ring-slate-700"
                        : "bg-slate-800/90 text-slate-100 shadow-lg shadow-slate-950/20"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.18em] text-slate-500">
                        Assistant
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{message.text}</div>
                    {message.role === "assistant" && (
                      <>
                        {!message.canSave && (
                          <div className="mt-2 text-xs text-slate-500">
                            [DEBUG: canSave={String(message.canSave)}, subject="{message.subject}", concept="{message.concept}"]
                          </div>
                        )}
                      </>
                    )}
                    {message.role === "assistant" && message.canSave && (
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
                          disabled={message.saveStatus === "saving" || message.saveStatus === "saved"}
                          onClick={() => handleSaveProgress(message)}
                        >
                          {message.saveStatus === "saving"
                            ? "Saving..."
                            : message.saveStatus === "saved"
                            ? "Saved"
                            : "Save progress"}
                        </button>
                        {message.saveStatus === "error" && (
                          <span className="text-sm text-rose-400">Save failed. Try again.</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 bg-slate-950/95 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor="chat-input">
                Send a message
              </label>
              <textarea
                id="chat-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type your study question here..."
                rows={2}
                className="min-h-[72px] w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-slate-800 transition focus:border-slate-600 focus:ring-slate-500"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-500 px-6 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
