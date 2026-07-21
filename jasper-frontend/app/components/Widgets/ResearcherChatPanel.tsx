"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "Run erosion simulation for ATH-001-H",
  "Check burn scar risk in sector ATH-001-A",
  "Track contaminant plume in ATH-001-W",
  "What's the current erosion risk with 120mm rainfall?",
];

function AssistantIcon() {
  return (
    <div className="w-7 h-7 rounded-full bg-sait-sky/15 border border-sait-sky/30 flex items-center justify-center shrink-0">
      <svg className="w-3.5 h-3.5 text-sait-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <AssistantIcon />
      <div className="rounded-xl rounded-tl-none px-3.5 py-2.5 bg-surface border border-gray-200/60 dark:border-gray-700/40">
        <div className="flex items-center gap-1 h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-xl rounded-tr-none px-3.5 py-2.5 bg-sait-sky text-white text-sm leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  // Render assistant message — convert **bold** and line breaks
  const lines = msg.content.split("\n");
  return (
    <div className="flex items-start gap-2.5">
      <AssistantIcon />
      <div className="max-w-[85%] rounded-xl rounded-tl-none px-3.5 py-2.5 bg-surface border border-gray-200/60 dark:border-gray-700/40 text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-1">
        {lines.map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-1" />;
          // Inline bold: **text**
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return (
            <p key={i}>
              {parts.map((part, j) =>
                j % 2 === 1 ? (
                  <strong key={j} className="font-semibold text-gray-900 dark:text-gray-100">{part}</strong>
                ) : (
                  part
                )
              )}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export function ResearcherChatPanel() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMsg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { reply: string };
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Network error — could not reach the AI service. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200/60 dark:border-gray-700/40 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-sait-sky/15 border border-sait-sky/30 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-sait-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Jasper AI Research Assistant</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ask it to run simulations or explain model results</p>
        </div>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-green-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Claude claude-sonnet-4-6
        </span>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[320px] max-h-[480px]">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
            <div className="w-12 h-12 rounded-xl bg-sait-sky/10 border border-sait-sky/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-sait-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Ask me to run a simulation</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
                I can trigger erosion, contaminant, and burn scar models and narrate the live results.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-xs px-3 py-1.5 rounded-full border border-sait-sky/30 bg-sait-sky/5 text-sait-sky hover:bg-sait-sky/15 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-gray-200/60 dark:border-gray-700/40 bg-gray-50/50 dark:bg-gray-800/20">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a simulation or sector… (Enter to send)"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sait-sky/40 focus:border-sait-sky/60 transition-colors"
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-9 h-9 rounded-lg bg-sait-sky text-white flex items-center justify-center hover:bg-sait-sky/80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            aria-label="Send message"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
          Shift+Enter for new line · AI outputs require expert validation before regulatory use
        </p>
      </div>
    </div>
  );
}
