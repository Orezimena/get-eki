import type { Session } from "@supabase/supabase-js";
import type { Profile } from "./eki.ts";
import { hasTraderDetails, isProfileComplete } from "./auth-flow.ts";

export type TraderFields = { product_category: string; trading_region: string; onboarded: true };
export type AuthState = {
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
};

export type AuthDependencies = {
  getSession: () => Promise<Session | null>;
  onSession: (listener: (session: Session | null) => void) => () => void;
  loadProfile: (id: string) => Promise<Profile | null>;
  loadAdmin: (id: string) => Promise<boolean>;
  saveProfile: (id: string, exists: boolean, fields: TraderFields) => Promise<Profile | null>;
  signOut: () => Promise<void>;
  clearPrivateData: () => void;
};

const initialState: AuthState = {
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  error: null,
};

// The request generation invalidates in-flight profile/role reads on identity
// changes, refreshes and logout. The session user always owns the visible profile.
export function createAuthState(deps: AuthDependencies) {
  let state = initialState;
  let generation = 0;
  let active = false;
  let signingOut = false;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<AuthState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  async function load(id: string, version: number) {
    try {
      const [profile, isAdmin] = await Promise.all([deps.loadProfile(id), deps.loadAdmin(id)]);
      if (!active || version !== generation) return;
      if (profile && profile.id !== id) throw new Error("Profile identity mismatch");
      publish({ profile, isAdmin, loading: false, error: null });
    } catch {
      if (active && version === generation) {
        publish({
          profile: null,
          isAdmin: false,
          loading: false,
          error: "We couldn't load your account. Please try again.",
        });
      }
    }
  }

  function acceptSession(session: Session | null) {
    if (!active || signingOut) return;
    const sameUser = state.session?.user.id === session?.user.id;
    if (sameUser && session && state.session && !state.loading) {
      publish({ session });
      return;
    }
    const version = ++generation;
    if (!sameUser) deps.clearPrivateData();
    publish({ session, profile: null, isAdmin: false, loading: !!session, error: null });
    // Supabase auth callbacks must return before making further Supabase calls.
    if (session)
      setTimeout(() => {
        if (active && version === generation) void load(session.user.id, version);
      }, 0);
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      active = true;
      let observedEvent = false;
      const unsubscribe = deps.onSession((session) => {
        observedEvent = true;
        acceptSession(session);
      });
      const startupVersion = generation;
      void deps
        .getSession()
        .then((session) => {
          if (active && !observedEvent && generation === startupVersion) acceptSession(session);
        })
        .catch(() => {
          if (active && !observedEvent && generation === startupVersion) {
            publish({
              loading: false,
              error: "We couldn't restore your session. Please try again.",
            });
          }
        });
      return () => {
        active = false;
        ++generation;
        unsubscribe();
      };
    },
    async refreshProfile() {
      const session = state.session;
      if (!session) throw new Error("Please sign in again.");
      const version = ++generation;
      publish({ loading: true, error: null });
      await load(session.user.id, version);
    },
    async retry() {
      const version = ++generation;
      publish({ loading: true, error: null });
      try {
        const session = await deps.getSession();
        if (!active || version !== generation) return;
        if (session && session.user.id === state.session?.user.id) {
          publish({ session });
          await load(session.user.id, version);
        } else {
          acceptSession(session);
        }
      } catch {
        if (active && version === generation)
          publish({ loading: false, error: "We couldn't load your account. Please try again." });
      }
    },
    async saveProfile(category: string, region: string) {
      const session = state.session;
      if (!session || state.loading || state.error || signingOut)
        throw new Error("Your account is not ready. Please try again.");
      const fields: TraderFields = {
        product_category: category,
        trading_region: region,
        onboarded: true,
      };
      if (!hasTraderDetails(category, region))
        throw new Error("Pick a product category and a trading region.");
      const version = generation;
      const profile = await deps.saveProfile(session.user.id, !!state.profile, fields);
      if (!active || version !== generation || state.session?.user.id !== session.user.id) {
        throw new Error("Your account changed. Please try again.");
      }
      if (
        !isProfileComplete(profile) ||
        profile.id !== session.user.id ||
        profile.product_category !== category ||
        profile.trading_region !== region
      ) {
        throw new Error("Your profile was not saved. Please try again.");
      }
      // A successful save invalidates any older reads of this profile.
      ++generation;
      publish({ profile });
    },
    async signOut() {
      signingOut = true;
      ++generation;
      publish({ loading: true, profile: null, isAdmin: false, error: null });
      deps.clearPrivateData();
      try {
        await deps.signOut();
        publish({ session: null, profile: null, isAdmin: false, loading: false, error: null });
      } catch {
        publish({ loading: false, error: "Sign out failed. Please try again." });
        throw new Error("Sign out failed. Please try again.");
      } finally {
        signingOut = false;
      }
    },
  };
}
