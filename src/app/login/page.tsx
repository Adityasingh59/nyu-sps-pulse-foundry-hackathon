"use client";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser.ts";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<
    { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const supabase = createSupabaseBrowserClient();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setState({ kind: "sending" });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setState(error ? { kind: "error", message: error.message } : { kind: "sent" });
  }

  return (
    <main className="shell">
      <div className="top">
        <h1>TableSignal</h1>
      </div>
      <section className="panel">
        <h2>Sign in</h2>
        {!supabase ? (
          <p className="error">Cloud sign-in is not configured for this deployment.</p>
        ) : state.kind === "sent" ? (
          <p>Check {email} for a sign-in link. It opens this site and signs you in.</p>
        ) : (
          <form onSubmit={submit} className="grid">
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button className="button" disabled={state.kind === "sending"}>
                {state.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
              </button>
            </div>
            {state.kind === "error" && <p className="error">{state.message}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
