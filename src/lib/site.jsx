import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { DEFAULT_BOOKING, DEFAULT_CATEGORIES, DEFAULT_HERO, DEFAULT_PORTFOLIO, DEFAULT_SERVICES, DEFAULT_STUDIO, DEFAULT_STYLE_SETS } from "./defaults";
import { tierOf } from "./utils";
import { isLive } from "./promos";

const withTier = (rows) => rows.map((r) => ({ ...r, tier: tierOf(r) }));

const SiteCtx = createContext(null);

/** 載入網站公開內容（設定、服務、分類、作品集）。資料庫連不上時使用預設內容，網站不會壞掉。 */
export function SiteProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    online: false,
    studio: DEFAULT_STUDIO,
    hero: DEFAULT_HERO,
    booking: DEFAULT_BOOKING,
    services: withTier(DEFAULT_SERVICES),
    categories: withTier(DEFAULT_CATEGORIES),
    portfolio: DEFAULT_PORTFOLIO,
    styleSets: DEFAULT_STYLE_SETS,
    promotions: [],
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
      // 一拍多風格：資料表還沒建立（尚未執行 03-upgrade.sql）時使用內建範例，不影響其他內容
      const [ss, pr] = await Promise.all([
        supabase.from("style_sets").select("*").eq("published", true).order("sort"),
        // 行銷活動：資料庫只回傳進行中的活動（管理員登入時會回傳全部，所以再篩一次）
        supabase.from("promotions").select("*").eq("published", true).order("sort").order("created_at", { ascending: false }),
      ]);
      const s = Object.fromEntries((st.data || []).map((r) => [r.key, r.value]));
      setState({
        loading: false,
        online: true,
        studio: { ...DEFAULT_STUDIO, ...(s.studio || {}) },
        hero: Array.isArray(s.hero) && s.hero.length ? s.hero : DEFAULT_HERO,
        booking: { ...DEFAULT_BOOKING, ...(s.booking || {}) },
        services: withTier(sv.data?.length ? sv.data : DEFAULT_SERVICES),
        categories: withTier(ct.data?.length ? ct.data : DEFAULT_CATEGORIES),
        portfolio: pf.data || [],
        styleSets: ss.error ? DEFAULT_STYLE_SETS : ss.data || [],
        promotions: pr.error ? [] : (pr.data || []).filter((p) => isLive(p)),
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
