import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { authSearch } from "@/lib/auth-flow";
import { pendingVerification, createVerificationResend } from "@/lib/verification-email";
import { supabase } from "@/integrations/supabase/client";
import { VerificationEmailPanel } from "@/components/VerificationEmailPanel";

export const Route = createFileRoute("/verify-email")({
  validateSearch: authSearch,
  head: () => ({
    meta: [
      { title: "Verify your email — Eki" },
      { name: "description", content: "Check your inbox to verify your Eki trader account." },
      { property: "og:title", content: "Verify your email — Eki" },
      { property: "og:description", content: "Check your inbox to verify your Eki account." },
    ],
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const [resend] = useState(() =>
    createVerificationResend({
      storage: pendingVerification,
      resend: (request) => supabase.auth.resend(request),
    }),
  );
  const state = useSyncExternalStore(resend.subscribe, resend.getSnapshot, resend.getSnapshot);
  useEffect(() => {
    // Remove legacy email query parameters from the current history entry too.
    if (new URLSearchParams(window.location.search).has("email")) {
      void navigate({ to: "/verify-email", search: { returnTo }, replace: true });
    }
    resend.tick();
    const timer = window.setInterval(resend.tick, 1000);
    return () => window.clearInterval(timer);
  }, [resend, returnTo, navigate]);

  return (
    <VerificationEmailPanel
      state={state}
      returnTo={returnTo}
      onResend={() => void resend.submit()}
    />
  );
}
