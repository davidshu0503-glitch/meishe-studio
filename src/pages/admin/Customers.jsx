import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { errMsg, supabase } from "../../lib/supabase";
import { csvDownload, fmtDate, money, normPhone, twDate } from "../../lib/utils";
import { BulkBar, CheckAll, CheckCell, Confirm, Field, Modal, Spinner, StatusBadge, useSelection, useSort, useToast } from "../../components/ui";
import { deleteCustomers } from "../../lib/records";

function CustomerModal({ customer, orders, onClose, onSaved, onDelete }) {
  const toast = useToast();
  const [f, setF] = useState({ name: customer.name, phone: customer.phone, email: customer.email || "", line_id: customer.line_id || "", note: customer.note || "" });
  const [editing, setEditing] = useState(false);
  const save = async () => {
    if (!f.name.trim()) return toast("請填寫姓名", "err");
    const { error } = await supabase.from("customers").update({
      name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() || null, line_id: f.line_id.trim() || null, note: f.note,
    }).eq("id", customer.id);
    if (error) return toast(errMsg(error), "err");
    toast("客戶資料已更新"); setEditing(false); onSaved();
  };
  const mine = orders.filter((o) => o.customer_id === customer.id);
  return (
    <Modal title={customer.name} wide onClose={onClose}>
      {editing ? (
        <div className="form-grid">
          <Field label="姓名"><input className="input" value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="電話"><input className="input" value={f.phone} maxLength={20} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Email"><input className="input" value={f.email} maxLength={120} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="LINE ID"><input className="input" value={f.line_id} maxLength={60} onChange={(e) => setF({ ...f, line_id: e.target.value })} /></Field>
          <Field label="備註（僅後台可見）" full><textarea className="textarea" value={f.note} maxLength={1000} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <div className="flex"><button className="btn btn-sm" onClick={save}>儲存</button><button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>取消</button></div>
        </div>
      ) : (
        <>
          <dl className="kv">
            <dt>電話</dt><dd>{customer.phone || "—"}</dd>
            <dt>Email</dt><dd>{customer.email || "—"}</dd>
            <dt>LINE ID</dt><dd>{customer.line_id || "—"}{customer.line_user_id && <span className="badge ok" style={{ marginLeft: 8 }}>LINE 已綁定</span>}</dd>
            <dt>會員帳號</dt><dd>{customer.auth_user_id ? "已註冊" : "未註冊"}</dd>
            <dt>備註</dt><dd style={{ whiteSpace: "pre-line" }}>{customer.note || "—"}</dd>
          </dl>
          <div className="flex mt-2"><button className="btn btn-sm" onClick={() => setEditing(true)}>編輯</button><button className="btn btn-ghost btn-sm" onClick={onDelete}>刪除客戶</button></div>
        </>
      )}
      <h3 className="mt-3" style={{ fontSize: 16.5 }}>歷史訂單（{mine.length}）</h3>
      {mine.length === 0 ? <div className="small muted">沒有訂單</div> : (
        <div className="list">
          {mine.map((o) => (
            <Link key={o.id} to={`/admin/orders/${o.id}`} className="row-card" onClick={onClose}>
              <span><b>{o.service_name}</b>　<span className="small muted">{fmtDate(o.date)} {o.time}｜{o.id}</span></span>
              <span className="flex">{money(o.amount)} <StatusBadge status={o.status} /></span>
            </Link>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function Customers() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [customers, setCustomers] = useState(null);
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState("");
  const [del, setDel] = useState(null);

  const load = async () => {
    const [c, o] = await Promise.all([
      supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("orders").select("id,customer_id,service_name,date,time,amount,status").limit(10000),
    ]);
    setCustomers(c.data || []); setOrders(o.data || []);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const m = {};
    orders.forEach((o) => {
      if (!o.customer_id) return;
      const s = (m[o.customer_id] ||= { count: 0, total: 0, last: "" });
      s.count++;
      if (o.status !== "已取消") s.total += o.amount || 0;
      if (o.date && String(o.date) > s.last) s.last = String(o.date);
    });
    return m;
  }, [orders]);

  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const { apply, th } = useSort("created_at", "desc");
  const list = useMemo(() => apply((customers || []).filter((c) => {
    if (onlyEmpty && (stats[c.id]?.count || c.auth_user_id)) return false;
    if (!q) return true;
    const k = q.toLowerCase();
    return [c.name, c.email, c.line_id, c.note].some((v) => (v || "").toLowerCase().includes(k)) || (normPhone(q) && (c.phone_norm || "").includes(normPhone(q)));
  }), { count: (c) => stats[c.id]?.count || 0, total: (c) => stats[c.id]?.total || 0, last: (c) => stats[c.id]?.last || "" }), [customers, q, onlyEmpty, stats, apply]);
  const selection = useSelection(list);
  const [bulkDel, setBulkDel] = useState(null);
  const doBulkDelete = async () => {
    try { const n = await deleteCustomers(bulkDel); toast(`已刪除 ${n} 位客戶（歷史訂單保留）`); }
    catch (e) { toast(errMsg(e), "err"); }
    setBulkDel(null); selection.clear(); load();
  };

  const open = customers?.find((c) => c.id === params.get("id"));

  const doDelete = async () => {
    const { error } = await supabase.from("customers").delete().eq("id", del.id);
    setDel(null);
    if (error) return toast(errMsg(error), "err");
    toast("客戶已刪除（歷史訂單保留）"); setParams({}); load();
  };

  return (
    <>
      <div className="admin-head">
        <div><div className="kicker">Customers</div><h1>客戶管理</h1></div>
        <button className="btn btn-ghost btn-sm" onClick={() => csvDownload(`customers_${twDate()}.csv`, [["姓名", "電話", "Email", "LINE", "預約次數", "消費金額", "最後預約", "備註"], ...list.map((c) => [c.name, c.phone, c.email, c.line_id, stats[c.id]?.count || 0, stats[c.id]?.total || 0, stats[c.id]?.last || "", c.note])])}>匯出 CSV</button>
      </div>
      <div className="toolbar">
        <input className="input" style={{ minWidth: 260 }} placeholder="搜尋姓名／電話／Email" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex small"><input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />只看沒有訂單、非會員的客戶</label>
        <span className="small muted">共 {list.length} 位客戶</span>
      </div>
      <BulkBar selection={selection} label="位">
        <button className="btn btn-sm btn-danger" onClick={() => setBulkDel(selection.ids)}>刪除所選</button>
      </BulkBar>
      {!customers ? <Spinner /> : list.length === 0 ? <div className="empty">沒有客戶資料</div> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><CheckAll selection={selection} />{th("name", "姓名")}<th>電話</th><th className="hide-sm">Email／LINE</th>{th("count", "預約次數")}{th("total", "消費金額")}{th("last", "最後預約")}</tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className={`click ${selection.has(c.id) ? "sel" : ""}`} onClick={() => setParams({ id: c.id })}>
                  <CheckCell selection={selection} id={c.id} />
                  <td><b>{c.name}</b>{c.auth_user_id && <span className="badge info" style={{ marginLeft: 6 }}>會員</span>}</td>
                  <td>{c.phone}</td>
                  <td className="hide-sm small">{c.email || c.line_id || "—"}</td>
                  <td>{stats[c.id]?.count || 0}</td>
                  <td>{money(stats[c.id]?.total)}</td>
                  <td>{stats[c.id]?.last ? fmtDate(stats[c.id].last) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <CustomerModal key={open.id + open.updated_at} customer={open} orders={orders} onClose={() => setParams({})} onSaved={load} onDelete={() => setDel(open)} />}
      {bulkDel && <Confirm title={`刪除 ${bulkDel.length} 位客戶？`} danger confirmText="確定刪除" message="客戶資料將無法復原，但他們的歷史預約與訂單會保留。已註冊會員的登入帳號不會被刪除。" onConfirm={doBulkDelete} onCancel={() => setBulkDel(null)} />}
      {del && <Confirm title="刪除客戶？" danger confirmText="確定刪除" message={`確定要刪除「${del.name}」嗎？客戶資料將無法復原，但歷史預約與訂單會保留。`} onConfirm={doDelete} onCancel={() => setDel(null)} />}
    </>
  );
}
