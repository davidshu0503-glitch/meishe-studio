// =====================================================================
//  即美創畫攝影｜LINE 官方帳號 Webhook
//  Supabase Edge Function：line-webhook
//
//  功能：
//   • 客戶加入好友 → 自動回覆綁定說明
//   • 客戶傳「綁定 預約編號 電話」→ 自動綁定 LINE，之後預約/選片/交件通知都會推播到 LINE
//   • 傳「我的ID」→ 回覆自己的 LINE userId（工作室設定 LINE_ADMIN_USER_IDS 用）
//
//  需要的環境變數：LINE_CHANNEL_SECRET、LINE_CHANNEL_ACCESS_TOKEN、SITE_URL
//  LINE Developers → Messaging API → Webhook URL 填：
//    https://<您的專案>.supabase.co/functions/v1/line-webhook
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const enc = new TextEncoder();

async function validSignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  const expected = btoa(String.fromCharCode(...mac));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function reply(replyToken: string, text: string) {
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token || !replyToken) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

const digits = (s: string) => (s || "").replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const raw = await req.text();
  const secret = Deno.env.get("LINE_CHANNEL_SECRET") || "";
  if (!secret || !(await validSignature(raw, req.headers.get("x-line-signature"), secret))) {
    return new Response("invalid signature", { status: 401 });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: st } = await db.from("settings").select("value").eq("key", "studio").maybeSingle();
  const studio: any = st?.value || {};
  const studioName = studio.name || "即美創畫攝影";
  const siteUrl = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");

  const howTo = `請傳送以下格式完成綁定，之後預約、選片、交件通知都會直接傳到 LINE：\n\n綁定 預約編號 電話\n例如：綁定 GS260924-AB12 0912345678`;

  let payload: any = {};
  try { payload = JSON.parse(raw); } catch { return new Response("ok"); }

  for (const ev of payload.events || []) {
    const userId = ev.source?.userId;
    if (ev.type === "follow") {
      await reply(ev.replyToken, `歡迎加入 ${studioName} GIME STUDIO • PHOTO × AI 🌿\n\n${howTo}\n\n線上預約：${siteUrl}/booking`);
      continue;
    }
    if (ev.type !== "message" || ev.message?.type !== "text" || !userId) continue;
    const text: string = (ev.message.text || "").trim();

    if (/^(我的\s*id|my\s*id|userid)$/i.test(text)) {
      await reply(ev.replyToken, `您的 LINE userId：\n${userId}`);
      continue;
    }

    const code = text.toUpperCase().match(/(GS|OD)\d{6}-[A-Z0-9]{4}/)?.[0];
    if (/綁定|bind/i.test(text) || code) {
      const phone = digits(text.replace(code || "", ""));
      if (!code || phone.length < 8) { await reply(ev.replyToken, howTo); continue; }

      let customerId: string | null = null, orderPhone = "";
      if (code.startsWith("GS")) {
        const { data } = await db.from("bookings").select("customer_id, phone").eq("id", code).maybeSingle();
        customerId = data?.customer_id ?? null; orderPhone = data?.phone ?? "";
      } else {
        const { data } = await db.from("orders").select("customer_id, phone").eq("id", code).maybeSingle();
        customerId = data?.customer_id ?? null; orderPhone = data?.phone ?? "";
      }
      let ok = false;
      if (customerId) {
        const { data: c } = await db.from("customers").select("id, name, phone").eq("id", customerId).maybeSingle();
        if (c && (digits(c.phone) === phone || digits(orderPhone) === phone)) {
          await db.from("customers").update({ line_user_id: userId }).eq("id", c.id);
          await reply(ev.replyToken, `${c.name} 您好，LINE 綁定成功 ✅\n之後的預約提醒、選片與交件通知都會傳到這裡。`);
          ok = true;
        }
      }
      if (!ok) await reply(ev.replyToken, `查無符合的預約資料，請確認編號與預約時填寫的電話是否正確。\n如需協助請來電 ${studio.phone || ""}`);
      continue;
    }

    await reply(ev.replyToken, `感謝您的訊息！我們會盡快回覆您 🙏\n\n線上預約：${siteUrl}/booking\n線上選片：${siteUrl}/gallery\n電話：${studio.phone || ""}\n\n想收到 LINE 通知？${howTo}`);
  }
  return new Response("ok");
});
