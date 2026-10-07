import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSite } from "../lib/site";
import { useAuth } from "../lib/auth";
import { errMsg, kickNotifications, supabase } from "../lib/supabase";
import { addDays, fmtDate, money, normPhone, twDate, WEEKDAYS, weekday } from "../lib/utils";
import { Field, PageHero, useTitle } from "../components/ui";

const STEPS = ["選擇服務", "選擇時段", "填寫資料", "確認送出"];

function Calendar({ month, setMonth, min, max, selected, onSelect, isDisabled, isFull }) {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = weekday(first);
  const prevMonth = addDays(first, -1).slice(0, 7);
  const nextMonth = addDays(first, daysInMonth).slice(0, 7);
  return (
    <div>
      <div className="cal-head">
        <button className="btn btn-ghost btn-sm" disabled={prevMonth < min.slice(0, 7)} onClick={() => setMonth(prevMonth)} aria-label="上個月">‹</button>
        <b>{y} 年 {m} 月</b>
        <button className="btn btn-ghost btn-sm" disabled={nextMonth > max.slice(0, 7)} onClick={() => setMonth(nextMonth)} aria-label="下個月">›</button>
      </div>
      <div className="cal">
        {WEEKDAYS.map((w) => <div className="wd" key={w}>{w}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, "0")}`;
          const off = d < min || d > max || isDisabled(d);
          const full = !off && isFull(d);
          return (
            <button key={d} disabled={off || full} className={`${selected === d ? "on" : ""} ${full ? "full" : ""}`}
              onClick={() => onSelect(d)} aria-label={`${d}${full ? " 已額滿" : ""}`}>{i + 1}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function Booking() {
  useTitle("線上預約");
  const { services, booking: cfg, online } = useSite();
  const { customer, user } = useAuth();
  const [params] = useSearchParams();
  const bookable = services.filter((s) => s.bookable);

  const tomorrow = twDate(1);
  const maxDate = twDate(Number(cfg.max_days_ahead || 90));
  const [step, setStep] = useState(1);
  const [month, setMonth] = useState(tomorrow.slice(0, 7));
  const [booked, setBooked] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [form, setForm] = useState({
    serviceId: params.get("service") || "", date: "", time: "", name: "", phone: "",
    contactMethod: "email", email: "", lineId: "", note: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (params.get("service") && bookable.some((s) => s.id === params.get("service"))) setStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (customer) setForm((f) => ({ ...f, name: f.name || customer.name || "", phone: f.phone || customer.phone || "", email: f.email || customer.email || user?.email || "", lineId: f.lineId || customer.line_id || "" }));
  }, [customer, user]);

  const loadSlots = async () => {
    const [{ data: b }, { data: bl }] = await Promise.all([
      supabase.rpc("get_booked_slots", { p_from: tomorrow, p_to: maxDate }),
      supabase.from("blocked_dates").select("date"),
    ]);
    setBooked(b || []);
    setBlocked((bl || []).map((r) => r.date));
  };
  useEffect(() => { loadSlots().catch(() => {}); /* eslint-disable-next-line */ }, []);

  const slots = cfg.slots || [];
  const closed = cfg.closed_weekdays || [];
  const takenOn = (d) => new Set(booked.filter((b) => b.date === d).map((b) => b.time));
  const isDisabled = (d) => closed.includes(weekday(d)) || blocked.includes(d);
  const isFull = (d) => slots.every((t) => takenOn(d).has(t));
  const service = bookable.find((s) => s.id === form.serviceId);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };

  const validateInfo = () => {
    const e = {};
    if (!form.name.trim()) e.name = "請填寫姓名";
    const p = normPhone(form.phone);
    if (p.length < 8 || p.length > 15) e.phone = "請填寫正確的電話號碼";
    if (form.contactMethod === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = "請填寫正確的 Email";
    if (form.contactMethod === "line" && !form.lineId.trim()) e.lineId = "請填寫 LINE ID";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setSubmitting(true); setSubmitError("");
    const { data, error } = await supabase.rpc("create_booking", {
      p_service_id: form.serviceId, p_date: form.date, p_time: form.time, p_name: form.name.trim(), p_phone: form.phone.trim(),
      p_contact_method: form.contactMethod, p_email: form.contactMethod === "email" ? form.email.trim() : (form.email.trim() || null),
      p_line_id: form.contactMethod === "line" ? form.lineId.trim() : null, p_note: form.note.trim(),
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(errMsg(error));
      if (/時段/.test(error.message)) { await loadSlots(); }
      return;
    }
    kickNotifications();
    setDone(data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const gcal = useMemo(() => {
    if (!done) return "";
    const start = `${String(done.date).replace(/-/g, "")}T${done.time.replace(":", "")}00`;
    const [hh, mm] = done.time.split(":").map(Number);
    const end = `${String(done.date).replace(/-/g, "")}T${String(hh + 1).padStart(2, "0")}${String(mm).padStart(2, "0")}00`;
    const q = new URLSearchParams({ action: "TEMPLATE", text: `即美創畫攝影｜${done.service}`, dates: `${start}/${end}`, ctz: "Asia/Taipei", details: `預約編號 ${done.booking_id}` });
    return `https://calendar.google.com/calendar/render?${q}`;
  }, [done]);

  if (done) {
    return (
      <>
        <PageHero eyebrow="Thank you" title="預約成功" />
        <section className="section-tight">
          <div className="wrap">
            <div className="card ticket">
              <div className="kicker">預約編號</div>
              <div className="code">{done.booking_id}</div>
              <p className="muted small">訂單編號 {done.order_id}（選片、查詢時使用，請妥善保存）</p>
              <dl className="mt-3" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 18px", textAlign: "left", maxWidth: 360, margin: "24px auto" }}>
                <dt className="muted">服務</dt><dd style={{ margin: 0 }}>{done.service}</dd>
                <dt className="muted">時間</dt><dd style={{ margin: 0 }}>{fmtDate(done.date)} {done.time}</dd>
                <dt className="muted">費用</dt><dd style={{ margin: 0 }}>{money(done.amount)}</dd>
                <dt className="muted">姓名</dt><dd style={{ margin: 0 }}>{done.name}</dd>
              </dl>
              {cfg.payment_info && <div className="alert alert-info" style={{ textAlign: "left", whiteSpace: "pre-line" }}><b>付款方式</b><br />{cfg.payment_info}</div>}
              <p className="small muted mt-2">{form.contactMethod === "email" ? `確認通知將寄至 ${form.email}。` : ""}{cfg.notice}</p>
              <div className="flex flex-wrap mt-3" style={{ justifyContent: "center" }}>
                <a className="btn btn-ghost btn-sm" href={gcal} target="_blank" rel="noreferrer">加入 Google 行事曆</a>
                <Link className="btn btn-sm" to="/">回首頁</Link>
              </div>
              <p className="small muted mt-3">想用 LINE 收到通知？加入官方帳號後傳送「綁定 {done.booking_id} {form.phone}」即可。</p>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero eyebrow="Booking" title="線上預約" sub="選擇服務與時段，送出後立即取得預約編號" />
      <section className="section-tight">
        <div className="wrap">
          {!online && <div className="alert alert-warn mb-3">預約系統連線中，若無法送出請來電預約。</div>}
          <div className="steps">
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: "flex" }}>
                {i > 0 && <div className="step-line" />}
                <div className={`step-item ${step >= i + 1 ? "on" : ""}`}><span className="dot">{i + 1}</span><span>{s}</span></div>
              </div>
            ))}
          </div>

          <div className="booking-layout">
            <div className="card">
              {step === 1 && (
                <>
                  <h3 className="title-md mb-2">選擇服務項目</h3>
                  <div className="pick-grid">
                    {bookable.map((s) => (
                      <button key={s.id} className={`pick ${form.serviceId === s.id ? "on" : ""}`} onClick={() => { set("serviceId", s.id); setStep(2); }}>
                        <span className="kicker">{s.subtitle}</span>
                        <b>{s.name}</b>
                        <span className="small muted">{s.duration_label}</span>
                        <span>{money(s.price)}<small className="muted">{s.price_note}</small></span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h3 className="title-md mb-2">選擇日期與時段</h3>
                  <Calendar month={month} setMonth={setMonth} min={tomorrow} max={maxDate} selected={form.date}
                    onSelect={(d) => { set("date", d); set("time", ""); }} isDisabled={isDisabled} isFull={isFull} />
                  {form.date && (
                    <div className="mt-3">
                      <div className="kicker mb-2">{fmtDate(form.date)} 可預約時段</div>
                      <div className="slots">
                        {slots.map((t) => {
                          const taken = takenOn(form.date).has(t);
                          return <button key={t} className={`slot ${form.time === t ? "on" : ""}`} disabled={taken} onClick={() => set("time", t)} title={taken ? "已被預約" : ""}>{t}</button>;
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex between mt-3">
                    <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>上一步</button>
                    <button className="btn btn-sm" disabled={!form.date || !form.time} onClick={() => setStep(3)}>下一步</button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h3 className="title-md mb-2">填寫聯絡資料</h3>
                  {!user && <div className="alert alert-info mb-2 small">已是會員？<Link to="/member?next=/booking" className="btn-link">登入</Link> 後可自動帶入資料並在會員中心查看預約。</div>}
                  <div className="form-grid">
                    <Field label="姓名 *" error={errors.name}><input className={`input ${errors.name ? "err" : ""}`} value={form.name} maxLength={40} onChange={(e) => set("name", e.target.value)} autoComplete="name" /></Field>
                    <Field label="電話 *" error={errors.phone} hint="用於查詢訂單與選片"><input className={`input ${errors.phone ? "err" : ""}`} value={form.phone} maxLength={20} inputMode="tel" onChange={(e) => set("phone", e.target.value)} autoComplete="tel" /></Field>
                    <Field label="偏好聯絡方式" full>
                      <div className="seg">
                        <button type="button" className={form.contactMethod === "email" ? "on" : ""} onClick={() => set("contactMethod", "email")}>Email</button>
                        <button type="button" className={form.contactMethod === "line" ? "on" : ""} onClick={() => set("contactMethod", "line")}>LINE</button>
                      </div>
                    </Field>
                    {form.contactMethod === "email" ? (
                      <Field label="Email *" error={errors.email} full><input className={`input ${errors.email ? "err" : ""}`} type="email" value={form.email} maxLength={120} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></Field>
                    ) : (
                      <>
                        <Field label="LINE ID *" error={errors.lineId}><input className={`input ${errors.lineId ? "err" : ""}`} value={form.lineId} maxLength={60} onChange={(e) => set("lineId", e.target.value)} /></Field>
                        <Field label="Email（選填，接收通知信）"><input className="input" type="email" value={form.email} maxLength={120} onChange={(e) => set("email", e.target.value)} /></Field>
                      </>
                    )}
                    <Field label="備註" full hint="拍攝需求、人數、想要的風格…"><textarea className="textarea" value={form.note} maxLength={500} onChange={(e) => set("note", e.target.value)} /></Field>
                  </div>
                  <div className="flex between mt-3">
                    <button className="btn btn-ghost btn-sm" onClick={() => setStep(2)}>上一步</button>
                    <button className="btn btn-sm" onClick={() => validateInfo() && setStep(4)}>下一步</button>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <h3 className="title-md mb-2">確認預約內容</h3>
                  <dl style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "10px 16px" }}>
                    <dt className="muted">服務項目</dt><dd style={{ margin: 0 }}>{service?.name}（{money(service?.price)}{service?.price_note}）</dd>
                    <dt className="muted">拍攝時間</dt><dd style={{ margin: 0 }}>{fmtDate(form.date)} {form.time}</dd>
                    <dt className="muted">姓名</dt><dd style={{ margin: 0 }}>{form.name}</dd>
                    <dt className="muted">電話</dt><dd style={{ margin: 0 }}>{form.phone}</dd>
                    <dt className="muted">{form.contactMethod === "email" ? "Email" : "LINE ID"}</dt><dd style={{ margin: 0 }}>{form.contactMethod === "email" ? form.email : form.lineId}</dd>
                    {form.note && <><dt className="muted">備註</dt><dd style={{ margin: 0, whiteSpace: "pre-line" }}>{form.note}</dd></>}
                  </dl>
                  {cfg.notice && <p className="small muted mt-2">{cfg.notice}</p>}
                  {submitError && <div className="alert alert-err mt-2">{submitError}</div>}
                  <div className="flex between mt-3">
                    <button className="btn btn-ghost btn-sm" onClick={() => setStep(submitError && /時段/.test(submitError) ? 2 : 3)}>上一步</button>
                    <button className="btn btn-accent" disabled={submitting} onClick={submit}>{submitting ? "送出中…" : "確認送出預約"}</button>
                  </div>
                </>
              )}
            </div>

            <aside className="card summary">
              <div className="kicker">預約摘要</div>
              <dl>
                <dt>服務</dt><dd>{service?.name || "—"}</dd>
                <dt>日期</dt><dd>{form.date ? fmtDate(form.date) : "—"}</dd>
                <dt>時段</dt><dd>{form.time || "—"}</dd>
                <dt>費用</dt><dd>{service ? money(service.price) : "—"}</dd>
              </dl>
              <p className="small muted">同一時段只接受一組預約，已被預約的時段會自動停用。</p>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
