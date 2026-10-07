import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { DEFAULT_BOOKING, DEFAULT_CATEGORIES, DEFAULT_HERO, DEFAULT_PORTFOLIO, DEFAULT_SERVICES, DEFAULT_STUDIO } from "./defaults";

const SiteCtx = createContext(null);

/** 載入網站公開內容（設定、服務、分類、作品集）。資料庫連不上時使用預設內容，網站不會壞掉。 */
export function SiteProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    online: false,
    studio: DEFAULT_STUDIO,
    hero: DEFAULT_HERO,
    booking: DEFAULT_BOOKING,
    services: DEFAULT_SERVICES,
    categories: DEFAULT_CATEGORIES,
    portfolio: DEFAULT_PORTFOLIO,
  });

  const load = useCallback(async () => {
    try {
      const [st, sv, ct, pf] = await Promise.all([
        supabase.from("settings").select("key,value"),
        supabase.from("services").select("*").eq("active", true).order("sort"),
        supabase.from("categories").select("*").order("sort"),
        supabase.from("portfolio").select("*").eq("published", true).order("sort").order("created_at", { ascending: false }),
      ]);
      if (st.error || sv.error || ct.error || pf.error) throw st.error || sv.error || ct.error || pf.error;
      const s = Object.fromEntries((st.data || []).map((r) => [r.key, r.value]));
      setState({
        loading: false,
        online: true,
        studio: { ...DEFAULT_STUDIO, ...(s.studio || {}) },
        hero: Array.isArray(s.hero) && s.hero.length ? s.hero : DEFAULT_HERO,
        booking: { ...DEFAULT_BOOKING, ...(s.booking || {}) },
        services: sv.data?.length ? sv.data : DEFAULT_SERVICES,
        categories: ct.data?.length ? ct.data : DEFAULT_CATEGORIES,
        portfolio: pf.data || [],
      });
    } catch (e) {
      console.warn("[GIME] 使用預設內容：", e?.message || e);
      setState((p) => ({ ...p, loading: false, online: false }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return <SiteCtx.Provider value={{ ...state, reload: load }}>{children}</SiteCtx.Provider>;
}

export const useSite = () => useContext(SiteCtx);
