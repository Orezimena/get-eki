import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verify-email")({
  validateSearch: z.object({ email: z.string().optional() }),
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
  const { email } = Route.useSearch();

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="eki-panel p-8">
        <MailCheck className="mx-auto text-primary" size={44} />
        <h1 className="mt-4 text-2xl font-extrabold">Check your email to verify your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We've sent a verification link{email ? ` to ${email}` : ""}. Click it and you'll be taken
          straight to setting up your trader profile.
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link to="/signin">Back to sign in</Link>
        </Button>
      </div>
    </div>
  );
}
