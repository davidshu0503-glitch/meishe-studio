import { useEffect, useState } from "react";
import { errMsg, supabase } from "../../lib/supabase";
import { useSite } from "../../lib/site";
import { NOTIFY_STATUS } from "../../lib/utils";
import { useToast } from "../../components/ui";
import { lineOaId } from "../../components/LineBind";

const TONE = { sent: "ok", failed: "danger", skipped: "muted", queued: "warn", sending: "warn" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mask = (id) => (id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);
const ids = (n) => String(n?.line_admin_ids || "").split(",").map((s) => s.trim()).filter(Boolean);

async function loadNotify() {
  const { data } = await supabase.from("settings").select("value").eq("key", "notify").maybeSingle();
  return data?.value || {};
}
async function patchNotify(patch) {
  const cur = await loadNotify();
  return supabase.from("settings").upsert({ key: "notify", value: { ...cur, ...patch }, is_public: false });
}

/**
 * 工作室 LINE 綁定 + 測試通知
 * 1. 按「綁定我的 LINE」→ 產生 6 位數綁定碼（30 分鐘有效）
 * 2. 用手機掃 QR／按按鈕，對官方帳號傳「工作室綁定 123456」→ 自動加入通知名單
 * 3. 按「傳送測試通知」→ 同時寄出 Email 與 LINE，畫面顯示結果
 */
export default function StudioNotify({ email, onSaveFirst }) {
  const toast = useToast();
  const { studio } = useSite();
  const oa = lineOaId(studio);
  const [list, setList] = useState([]);
  const [code, setCode] = useState("");
  const [qr, setQr] = useState("");
  const [test, setTest] = useState(null); // null | { running, rows }

  const refresh = async () => {
    const n = await loadNotify();
    setList(ids(n));
    return n;
  };
  useEffect(() => { refresh(); }, []);

  const text = code ? `工作室綁定 ${code}` : "";
  const sendUrl = oa && text ? `https://line.me/R/oaMessage/${encodeURIComponent(oa)}/?${encodeURIComponent(text)}` : "";
  useEffect(() => {
    if (!sendUrl) return setQr("");
    let alive = true;
    import("qrcode").then((QR) => QR.toDataURL(sendUrl, { margin: 1, width: 220 })).then((u) => alive && setQr(u)).catch(() => {});
    return () => { alive = false; };
  }, [sendUrl]);

  // 等待綁定：每 4 秒檢查一次，綁好就自動收起
  useEffect(() => {
    if (!code) return;
    const before = list.length;
    let alive = true;
    (async () => {
      for (let i = 0; i < 75 && alive; i++) {
        await sleep(4000);
        if (!alive) return;
        const n = await refresh();
        if (ids(n).length > before) { setCode(""); toast("LINE 綁定成功，之後新預約會同時通知 LINE 與 Email"); return; }
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const startBind = async () => {
    const c = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await patchNotify({ admin_bind_code: c, admin_bind_expires: new Date(Date.now() + 30 * 60000).toISOString() });
    if (error) return toast(errMsg(error), "err");
    setCode(c);
  };

  const remove = async (id) => {
    const n = await loadNotify();
    const { error } = await patchNotify({ line_admin_ids: ids(n).filter((x) => x !== id).join(",") });
    if (error) return toast(errMsg(error), "err");
    refresh(); toast("已移除");
  };

  const runTest = async () => {
    await onSaveFirst?.();
    setTest({ running: true, rows: [] });
    const { data: ref, error } = await supabase.rpc("admin_send_test_notification");
    if (error) { setTest(null); return toast(errMsg(error), "err"); }
    await supabase.functions.invoke("send-notifications", { body: {} }).catch(() => {});
    let rows = [];
    for (let i = 0; i < 8; i++) {
      const { data } = await supabase.from("notifications").select("channel,status,recipient,error").eq("ref_id", ref).order("channel");
      rows = data || [];
      if (rows.length && rows.every((r) => !["queued", "sending"].includes(r.status))) break;
      await sleep(1500);
    }
    setTest({ running: false, rows });
  };

  const tip = (r) => {
    if (r.status === "sent") return r.channel === "email" ? `已寄到 ${r.recipient}，請到信箱查看（也看一下垃圾郵件）` : "已傳到您的 LINE，請打開 LINE 查看";
    if (/RESEND_API_KEY/.test(r.error)) return "還沒設定 Email 寄信金鑰：Supabase → Edge Functions → Secrets 加上 RESEND_API_KEY";
    if (/LINE_CHANNEL_ACCESS_TOKEN/.test(r.error)) return "還沒設定 LINE 金鑰：Supabase → Edge Functions → Secrets 加上 LINE_CHANNEL_ACCESS_TOKEN";
    if (/綁定工作室 LINE|LINE_ADMIN/.test(r.error)) return "還沒綁定工作室 LINE：按上方「綁定我的 LINE」";
    if (/沒有收件/.test(r.error)) return "還沒填工作室收件 Email";
    if (/Resend 403/.test(r.error)) return "Resend 拒絕寄送：未驗證網域時只能寄到 Resend 帳號本人的信箱，請到 Resend 驗證網域並設定 MAIL_FROM";
    if (/LINE 400|LINE 403/.test(r.error)) return "LINE 拒絕傳送：請確認已加官方帳號好友且沒有封鎖";
    if (r.status === "queued" || r.status === "sending") return "還在排隊，可能是寄送功能沒有部署，請到「通知中心」稍後查看";
    return r.error;
  };

  return (
    <div className="studio-notify">
      <div className="field">
        <label>工作室 LINE（接收新預約通知）</label>
        {list.length === 0 ? <div className="small muted">尚未綁定，新預約目前只會寄 Email。</div> : (
          <div className="flex flex-wrap">{list.map((id) => (
            <span key={id} className="chip" title={id} style={/^U[0-9a-f]{32}$/i.test(id) ? undefined : { borderColor: "var(--danger, #b3412e)", color: "var(--danger, #b3412e)" }}>{/^U[0-9a-f]{32}$/i.test(id) ? `LINE ${mask(id)}` : `${id}（不是 LINE userId，收不到，請移除後按綁定）`}<button onClick={() => remove(id)} aria-label="移除">×</button></span>
          ))}</div>
        )}
        <div className="flex flex-wrap mt-1">
          <button className="btn btn-sm btn-line" type="button" onClick={startBind}>{list.length ? "再綁定一位" : "綁定我的 LINE"}</button>
          <button className="btn btn-sm btn-ghost" type="button" onClick={runTest} disabled={test?.running}>{test?.running ? "測試中…" : "傳送測試通知（LINE＋Email）"}</button>
        </div>
      </div>

      {code && (
        <div className="line-bind hl">
          <div className="line-bind-main">
            <b><span className="line-dot" aria-hidden="true" />用您自己的 LINE 傳送綁定碼</b>
            {oa ? (
              <>
                <p>手機：按下方按鈕（會打開 LINE，訊息已填好，按「傳送」）。電腦：用手機掃下方 QR Code。若還沒加 {oa} 好友，請先加好友。</p>
                <div className="flex flex-wrap">
                  <a className="btn btn-sm btn-line-ghost" href={`https://line.me/R/ti/p/${encodeURIComponent(oa)}`} target="_blank" rel="noreferrer">① 加入 {oa} 好友</a>
                  <a className="btn btn-sm btn-line" href={sendUrl} target="_blank" rel="noreferrer">② 傳送綁定碼</a>
                </div>
              </>
            ) : <p>請先在「工作室資訊」填 LINE 官方帳號 ID；或直接對官方帳號傳送下面這段文字：</p>}
            <p className="small muted">綁定訊息：<code className="line-text">{text}</code>（30 分鐘內有效，用過即失效）。綁定成功後這裡會自動更新。</p>
          </div>
          {qr && <div className="line-qr"><img src={qr} alt="用手機掃描傳送綁定碼" width="132" height="132" /><span className="small muted">用手機掃描</span></div>}
        </div>
      )}

      {test && !test.running && (
        <div className="card small mt-1">
          <b>測試結果</b>
          {test.rows.length === 0 && <div className="muted">沒有產生測試通知，請確認已執行 07-studio-notify.sql。</div>}
          {test.rows.map((r) => (
            <div key={r.channel} className="flex" style={{ alignItems: "baseline", marginTop: 6 }}>
              <span style={{ minWidth: 44 }}>{r.channel === "email" ? "Email" : "LINE"}</span>
              <span className={`badge ${TONE[r.status] || ""}`}>{NOTIFY_STATUS[r.status] || r.status}</span>
              <span className="muted">{tip(r)}</span>
            </div>
          ))}
          {!email && <div className="muted mt-1">提醒：工作室收件 Email 還沒填。</div>}
        </div>
      )}
    </div>
  );
}
