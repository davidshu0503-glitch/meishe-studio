import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSite } from "../lib/site";
import { useAuth } from "../lib/auth";
import { errMsg, kickNotifications, supabase } from "../lib/supabase";
import { addDays, depositDue, depositOf, fmtDate, money, normPhone, twDate, WEEKDAYS, weekday } from "../lib/utils";
import { Field, PageHero, useTitle } from "../components/ui";
import { appliesTo, calcAmount, discountLabel } from "../lib/promos";
import LineBind, { lineAddUrl } from "../components/LineBind";

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
  const { services, booking: cfg, online, promotions, studio } = useSite();
  const lineUrl = lineAddUrl(studio);
  const { customer, user } = useAuth();
  const [params] = useSearchParams();
  const bookable = services.filter((s) => s.bookable && s.tier !== "hidden");

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
  // 優惠代碼：從活動連結帶入（?promo=CODE），也可以手動輸入；送出時寫進備註讓工作室看到
  const [promoCode, setPromoCode] = useState((params.get("promo") || "").toUpperCase());
  const [promoInput, setPromoInput] = useState("");
  const [promoErr, setPromoErr] = useState("");
  const findPromo = (code) => promotions.find((p) => p.code && p.code.toUpperCase() === String(code || "").trim().toUpperCase());
  const promo = findPromo(promoCode);
  const applyCode = () => {
    if (findPromo(promoInput)) { setPromoCode(promoInput.trim().toUpperCase()); setPromoInput(""); setPromoErr(""); }
    else setPromoErr("查無此優惠代碼，或活動已結束");
  };
  const promoTag = promo ? `【優惠 ${promo.code}｜${promo.title}】` : "";
  // 試算折扣：先問資料庫（會檢查名額、適用服務），資料庫還沒升級時用同一套規則在前台試算
  const [quote, setQuote] = useState(null);
  useEffect(() => {
    if (!promo || !form.serviceId) { setQuote(null); return; }
    let alive = true;
    const svc = services.find((s) => s.id === form.serviceId);
    supabase.rpc("promo_quote", { p_code: promo.code, p_service_id: form.serviceId }).then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) {
        const ok = appliesTo(promo, form.serviceId);
        const amount = calcAmount(promo, svc?.price);
        setQuote(ok ? { ok, amount, list_price: svc?.price || 0, discount: (svc?.price || 0) - amount, legacy: true } : { ok, error: `優惠「${promo.title}」不適用於「${svc?.name}」` });
      } else setQuote(data);
    });
    return () => { alive = false; };
  }, [promo?.code, form.serviceId, services]);
  const priceFor = (s) => (promo && appliesTo(promo, s.id) ? calcAmount(promo, s.price) : s.price);
  // 預付訂金：依應付金額試算（預約成立時資料庫會再算一次）
  const svcSel = services.find((s) => s.id === form.serviceId);
  const payable = quote?.ok ? quote.amount : svcSel?.price || 0;
  const deposit = depositOf(payable, cfg);
  const due = depositDue(form.date, cfg);
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
    if (form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = "Email 格式不正確（不填也可以）";
    if (form.contactMethod === "line" && !form.lineId.trim()) e.lineId = "請填寫 LINE ID";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setSubmitting(true); setSubmitError("");
    const base = {
      p_service_id: form.serviceId, p_date: form.date, p_time: form.time, p_name: form.name.trim(), p_phone: form.phone.trim(),
      p_contact_method: form.contactMethod, p_email: form.email.trim() || null,
      p_line_id: form.contactMethod === "line" ? form.lineId.trim() : null,
    };
    const usePromo = promo && quote?.ok;
    // 有優惠代碼：交給資料庫計算折扣後金額
    let { data, error } = await supabase.rpc("create_booking", usePromo ? { ...base, p_note: form.note.trim(), p_promo_code: promo.code } : { ...base, p_note: form.note.trim() });
    // 資料庫尚未執行 05-discount.sql：改用舊方式，把代碼寫進備註，由工作室手動調整金額
    if (usePromo && error && /p_promo_code|Could not find the function|PGRST202|does not exist/i.test(error.message || "")) {
      ({ data, error } = await supabase.rpc("create_booking", { ...base, p_note: [promoTag, form.note.trim()].filter(Boolean).join("\n").slice(0, 500) }));
    }
    setSubmitting(false);
    if (error) {
      setSubmitError(errMsg(error));
      if (/時段/.test(error.message)) { await loadSlots(); }
      return;
    }
    kickNotifications();
    // 訂金以試算顯示；資料庫已依同一規則寫入訂單
    const dep = depositOf(data.amount, cfg);
    setDone({ ...data, deposit: dep, deposit_due: depositDue(data.date, cfg) });
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
              {form.contactMethod === "line" && <div className="mt-3" style={{ textAlign: "left" }}><LineBind code={done.booking_id} phone={form.phone} highlight /></div>}
              <dl className="mt-3" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 18px", textAlign: "left", maxWidth: 360, margin: "24px auto" }}>
                <dt className="muted">服務</dt><dd style={{ margin: 0 }}>{done.service}</dd>
                <dt className="muted">時間</dt><dd style={{ margin: 0 }}>{fmtDate(done.date)} {done.time}</dd>
                <dt className="muted">費用</dt><dd style={{ margin: 0 }}>{money(done.amount)}{done.discount > 0 && <div className="small muted">原價 <s>{money(done.list_price)}</s>｜{done.promo_title || "優惠"}折抵 {money(done.discount)}</div>}</dd>
                <dt className="muted">姓名</dt><dd style={{ margin: 0 }}>{done.name}</dd>
              </dl>
              {done.deposit > 0 ? (
                <div className="deposit-box">
                  <div className="kicker">預付訂金</div>
                  <div className="deposit-amt">{money(done.deposit)}</div>
                  <p>請於 <b>{fmtDate(done.deposit_due)}</b> 前完成付款，以確認預約。尾款 {money(done.amount - done.deposit)} 於拍攝當天支付。</p>
                  {cfg.payment_info && <div className="deposit-info"><b>付款方式</b><br />{cfg.payment_info}</div>}
                  <p className="small muted">付款後請保留轉帳紀錄，工作室確認收到訂金後會通知您。</p>
                  {cfg.deposit?.policy && <div className="small muted" style={{ whiteSpace: "pre-line", marginTop: 8 }}><b>訂金說明</b><br />{cfg.deposit.policy}</div>}
                </div>
              ) : cfg.payment_info && <div className="alert alert-info" style={{ textAlign: "left", whiteSpace: "pre-line" }}><b>付款方式</b><br />{cfg.payment_info}</div>}
              <p className="small muted mt-2">{form.email.trim() ? `確認通知將寄至 ${form.email.trim()}。` : ""}{cfg.notice}</p>
              <div className="flex flex-wrap mt-3" style={{ justifyContent: "center" }}>
                <a className="btn btn-ghost btn-sm" href={gcal} target="_blank" rel="noreferrer">加入 Google 行事曆</a>
                <Link className="btn btn-sm" to="/">回首頁</Link>
              </div>
              {form.contactMethod !== "line" && <div className="mt-3" style={{ textAlign: "left" }}><LineBind code={done.booking_id} phone={form.phone} /></div>}
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
              {promo && step < 4 && (
                <div className="promo-applied">
                  <span className="promo-code">優惠 <b>{promo.code}</b></span>
                  {discountLabel(promo) && <span className="promo-badge">{discountLabel(promo)}</span>}
                  <span>{promo.title}{promo.subtitle && <span className="small muted">　{promo.subtitle}</span>}</span>
                  {quote && !quote.ok && <span className="err-text" style={{ flexBasis: "100%" }}>{quote.error}</span>}
                </div>
              )}
              {step === 1 && (
                <>
                  <h3 className="title-md mb-2">選擇服務項目</h3>
                  <div className="pick-grid">
                    {bookable.map((s) => (
                      <button key={s.id} className={`pick ${form.serviceId === s.id ? "on" : ""}`} onClick={() => { set("serviceId", s.id); setStep(2); }}>
                        <span className="kicker">{s.subtitle}</span>
                        <b>{s.name}</b>
                        <span className="small muted">{s.duration_label}</span>
                        {priceFor(s) !== s.price
                          ? <span><s className="muted small">{money(s.price)}</s> <b style={{ color: "var(--accent)" }}>{money(priceFor(s))}</b><small className="muted">{s.price_note}</small></span>
                          : <span>{money(s.price)}<small className="muted">{s.price_note}</small></span>}
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
                      <Field label="Email（選填）" error={errors.email} full hint="填了會收到預約確認與拍攝前一天提醒信"><input className={`input ${errors.email ? "err" : ""}`} type="email" value={form.email} maxLength={120} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></Field>
                    ) : (
                      <>
                        <Field label="LINE ID *" error={errors.lineId} hint="送出後點一下「開啟 LINE 自動通知」，之後所有通知都會自動傳到 LINE">
                          <div className="line-field">
                            <input className={`input ${errors.lineId ? "err" : ""}`} value={form.lineId} maxLength={60} onChange={(e) => set("lineId", e.target.value)} />
                            {lineUrl && (
                              <a className="btn-line-consult" href={lineUrl} target="_blank" rel="noreferrer" title="加入官方帳號好友，直接詢問">
                                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3C6.48 3 2 6.6 2 11.05c0 2.6 1.53 4.9 3.9 6.37-.17.9-.62 2.4-1.5 3.38 0 0 2.97-.24 5.08-1.9.82.17 1.66.25 2.52.25 5.52 0 10-3.6 10-8.05S17.52 3 12 3Z" /></svg>
                                LINE 諮詢
                              </a>
                            )}
                          </div>
                        </Field>
                        <Field label="Email（選填，接收通知信）"><input className="input" type="email" value={form.email} maxLength={120} onChange={(e) => set("email", e.target.value)} /></Field>
                      </>
                    )}
                    <Field label="備註" full hint="拍攝需求、人數、想要的風格…"><textarea className="textarea" value={form.note} maxLength={promo ? 440 : 500} onChange={(e) => set("note", e.target.value)} /></Field>
                    <Field label="優惠代碼（選填）" full error={promoErr}>
                      {promo ? (
                        <div className="flex flex-wrap small"><span className="promo-code">已套用 <b>{promo.code}</b></span>{promo.title}<button type="button" className="btn-link" onClick={() => setPromoCode("")}>移除</button></div>
                      ) : (
                        <div className="flex"><input className="input" value={promoInput} maxLength={30} placeholder="有優惠代碼請輸入" onChange={(e) => setPromoInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyCode()} /><button type="button" className="btn btn-ghost btn-sm" disabled={!promoInput.trim()} onClick={applyCode}>套用</button></div>
                      )}
                    </Field>
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
                    {quote?.ok && quote.discount > 0 && <><dt className="muted">優惠後金額</dt><dd style={{ margin: 0 }}><b style={{ color: "var(--accent)" }}>{money(quote.amount)}</b>　<span className="small muted">折抵 {money(quote.discount)}</span></dd></>}
                    <dt className="muted">拍攝時間</dt><dd style={{ margin: 0 }}>{fmtDate(form.date)} {form.time}</dd>
                    <dt className="muted">姓名</dt><dd style={{ margin: 0 }}>{form.name}</dd>
                    <dt className="muted">電話</dt><dd style={{ margin: 0 }}>{form.phone}</dd>
                    <dt className="muted">{form.contactMethod === "email" ? "Email" : "LINE ID"}</dt><dd style={{ margin: 0 }}>{form.contactMethod === "email" ? (form.email.trim() || "未填（以電話聯絡）") : form.lineId}</dd>
                    {deposit > 0 && <><dt className="muted">預付訂金</dt><dd style={{ margin: 0 }}><b>{money(deposit)}</b>（請於 {fmtDate(due)} 前付款）<div className="small muted">尾款 {money(payable - deposit)} 於拍攝當天支付</div></dd></>}
                    {promo && <><dt className="muted">優惠</dt><dd style={{ margin: 0 }}>{promo.title}（代碼 {promo.code}）{quote && !quote.ok ? <div className="err-text">{quote.error}，送出時不會套用</div> : quote?.legacy && <div className="small muted">折扣金額以工作室確認為準</div>}</dd></>}
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
                <dt>費用</dt><dd>{!service ? "—" : quote?.ok && quote.discount > 0
                  ? <><s className="muted small">{money(quote.list_price)}</s> <b style={{ color: "var(--accent)" }}>{money(quote.amount)}</b></>
                  : money(service.price)}</dd>
                {quote?.ok && quote.discount > 0 && <><dt>優惠</dt><dd style={{ color: "var(--accent)" }}>－{money(quote.discount)}</dd></>}
                {svcSel && deposit > 0 && <><dt>預付訂金</dt><dd><b>{money(deposit)}</b></dd><dt>尾款</dt><dd>{money(payable - deposit)}<div className="small muted">拍攝當天支付</div></dd></>}
              </dl>
              <p className="small muted">同一時段只接受一組預約，已被預約的時段會自動停用。</p>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
