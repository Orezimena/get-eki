import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import ekiMark from "@/assets/eki-mark.png";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <img src={ekiMark} alt="Eki logo" width={32} height={32} className="h-8 w-8 object-contain" />
      <span className="text-2xl font-extrabold tracking-tight text-primary">Eki</span>
    </Link>
  );
}

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = (
    <>
      <Link
        to="/markets"
        className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
        activeProps={{ className: "text-primary" }}
        onClick={() => setOpen(false)}
      >
        Markets
      </Link>
      {user && (
        <Link
          to="/account"
          className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          activeProps={{ className: "text-primary" }}
          onClick={() => setOpen(false)}
        >
          Account
        </Link>
      )}
      {isAdmin && (
        <Link
          to="/admin"
          className="flex items-center gap-1 text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          activeProps={{ className: "text-primary" }}
          onClick={() => setOpen(false)}
        >
          <ShieldCheck size={15} /> Moderation
        </Link>
      )}
    </>
  );

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />

        <nav className="hidden items-center gap-6 md:flex">{links}</nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/signin">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
        >
          <Menu />
        </Button>
      </div>

      {open && (
        <div className="flex flex-col gap-4 border-t border-border bg-surface px-4 py-4 md:hidden">
          {links}
          {user ? (
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link to="/signin" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <Link to="/signup" onClick={() => setOpen(false)}>
                  Sign up
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <Logo />
        <p>Anonymous market intelligence for UK popup traders.</p>
      </div>
    </footer>
  );
}
