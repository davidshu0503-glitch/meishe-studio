import { useEffect, useState } from "react";
import { useSite } from "../lib/site";

/** 把後台填的官方帳號 ID 整理成 @xxxx 格式 */
export function lineOaId(studio) {
  const raw = String(studio?.line_oa_id || "").trim();
  if (!raw) return "";
  return raw.startsWith("@") ? raw : `@${raw}`;
}

/** 加入官方帳號好友的連結：手機會直接打開 LINE，電腦會顯示 QR Code 頁 */
export function lineAddUrl(studio) {
  const oa = lineOaId(studio);
  return oa ? `https://line.me/R/ti/p/${encodeURIComponent(oa)}` : studio?.line_url || "";
}

/** 綁定訊息：LINE 官方帳號收到後會自動綁定（見 supabase/functions/line-webhook） */
export const bindText = (code, phone) => `綁定 ${code} ${String(phone || "").replace(/\D/g, "")}`;

/**
 * LINE 自動通知綁定：
 * 1. 加入官方帳號好友
 * 2. 點按鈕開啟 LINE，綁定訊息已自動填好，按「傳送」即完成
 * 電腦版顯示 QR Code，用手機掃描即可。
 */
export default function LineBind({ code, phone, compact = false, highlight = false }) {
  const { studio } = useSite();
  const oa = lineOaId(studio);
  const text = bindText(code, phone);
  const sendUrl = oa ? `https://line.me/R/oaMessage/${encodeURIComponent(oa)}/?${encodeURIComponent(text)}` : "";
  const addUrl = oa ? `https://line.me/R/ti/p/${encodeURIComponent(oa)}` : studio?.line_url || "";
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sendUrl || compact) return;
    let alive = true;
    import("qrcode").then((QR) => QR.toDataURL(sendUrl, { margin: 1, width: 220 })).then((u) => alive && setQr(u)).catch(() => {});
    return () => { alive = false; };
  }, [sendUrl, compact]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* 無法複製時使用者可手動選取 */ }
  };

  if (!code || !phone) return null;

  // 工作室還沒設定官方帳號 ID：只顯示文字說明
  if (!oa) {
    return (
      <div className={`line-bind ${compact ? "compact" : ""}`}>
        <b>想用 LINE 收到通知？</b>
        <p>加入工作室 LINE 官方帳號{addUrl && <>（<a href={addUrl} target="_blank" rel="noreferrer">點此加入</a>）</>}後，傳送：</p>
        <code className="line-text" onClick={copy}>{text}</code>
        <span className="small muted">{copied ? "已複製" : "點一下可複製"}</span>
      </div>
    );
  }

  return (
    <div className={`line-bind ${compact ? "compact" : ""} ${highlight ? "hl" : ""}`}>
      <div className="line-bind-main">
        <b><span className="line-dot" aria-hidden="true" />開啟 LINE 自動通知</b>
        <p>綁定後，訂金確認、拍攝前一天提醒、選片與交件通知都會自動傳到您的 LINE。</p>
        <ol className="line-steps">
          <li><a className="btn btn-sm btn-line-ghost" href={addUrl} target="_blank" rel="noreferrer">① 加入 {oa} 好友</a></li>
          <li><a className="btn btn-sm btn-line" href={sendUrl} target="_blank" rel="noreferrer">② 一鍵傳送綁定訊息</a></li>
        </ol>
        <p className="small muted">按②會打開 LINE，訊息已經自動填好，只要按「傳送」。也可以手動傳送：<code className="line-text" onClick={copy} title="點一下複製">{text}</code>{copied && <span className="small"> 已複製</span>}</p>
      </div>
      {!compact && qr && (
        <div className="line-qr">
          <img src={qr} alt="用手機掃描，開啟 LINE 綁定" width="132" height="132" />
          <span className="small muted">用電腦預約？<br />用手機掃描完成綁定</span>
        </div>
      )}
    </div>
  );
}
