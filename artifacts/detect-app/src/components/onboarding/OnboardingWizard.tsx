import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";

type Message = { role: "user" | "assistant"; content: string };

function speak(text: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth || !text) return;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 1;
    synth.speak(u);
  } catch {
    // TTS not available (e.g., incognito restrictions) — fail silently
  }
}

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Welcome to RoadScan! I can detect potholes, plastic waste, and other litter from your photos. Want a quick tour or just start scanning?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [hasSpokenGreeting, setHasSpokenGreeting] = useState(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput("");
    const newMessages = [...messages, { role: "user" as const, content: msg }];
    setMessages(newMessages);
    setIsLoading(true);

    if (!hasSpokenGreeting && messages[0]?.content) {
      speak(messages[0].content);
      setHasSpokenGreeting(true);
    }

    try {
      const token = localStorage.getItem("roadscan_token");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      const reply = data.reply || "Ready when you are!";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
      speak(reply);
    } catch {
      const fallback = "Ready when you are! Upload a photo to get started.";
      setMessages([...newMessages, { role: "assistant", content: fallback }]);
      speak(fallback);
    }
    setIsLoading(false);
  };

  const skipOnboarding = async () => {
    try {
      if (user?.id) {
        const token = localStorage.getItem("roadscan_token");
        await fetch(`/api/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
          body: JSON.stringify({ onboardingCompleted: true }),
        });
      }
    } catch {
      // Network error — still dismiss the modal
    }
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-card shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-sm font-semibold text-foreground">RoadScan AI</span>
          </div>
          <button onClick={skipOnboarding} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Skip tour
          </button>
        </div>

        <div className="h-80 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-cyan-500 text-black rounded-tr-sm"
                  : "bg-secondary/50 text-foreground rounded-tl-sm border border-white/5"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-secondary/50 rounded-xl px-3.5 py-2 text-sm border border-white/5 rounded-tl-sm">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="px-4 py-3 border-t border-border">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black text-sm font-semibold transition-all"
            >
              Send
            </button>
          </form>
          <div className="flex justify-end mt-2">
            <button
              onClick={skipOnboarding}
              className="text-xs text-cyan-400/70 hover:text-cyan-300 transition-colors"
            >
              Done & start scanning →
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
