// 每天由 Vercel 排程呼叫一次，向 Supabase 讀取一筆資料，避免免費專案因閒置被暫停。
// Called once a day by Vercel Cron; reads one row from Supabase so the free project is not paused for inactivity.
const URL_ = process.env.VITE_SUPABASE_URL || "https://ysfutoqeuicjbjxvksso.supabase.co";
const KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_uG5c75iwwl_LbDlVwthu_Q_P3KZBG3-";

export default async function handler(req, res) {
  try {
    const r = await fetch(`${URL_}/rest/v1/services?select=id&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    res.setHeader("Cache-Control", "no-store");
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, supabase_status: r.status, time: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e?.message || e) });
  }
}
