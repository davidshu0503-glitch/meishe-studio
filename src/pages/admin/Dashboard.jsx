import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { addDays, fmtDate, money, twDate, weekday } from "../../lib/utils";
import { Spinner, StatusBadge } from "../../components/ui";

const RANGES = [["today", "今天"], ["tomorrow", "明天"], ["week", "本週"], ["month", "本月"]];

function rangeOf(key) {
  const t = twDate();
  if (key === "today") return [t, t];
  if (key === "tomorrow") return [addDays(t, 1), addDays(t, 1)];
  if (key === "week") { const wd = (weekday(t) + 6) % 7; const s = addDays(t, -wd); return [s, addDays(s, 6)]; }
  const s = t.slice(0, 8) + "01";
  const [y, m] = t.split("-").map(Number);
  return [s, `${t.slice(0, 8)}${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`];
}

export default function Dashboard() {
  const nav = useNavigate();
  const [orders, setOrders] = useState(null);
  const [range, setRange] = useState("today");
  const today = twDate();
  const monthStart = today.slice(0, 8) + "01";

  useEffect(() => {
    supabase.from("orders").select("id,customer_name,phone,service_name,date,time,amount,paid_amount,paid_at,status,created_at,booking_id")
      .order("date", { ascending: true }).order("time", { ascending: true }).limit(5000)
      .then(({ data }) => setOrders(data || []));
  }, []);

  const s = useMemo(() => {
    if (!orders) return null;
    const live = orders.filter((o) => o.status !== "已取消");
    const tw = (ts) => (ts ? twDate(0, new Date(ts)) : "");
    const count = (st) => live.filter((o) => o.status === st).length;
    const monthOrders = live.filter((o) => o.date && String(o.date) >= monthStart && String(o.date) <= rangeOf("month")[1]);
    const perService = {};
    monthOrders.forEach((o) => { perService[o.service_name] = (perService[o.service_name] || 0) + 1; });
    return {
      todayShoots: live.filter((o) => String(o.date) === today && ["待付款", "已付款", "已預約"].includes(o.status)).length,
      todayNew: live.filter((o) => tw(o.created_at) === today).length,
      pendingPay: count("待付款"),
      paid: count("已付款") + count("已預約"),
      toSelect: count("待選片"),
      selected: count("客戶已選片"),
      retouching: count("修圖中"),
      todayRevenue: live.filter((o) => tw(o.paid_at) === today).reduce((a, o) => a + (o.paid_amount || o.amount || 0), 0),
      monthRevenue: live.filter((o) => tw(o.paid_at) >= monthStart).reduce((a, o) => a + (o.paid_amount || o.amount || 0), 0),
      monthBookings: monthOrders.length,
      monthDone: monthOrders.filter((o) => o.status === "已完成").length,
      perService: Object.entries(perService).sort((a, b) => b[1] - a[1]),
    };
  }, [orders, today, monthStart]);

  if (!s) return <Spinner />;
  const [rs, re] = rangeOf(range);
  const schedule = orders.filter((o) => o.status !== "已取消" && o.date && String(o.date) >= rs && String(o.date) <= re);
  const maxSvc = Math.max(1, ...s.perService.map(([, n]) => n));
  const goStatus = (st) => nav(`/admin/orders?status=${encodeURIComponent(st)}`);

  const kpis = [
    ["今日拍攝", s.todayShoots, () => setRange("today")],
    ["今日新增訂單", s.todayNew, () => nav("/admin/orders")],
    ["待付款", s.pendingPay, () => goStatus("待付款"), true],
    ["已付款待拍攝", s.paid, () => goStatus("已付款")],
    ["待選片", s.toSelect, () => goStatus("待選片")],
    ["客戶已選片", s.selected, () => goStatus("客戶已選片"), true],
    ["修圖中", s.retouching, () => goStatus("修圖中")],
    ["今日營業額", money(s.todayRevenue)],
  ];

  return (
    <>
      <div className="admin-head">
        <div><div className="kicker">Operations</div><h1>營運中心</h1><p className="small muted">{fmtDate(today)}</p></div>
        <div className="flex flex-wrap">
          <Link className="btn btn-sm" to="/admin/bookings?new=1">＋ 新增預約</Link>
          <Link className="btn btn-ghost btn-sm" to="/admin/orders">訂單</Link>
          <Link className="btn btn-ghost btn-sm" to="/admin/customers">客戶</Link>
          <Link className="btn btn-ghost btn-sm" to="/admin/content">網站內容</Link>
        </div>
      </div>

      <div className="kpis mb-3">
        {kpis.map(([label, value, onClick, hl]) => {
          const Tag = onClick ? "button" : "div";
          return <Tag key={label} className={`kpi ${hl && value ? "hl" : ""}`} onClick={onClick}><div className="label">{label}</div><div className="value">{value}</div></Tag>;
        })}
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="flex between mb-2">
            <h3 style={{ margin: 0 }}>拍攝行程</h3>
            <div className="seg">{RANGES.map(([k, l]) => <button key={k} className={range === k ? "on" : ""} onClick={() => setRange(k)}>{l}</button>)}</div>
          </div>
          {schedule.length === 0 ? <div className="empty">這段期間沒有行程</div> : (
            <div className="sched">
              {schedule.map((o) => (
                <div key={o.id} className="sched-item" onClick={() => nav(`/admin/orders/${o.id}`)}>
                  <div><b>{o.time}</b><div className="small muted">{fmtDate(o.date)}</div></div>
                  <div><b>{o.customer_name}</b>　<span className="small muted">{o.service_name}｜{o.phone}</span></div>
                  <StatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="panel">
            <h3>待處理事項</h3>
            <div className="list">
              {[["待付款", s.pendingPay, "確認收款"], ["待選片", s.toSelect, "等待客戶選片"], ["客戶已選片", s.selected, "可以開始修圖"], ["修圖中", s.retouching, "完成後上傳交件"]].map(([st, n, hint]) => (
                <button key={st} className="row-card" style={{ textAlign: "left" }} onClick={() => goStatus(st)}>
                  <span><StatusBadge status={st} />　<span className="small muted">{hint}</span></span>
                  <b style={{ fontSize: 18 }}>{n}</b>
                </button>
              ))}
            </div>
          </div>
          <div className="panel">
            <h3>本月統計</h3>
            <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div><div className="small muted">營業額</div><div style={{ fontFamily: "var(--display)", fontSize: 22 }}>{money(s.monthRevenue)}</div></div>
              <div><div className="small muted">預約數</div><div style={{ fontFamily: "var(--display)", fontSize: 22 }}>{s.monthBookings}</div></div>
              <div><div className="small muted">已完成</div><div style={{ fontFamily: "var(--display)", fontSize: 22 }}>{s.monthDone}</div></div>
            </div>
            <div className="small muted mt-3 mb-2">各服務訂單數（本月拍攝日）</div>
            {s.perService.length === 0 ? <div className="small muted">本月尚無訂單</div> : (
              <div className="bars" role="table" aria-label="本月各服務訂單數">
                {s.perService.map(([name, n]) => (
                  <div className="bar-row" key={name} role="row" title={`${name}：${n} 筆`}>
                    <span role="cell">{name}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(n / maxSvc) * 100}%` }} /></div>
                    <b role="cell" style={{ textAlign: "right" }}>{n}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
