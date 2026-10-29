import { useCallback, useEffect, useState } from "react";
import { errMsg, supabase } from "../../lib/supabase";
import { addDays, twDate } from "../../lib/utils";
import { deleteAuditLogs, deleteBookings, deleteCustomers, deleteNotifications, deleteOrders, deleteRows, findIds } from "../../lib/records";
import { Confirm, Spinner, useToast } from "../../components/ui";

const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();

/**
 * 整理規則：每條規則先「找出符合的紀錄」顯示筆數，確認後才刪除。
 * find(days) 回傳要刪除的編號；remove(ids) 執行刪除。
 */
const RULES = [
  {
    key: "cancelled_bookings", title: "已取消的預約", days: 90,
    desc: (d) => `拍攝日在 ${d} 天以前、狀態為「已取消」的預約，連同同樣已取消的訂單一起刪除。`,
    find: async (d) => findIds("bookings", (q) => q.eq("status", "已取消").lt("date", addDays(twDate(), -d))),
    remove: (ids) => deleteBookings(ids, { withOrders: true }),
  },
  {
    key: "cancelled_orders", title: "已取消的訂單", days: 90,
    desc: (d) => `${d} 天以前建立、狀態為「已取消」的訂單（含相簿與照片檔）。`,
    find: async (d) => findIds("orders", (q) => q.eq("status", "已取消").lt("created_at", ago(d))),
    remove: deleteOrders,
  },
  {
    key: "sent_notifications", title: "已送出的通知紀錄", days: 60,
    desc: (d) => `${d} 天以前、已送出或略過的 Email／LINE 通知紀錄。不影響客人已收到的訊息。`,
    find: async (d) => findIds("notifications", (q) => q.in("status", ["sent", "skipped"]).lt("created_at", ago(d))),
    remove: deleteNotifications,
  },
  {
    key: "failed_notifications", title: "寄送失敗的舊通知", days: 30,
    desc: (d) => `${d} 天以前寄送失敗、已經不需要重寄的通知。`,
    find: async (d) => findIds("notifications", (q) => q.eq("status", "failed").lt("created_at", ago(d))),
    remove: deleteNotifications,
  },
  {
    key: "audit_logs", title: "舊的變更紀錄", days: 365,
    desc: (d) => `${d} 天以前的修改／刪除紀錄。這是查帳依據，建議保留至少一年。`,
    find: async (d) => findIds("audit_logs", (q) => q.lt("created_at", ago(d))),
    remove: deleteAuditLogs,
  },
  {
    key: "ended_promotions", title: "已結束的行銷活動", days: 90,
    desc: (d) => `結束時間在 ${d} 天以前的橫幅、公告與優惠活動。已用代碼成立的預約不受影響。`,
    find: async (d) => findIds("promotions", (q) => q.lt("end_at", ago(d))),
    remove: (ids) => deleteRows("promotions", ids),
  },
  {
    key: "empty_customers", title: "沒有任何預約的客戶", days: 180,
    desc: (d) => `${d} 天以前建立、沒有預約也沒有訂單、也不是會員的客戶資料。`,
    find: async (d) => {
      const ids = await findIds("customers", (q) => q.is("auth_user_id", null).lt("created_at", ago(d)));
      if (!ids.length) return [];
      const [{ data: b }, { data: o }] = await Promise.all([
        supabase.from("bookings").select("customer_id").not("customer_id", "is", null).limit(20000),
        supabase.from("orders").select("customer_id").not("customer_id", "is", null).limit(20000),
      ]);
      const used = new Set([...(b || []), ...(o || [])].map((r) => r.customer_id));
      return ids.filter((id) => !used.has(id));
    },
    remove: deleteCustomers,
  },
];

const TABLES = [["bookings", "預約"], ["orders", "訂單"], ["customers", "客戶"], ["notifications", "通知"], ["audit_logs", "變更紀錄"], ["portfolio", "作品"]];

function RuleCard({ rule, onDone, tick }) {
  const toast = useToast();
  const [days, setDays] = useState(rule.days);
  const [ids, setIds] = useState(null);
  const [err, setErr] = useState("");
  const [ask, setAsk] = useState(false);

  const scan = useCallback(async () => {
    setIds(null); setErr("");
    try { setIds(await rule.find(Math.max(0, Number(days) || 0))); } catch (e) { setErr(errMsg(e)); setIds([]); }
  }, [rule, days]);
  useEffect(() => { const t = setTimeout(scan, 350); return () => clearTimeout(t); }, [scan, tick]);

  const run = async () => {
    try { const n = await rule.remove(ids); toast(`${rule.title}：已刪除 ${n} 筆`); }
    catch (e) { toast(errMsg(e), "err"); }
    setAsk(false); onDone();
  };

  return (
    <div className="clean-card">
      <h3>{rule.title}</h3>
      <div className="row">超過 <input className="input" type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} aria-label="天數" /> 天</div>
      <p>{rule.desc(Number(days) || 0)}</p>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="hit">{ids === null ? "…" : ids.length}<small>筆符合</small></span>
        <button className="btn btn-sm btn-danger" disabled={!ids?.length} onClick={() => setAsk(true)}>刪除</button>
      </div>
      {ids?.length >= 5000 && <p className="small">一次最多處理 5,000 筆，刪除後會再算一次剩下的。</p>}
      {err && <div className="alert alert-err small">{err}</div>}
      {ask && <Confirm title={`刪除 ${ids.length} 筆「${rule.title}」？`} danger confirmText="確定刪除"
        message="刪除後無法復原。每筆刪除都會記錄在「變更紀錄」（變更紀錄本身除外）。" onConfirm={run} onCancel={() => setAsk(false)} />}
    </div>
  );
}

export default function Cleanup() {
  const [counts, setCounts] = useState(null);
  const [tick, setTick] = useState(0);
  const loadCounts = useCallback(async () => {
    const res = await Promise.all(TABLES.map(([t]) => supabase.from(t).select("*", { count: "exact", head: true })));
    setCounts(Object.fromEntries(TABLES.map(([t], i) => [t, res[i].count ?? "—"])));
  }, []);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  return (
    <>
      <div className="admin-head">
        <div><div className="kicker">Data Cleanup</div><h1>資料整理</h1><p className="small muted">定期清掉用不到的舊紀錄，後台會更好找、更快。每項都會先算出筆數，確認後才刪除。</p></div>
      </div>
      {!counts ? <Spinner /> : (
        <div className="count-strip">{TABLES.map(([t, l]) => <span key={t}>{l}<b>{Number(counts[t]).toLocaleString?.() ?? counts[t]}</b></span>)}</div>
      )}
      <div className="clean-grid">
        {RULES.map((r) => <RuleCard key={r.key} rule={r} tick={tick} onDone={() => { loadCounts(); setTick((t) => t + 1); }} />)}
      </div>
      <div className="alert alert-info small mt-3">
        個別刪除：在「預約管理」「訂單」「客戶管理」「通知中心」「變更紀錄」列表勾選左邊的方框，就能一次刪除多筆。
      </div>
    </>
  );
}
