import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDateTime } from "../../lib/utils";
import { Modal, Spinner } from "../../components/ui";

const ENTITY = { customers: "客戶", bookings: "預約", orders: "訂單", services: "服務", portfolio: "作品", settings: "網站設定", categories: "分類", blocked_dates: "公休日" };
const ACTION = { update: "修改", delete: "刪除", insert: "新增", rejected: "被拒絕" };
const SKIP = new Set(["updated_at", "created_at", "phone_norm", "email_norm"]);

function diff(before, after) {
  if (!before || !after) return [];
  return Object.keys(after).filter((k) => !SKIP.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => [k, before[k], after[k]]);
}
const show = (v) => (v === null || v === undefined || v === "" ? "（空）" : typeof v === "object" ? JSON.stringify(v).slice(0, 200) : String(v));

export default function AuditLogs() {
  const [rows, setRows] = useState(null);
  const [entity, setEntity] = useState("全部");
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    let q = supabase.from("audit_logs").select("*").order("id", { ascending: false }).limit(500);
    if (entity !== "全部") q = q.eq("entity", entity);
    q.then(({ data }) => setRows(data || []));
  }, [entity]);

  return (
    <>
      <div className="admin-head"><div><div className="kicker">Audit Log</div><h1>變更紀錄</h1><p className="small muted">所有資料的修改與刪除都會自動記錄（誰、何時、改前改後）</p></div></div>
      <div className="toolbar">
        <select className="select" value={entity} onChange={(e) => setEntity(e.target.value)}><option>全部</option>{Object.entries(ENTITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {!rows ? <Spinner /> : rows.length === 0 ? <div className="empty">尚無變更紀錄</div> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>時間</th><th>操作者</th><th>項目</th><th>動作</th><th>變更內容</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const d = diff(r.before, r.after);
                return (
                  <tr key={r.id} className="click" onClick={() => setDetail(r)}>
                    <td className="small">{fmtDateTime(r.created_at)}</td>
                    <td className="small">{r.actor_email || (r.actor ? "會員" : "系統")}</td>
                    <td>{ENTITY[r.entity] || r.entity}<div className="small muted">{(r.after || r.before)?.name || (r.after || r.before)?.title || r.entity_id}</div></td>
                    <td>{ACTION[r.action] || r.action}</td>
                    <td className="small">{r.action === "update" ? d.slice(0, 3).map(([k, a, b]) => <div key={k}>{k}：{show(a)} → {show(b)}</div>) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <Modal title={`${ENTITY[detail.entity] || detail.entity}｜${ACTION[detail.action] || detail.action}`} wide onClose={() => setDetail(null)}>
          <p className="small muted mb-2">{fmtDateTime(detail.created_at)}｜{detail.actor_email || "—"}｜{detail.entity_id}</p>
          {detail.action === "update" ? (
            <table className="tbl"><thead><tr><th>欄位</th><th>修改前</th><th>修改後</th></tr></thead>
              <tbody>{diff(detail.before, detail.after).map(([k, a, b]) => <tr key={k}><td>{k}</td><td>{show(a)}</td><td>{show(b)}</td></tr>)}</tbody></table>
          ) : <pre style={{ whiteSpace: "pre-wrap", fontSize: 13.5 }}>{JSON.stringify(detail.before || detail.after, null, 2)}</pre>}
        </Modal>
      )}
    </>
  );
}
