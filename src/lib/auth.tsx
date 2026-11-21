import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { createAuthState, type AuthState } from "./auth-state";
import { clearPrivateQueries } from "./private-cache";

export type AuthValue = AuthState & {
  user: User | null;
  refreshProfile: () => Promise<void>;
  retry: () => Promise<void>;
  saveProfile: (category: string, region: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [store] = useState(() =>
    createAuthState({
      getSession: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
      },
      onSession: (listener) => {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session));
        return () => data.subscription.unsubscribe();
      },
      loadProfile: async (id) => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      loadAdmin: async (id) => {
        const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", id);
        if (error) throw error;
        return (data ?? []).some((role) => role.role === "admin");
      },
      saveProfile: async (id, exists, fields) => {
        const table = supabase.from("profiles");
        const mutation = exists
          ? table.update(fields).eq("id", id)
          : table.insert({ id, ...fields });
        // single() rejects zero-row saves, including rows filtered out by RLS.
        const { data, error } = await mutation.select("*").single();
        if (error)
          throw new Error(
            "We couldn't save your profile. Please try again. If this continues, contact support.",
          );
        return data;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      clearPrivateData: () => clearPrivateQueries(queryClient),
    }),
  );
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => store.start(), [store]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        user: state.session?.user ?? null,
        refreshProfile: store.refreshProfile,
        retry: store.retry,
        saveProfile: store.saveProfile,
        signOut: store.signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth requires AuthProvider");
  return auth;
}
