import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { errMsg, kickNotifications, supabase } from "../../lib/supabase";
import { useSite } from "../../lib/site";
import { BOOKING_STATUSES, csvDownload, fmtDate, normPhone, twDate } from "../../lib/utils";
import { Confirm, Field, Modal, Spinner, StatusBadge, useToast } from "../../components/ui";

export function NewBookingModal({ onClose, onDone }) {
  const { services, booking: cfg } = useSite();
  const toast = useToast();
  const [f, setF] = useState({ service: services[0]?.id || "", date: twDate(1), time: cfg.slots?.[0] || "10:00", name: "", phone: "", method: "email", email: "", line: "", note: "" });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_booking", {
      p_service_id: f.service, p_date: f.date, p_time: f.time, p_name: f.name, p_phone: f.phone,
      p_contact_method: f.method, p_email: f.email || null, p_line_id: f.line || null, p_note: f.note,
    });
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    kickNotifications();
    toast(`已建立預約 ${data.booking_id}`);
    onDone?.(data);
  };
  return (
    <Modal title="新增預約（代客預約）" onClose={onClose} actions={<>
      <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
      <button className="btn btn-sm" disabled={busy} onClick={save}>{busy ? "建立中…" : "建立預約"}</button>
    </>}>
      <div className="form-grid">
        <Field label="服務" full><select className="select" value={f.service} onChange={(e) => set("service", e.target.value)}>{services.map((s) => <option key={s.id} value={s.id}>{s.name}（NT$ {s.price}）</option>)}</select></Field>
        <Field label="日期"><input className="input" type="date" value={f.date} min={twDate()} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="時間" hint="可自訂任意時間"><input className="input" type="time" value={f.time} onChange={(e) => set("time", e.target.value)} /></Field>
        <Field label="姓名"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="電話"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="聯絡方式"><select className="select" value={f.method} onChange={(e) => set("method", e.target.value)}><option value="email">Email</option><option value="line">LINE</option></select></Field>
        {f.method === "email"
          ? <Field label="Email"><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          : <Field label="LINE ID"><input className="input" value={f.line} onChange={(e) => set("line", e.target.value)} /></Field>}
        <Field label="備註" full><textarea className="textarea" value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function RescheduleModal({ booking, onClose, onDone }) {
  const toast = useToast();
  const [date, setDate] = useState(String(booking.date));
  const [time, setTime] = useState(booking.time);
  const save = async () => {
    const { error } = await supabase.from("bookings").update({ date, time }).eq("id", booking.id);
    if (error) return toast(errMsg(error), "err");
    toast("已改期"); onDone();
  };
  return (
    <Modal title={`改期：${booking.name}`} onClose={onClose} actions={<><button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button><button className="btn btn-sm" onClick={save}>儲存</button></>}>
      <div className="form-grid">
        <Field label="日期"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="時間"><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <p className="small muted mt-2">訂單日期會自動同步；系統會檢查新時段是否已被預約。</p>
    </Modal>
  );
}

export default function Bookings() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("已預約");
  const [from, setFrom] = useState(twDate(-30));
  const [to, setTo] = useState("");
  const [cancel, setCancel] = useState(null);
  const [resched, setResched] = useState(null);

  const load = async () => {
    let query = supabase.from("bookings").select("*").order("date").order("time").limit(2000);
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    const { data } = await query;
    setRows(data || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  const list = useMemo(() => (rows || []).filter((b) => {
    if (status !== "全部" && b.status !== status) return false;
    if (!q) return true;
    const k = q.toLowerCase();
    return [b.name, b.id, b.service_name, b.email, b.line_id].some((v) => (v || "").toLowerCase().includes(k)) || (normPhone(q) && normPhone(b.phone).includes(normPhone(q)));
  }), [rows, q, status]);

  const doCancel = async () => {
    const { error } = await supabase.from("bookings").update({ status: "已取消" }).eq("id", cancel.id);
    setCancel(null);
    if (error) return toast(errMsg(error), "err");
    kickNotifications();
    toast("預約已取消，時段已釋放、訂單同步取消");
    load();
  };

  return (
    <>
      <div className="admin-head">
        <div><div className="kicker">Bookings</div><h1>預約管理</h1></div>
        <div className="flex">
          <button className="btn btn-ghost btn-sm" onClick={() => csvDownload(`bookings_${twDate()}.csv`, [["預約編號", "日期", "時間", "服務", "姓名", "電話", "Email", "LINE", "狀態", "備註"], ...list.map((b) => [b.id, b.date, b.time, b.service_name, b.name, b.phone, b.email, b.line_id, b.status, b.note])])}>匯出 CSV</button>
          <button className="btn btn-sm" onClick={() => setParams({ new: "1" })}>＋ 新增預約</button>
        </div>
      </div>
      <div className="toolbar">
        <input className="input" placeholder="搜尋姓名／電話／編號" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option>全部</option>{BOOKING_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <span className="small muted">日期</span>
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="small muted">至</span>
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {!rows ? <Spinner /> : list.length === 0 ? <div className="empty">沒有符合的預約</div> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>日期</th><th>時間</th><th>客戶</th><th>電話</th><th>服務</th><th>狀態</th><th className="hide-sm">編號</th><th></th></tr></thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td>{fmtDate(b.date)}</td><td>{b.time}</td>
                  <td><b>{b.name}</b>{b.note && <div className="small muted" style={{ maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={b.note}>{b.note}</div>}</td>
                  <td>{b.phone}</td><td>{b.service_name}</td><td><StatusBadge status={b.status} /></td>
                  <td className="hide-sm small muted">{b.id}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link className="btn btn-ghost btn-sm" to={`/admin/orders?booking=${b.id}`}>訂單</Link>{" "}
                    {b.status === "已預約" && <><button className="btn btn-ghost btn-sm" onClick={() => setResched(b)}>改期</button>{" "}<button className="btn btn-ghost btn-sm" onClick={() => setCancel(b)}>取消</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cancel && <Confirm title="取消預約？" danger confirmText="確定取消" message={`${cancel.name}｜${fmtDate(cancel.date)} ${cancel.time}｜${cancel.service_name}。取消後會釋放時段、同步取消訂單，並通知客戶。`} onConfirm={doCancel} onCancel={() => setCancel(null)} />}
      {resched && <RescheduleModal booking={resched} onClose={() => setResched(null)} onDone={() => { setResched(null); load(); }} />}
      {params.get("new") && <NewBookingModal onClose={() => setParams({})} onDone={() => { setParams({}); load(); }} />}
    </>
  );
}
