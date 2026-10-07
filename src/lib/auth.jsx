import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const AuthCtx = createContext(null);

/** 登入狀態：session、角色（admin / member）、會員對應的客戶資料 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async (sess) => {
    if (!sess?.user) { setRole(null); setCustomer(null); return; }
    const [{ data: prof }, { data: cust }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", sess.user.id).maybeSingle(),
      supabase.from("customers").select("*").eq("auth_user_id", sess.user.id).maybeSingle(),
    ]);
    setRole(prof?.role || "member");
    setCustomer(cust || null);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await refresh(data.session).catch(() => {});
      setReady(true);
    }).catch(() => setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      // 不在 callback 內直接 await supabase 呼叫，避免鎖死
      setTimeout(() => refresh(sess).catch(() => {}), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [refresh]);

  const signOut = async () => {
    await supabase.auth.signOut().catch(() => {});
    setSession(null); setRole(null); setCustomer(null);
  };

  return (
    <AuthCtx.Provider value={{
      session, user: session?.user || null, role, isAdmin: role === "admin", customer, setCustomer, ready,
      signOut, reloadProfile: () => refresh(session),
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
