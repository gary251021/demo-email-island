import { useState } from "react";
import { useHydrated, useNavigate } from "@tanstack/react-router";
import { authClient } from "../session/auth-client";
import { getIdentity } from "../session/session.functions";
import { startDemo } from "./mailbox.functions";

export default function DemoEntry() {
  const navigate = useNavigate();
  const interactive = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function enter() {
    setPending(true);
    setError(false);
    try {
      const identity = await getIdentity({ data: {} });
      if (!identity) {
        const result = await authClient.signIn.anonymous();
        if (result.error) throw new Error(result.error.message);
      }
      await startDemo({ data: {} });
      await navigate({ to: "/island" });
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="entry-screen">
      <div className="entry-watermark" aria-hidden="true">
        島
      </div>
      <section className="entry-content" aria-labelledby="entry-title">
        <p className="entry-eyebrow">一封郵件，一座島嶼</p>
        <h1 id="entry-title">郵件群島</h1>
        <p>讓每一封來信，找到自己的位置。</p>
        <button
          className="entry-primary"
          disabled={!interactive || pending}
          onClick={() => void enter()}
        >
          {error ? "重試" : "進入群島"}
        </button>
        <button className="entry-google" disabled>
          Google 登入
        </button>
        {pending && <p role="status">正在準備你的群島…</p>}
        {error && <p role="alert">未能準備郵件，請重試。</p>}
      </section>
    </main>
  );
}
