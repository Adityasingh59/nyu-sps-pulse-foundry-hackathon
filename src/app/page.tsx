import { redirect } from "next/navigation";
import { currentUser, supabaseConfig } from "../server/supabase.ts";
import { Workspace } from "./workspace.tsx";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!supabaseConfig())
    return (
      <main className="shell">
        <div className="top">
          <h1>TableSignal</h1>
        </div>
        <p className="error">
          Cloud storage is not configured for this deployment. Set the Supabase
          URL and publishable key; see docs/cloud-deployment.md.
        </p>
      </main>
    );
  const { userId, email } = await currentUser();
  if (!userId) redirect("/login");
  return (
    <main className="shell">
      <div className="top">
        <h1>TableSignal</h1>
        <form action="/auth/signout" method="post">
          <span className="muted">{email} </span>
          <button className="button secondary">Sign out</button>
        </form>
      </div>
      <Workspace />
    </main>
  );
}
