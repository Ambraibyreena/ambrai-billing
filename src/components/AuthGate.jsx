import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const rose = "#8C2F49";
const roseSoft = "#F4E3E7";
const cream = "#FBF6F1";
const line = "#EAD9DC";
const muted = "#B48A94";
const ink = "#3A2430";

// Wrap any screen with <AuthGate>...</AuthGate> to require a logged-in staff user
// before rendering it. Handles session restore, login, and logout.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: cream }}>
        <p className="text-sm" style={{ color: muted }}>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: cream, color: ink }}>
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: line }}>
          <h1 className="text-2xl text-center" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: rose, fontWeight: 600 }}>
            Ambrai
          </h1>
          <p className="text-xs text-center -mt-2" style={{ color: muted }}>Staff sign in</p>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: muted }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none"
              style={{ borderColor: line }}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: muted }}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none"
              style={{ borderColor: line }}
            />
          </div>
          {error && <p className="text-xs" style={{ color: "#A3402F" }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: rose }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-[11px] text-center" style={{ color: muted }}>
            No account yet? Create staff logins from the Supabase dashboard → Authentication → Users, or ask Claude to build a signup flow.
          </p>
        </form>
      </div>
    );
  }

  return children;
}

export function useAuth() {
  return { supabase };
}
