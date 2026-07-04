import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { speak } from "@/lib/tts";

type Step = "greeting" | "credentials" | "loading" | "error";

const GREETING = "Hi, I'm your AI assistant for pothole and litter detection! Enter a username to get started, or sign in if you already have an account.";

export default function Login() {
  const [step, setStep] = useState<Step>("greeting");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const { signup, signin } = useAuth();

  useEffect(() => {
    speak(GREETING);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setStep("loading");
    setErrorMsg("");
    try {
      if (isSignup) {
        await signup(username.trim(), password);
      } else {
        await signin(username.trim(), password);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStep("credentials");
    }
  };

  const toggleMode = () => {
    setIsSignup(!isSignup);
    setErrorMsg("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50/70">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(transparent_95%,#d6d3d1_95%)] [background-size:100%_28px] opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(#78716c_0.5px,transparent_0.5px)] [background-size:24px_24px] opacity-[0.08]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        <div className="paper-card-vintage p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-dashed border-stone-300/60">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-stone-100 border border-stone-300 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M50 90 L70 70 L90 90 L110 70 L130 90" stroke="#78716c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  <circle cx="90" cy="90" r="8" fill="#78716c"/>
                  <path d="M50 120 H130" stroke="#78716c" stroke-width="6" stroke-linecap="round"/>
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-serif font-bold text-stone-800">RoadScan</h1>
                <p className="text-xs text-stone-500 font-serif italic">Pothole & Litter Detection</p>
              </div>
            </div>
            <p className="text-sm text-stone-600 font-serif leading-relaxed">
              {isSignup
                ? "Create an account to start scanning. Choose a username and password."
                : "Welcome back! Sign in with your username and password."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-serif font-medium text-stone-600 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your username"
                maxLength={32}
                className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white/80 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/30 focus:border-stone-400 font-serif transition-all"
                disabled={step === "loading"}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-serif font-medium text-stone-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 4 characters"
                className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white/80 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/30 focus:border-stone-400 font-serif transition-all"
                disabled={step === "loading"}
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-red-600 font-serif italic">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={step === "loading" || !username.trim() || !password}
              className="w-full py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 font-serif font-medium text-sm transition-all disabled:opacity-40 border border-stone-700"
            >
              {step === "loading" ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                  {isSignup ? "Creating account..." : "Signing in..."}
                </span>
              ) : isSignup ? "Create Account" : "Sign In"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-xs text-stone-500 hover:text-stone-700 font-serif italic underline underline-offset-2 transition-colors"
              >
                {isSignup ? "Already have an account? Sign in" : "New here? Create an account"}
              </button>
            </div>
          </form>

          <div className="px-6 py-3 bg-stone-100/50 border-t border-dashed border-stone-300/60">
            <p className="text-[10px] text-stone-400 font-serif text-center italic">
              Your scans and data are stored securely.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
