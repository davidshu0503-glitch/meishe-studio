import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { errMsg, supabase } from "../../lib/supabase";
import { EVENT_LABELS, fmtDateTime, NOTIFY_STATUS } from "../../lib/utils";
import { Modal, Spinner, useToast } from "../../components/ui";

const TONE = { sent: "ok", queued: "warn", sending: "info", failed: "danger", skipped: "muted" };

export default function Notifications() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [view, setView] = useState("todo");
  const [event, setEvent] = useState("全部");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("notifications").select("*").order("id", { ascending: false }).limit(1000);
    setRows(data || []);
    window.dispatchEvent(new Event("gime:notifications"));
  };
  useEffect(() => { load(); }, []);

  const list = useMemo(() => (rows || []).filter((n) => {
    if (view === "todo" && (n.processed || !(n.audience === "studio" || n.status === "failed"))) return false;
    if (view === "failed" && n.status !== "failed") return false;
    if (event !== "全部" && n.event !== event) return false;
    if (!q) return true;
    const p = n.payload || {};
    return [p.name, p.phone, n.order_id, n.booking_id, n.recipient].some((v) => String(v || "").toLowerCase().includes(q.toLowerCase()));
  }), [rows, view, event, q]);

  const mark = async (ids, processed = true) => {
    const { error } = await supabase.from("notifications").update({ processed }).in("id", ids);
    if (error) return toast(errMsg(error), "err");
    load();
  };
  const retry = async (n) => {
    await supabase.from("notifications").update({ status: "queued", attempts: 0, error: "" }).eq("id", n.id);
    await sendNow();
  };
  const sendNow = async () => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-notifications", { body: {} });
    setSending(false);
    if (error) toast("寄送服務尚未部署或無法連線（請參考部署說明第 4 步）", "err");
    else toast(`處理 ${data.processed} 則：送出 ${data.sent}、略過 ${data.skipped}、失敗 ${data.failed}`);
    load();
  };

  const queued = (rows || []).filter((n) => n.status === "queued").length;

  return (
    <>
      <div className="admin-head">
        <div><div className="kicker">Notifications</div><h1>通知中心</h1><p className="small muted">預約、付款、選片、交件等事件會自動寄出 Email 與 LINE 通知</p></div>
        <div className="flex">
          {queued > 0 && <span className="small muted">排隊中 {queued} 則</span>}
          <button className="btn btn-sm" disabled={sending} onClick={sendNow}>{sending ? "寄送中…" : "立即寄送佇列"}</button>
        </div>
      </div>
      <div className="toolbar">
        <div className="seg">
          {[["todo", "待處理"], ["all", "全部"], ["failed", "失敗"]].map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}
        </div>
        <select className="select" value={event} onChange={(e) => setEvent(e.target.value)}><option>全部</option>{Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className="input" placeholder="客戶／電話／訂單編號" value={q} onChange={(e) => setQ(e.target.value)} />
        {view === "todo" && list.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => mark(list.map((n) => n.id))}>全部標記已處理</button>}
      </div>
      {!rows ? <Spinner /> : list.length === 0 ? <div className="empty">{view === "todo" ? "沒有待處理的通知 🎉" : "沒有通知紀錄"}</div> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>時間</th><th>事件</th><th>對象</th><th>管道</th><th>客戶</th><th>狀態</th><th></th></tr></thead>
            <tbody>
              {list.map((n) => (
                <tr key={n.id} className="click" onClick={() => setDetail(n)} style={n.processed ? { opacity: 0.6 } : undefined}>
                  <td className="small">{fmtDateTime(n.created_at)}</td>
                  <td>{EVENT_LABELS[n.event] || n.event}</td>
                  <td>{n.audience === "studio" ? "工作室" : "客戶"}</td>
                  <td>{n.channel === "email" ? "Email" : "LINE"}</td>
                  <td>{n.payload?.name}<div className="small muted">{n.order_id}</div></td>
                  <td><span className={`badge ${TONE[n.status]}`}>{NOTIFY_STATUS[n.status]}</span>{n.error && <div className="small muted" style={{ maxWidth: 220 }}>{n.error}</div>}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                    {n.status === "failed" && <button className="btn btn-ghost btn-sm" onClick={() => retry(n)}>重寄</button>}{" "}
                    {!n.processed ? <button className="btn btn-ghost btn-sm" onClick={() => mark([n.id])}>已處理</button> : <span className="small muted">已處理</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <Modal title={EVENT_LABELS[detail.event] || detail.event} onClose={() => setDetail(null)} actions={<>
          {detail.order_id && <Link className="btn btn-ghost btn-sm" to={`/admin/orders/${detail.order_id}`}>查看訂單</Link>}
          {!detail.processed && <button className="btn btn-sm" onClick={() => { mark([detail.id]); setDetail(null); }}>標記已處理</button>}
        </>}>
          <dl className="kv">
            <dt>建立時間</dt><dd>{fmtDateTime(detail.created_at)}</dd>
            <dt>對象／管道</dt><dd>{detail.audience === "studio" ? "工作室" : "客戶"}｜{detail.channel === "email" ? "Email" : "LINE"}</dd>
            <dt>收件者</dt><dd>{detail.recipient || "—"}</dd>
            <dt>狀態</dt><dd>{NOTIFY_STATUS[detail.status]}{detail.sent_at && `（${fmtDateTime(detail.sent_at)}）`}{detail.error && <div className="small muted">{detail.error}</div>}</dd>
            <dt>主旨</dt><dd>{detail.subject || "（寄送時產生）"}</dd>
          </dl>
          {detail.body && <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", background: "var(--paper-2)", padding: 14, borderRadius: 4, fontSize: 15, marginTop: 14 }}>{detail.body}</pre>}
        </Modal>
      )}
    </>
  );
}
