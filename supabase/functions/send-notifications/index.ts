// =====================================================================
//  即美創畫攝影｜自動寄送通知（Email + LINE）
//  Supabase Edge Function：send-notifications
//
//  需要的環境變數（Supabase 後台 → Edge Functions → Secrets）：
//    RESEND_API_KEY            Resend 的 API Key（寄 Email 用）
//    MAIL_FROM                 寄件者，例如：即美創畫攝影 <noreply@你的網域>
//                              （未設定時使用 onboarding@resend.dev，僅能寄給自己的 Resend 帳號信箱）
//    LINE_CHANNEL_ACCESS_TOKEN LINE 官方帳號 Messaging API 的 Channel access token
//    LINE_ADMIN_USER_IDS       要接收工作室通知的 LINE userId（多個用逗號分隔）
//    SITE_URL                  網站網址，例如 https://www.gime160.com
//  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由 Supabase 自動提供。
//
//  沒有設定某個管道的金鑰時，該管道的通知會標記為「略過」，不會出錯。
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  booking_created: { subject: "【{{studio_name}}】預約成功 {{booking_id}}", body: "{{name}} 您好，\n\n您的預約已完成。\n預約編號：{{booking_id}}\n服務項目：{{service}}\n拍攝時間：{{date}} {{time}}\n\n{{studio_name}}" },
  booking_cancelled: { subject: "【{{studio_name}}】預約已取消", body: "{{name}} 您好，您 {{date}} {{time}} 的預約已取消。\n\n{{studio_name}}" },
  payment_received: { subject: "【{{studio_name}}】已收到款項", body: "{{name}} 您好，已收到訂單 {{order_id}} 的款項，謝謝您！" },
  album_ready: { subject: "【{{studio_name}}】可以選片了", body: "{{name}} 您好，照片已上傳，請至 {{site_url}}/gallery?order={{order_id}} 選片。" },
  selection_done: { subject: "【{{studio_name}}】已收到選片", body: "{{name}} 您好，已收到您選的 {{selected_count}} 張照片。" },
  retouch_started: { subject: "【{{studio_name}}】照片修圖中", body: "{{name}} 您好，您的照片已開始修圖。" },
  delivered: { subject: "【{{studio_name}}】照片已完成", body: "{{name}} 您好，精修照片已完成，請至 {{site_url}}/gallery?order={{order_id}} 下載。" },
  shoot_reminder: { subject: "【{{studio_name}}】明天拍攝提醒", body: "{{name}} 您好，提醒您明天 {{date}} {{time}} 有拍攝預約。" },
};

function render(tpl: string, vars: Record<string, unknown>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

async function sendEmail(to: string, subject: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { skipped: "尚未設定 RESEND_API_KEY" };
  const from = Deno.env.get("MAIL_FROM") || "GIME STUDIO <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { ok: true };
}

async function sendLine(to: string, text: string) {
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) return { skipped: "尚未設定 LINE_CHANNEL_ACCESS_TOKEN" };
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  });
  if (!res.ok) throw new Error(`LINE ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: settingsRows } = await db.from("settings").select("key,value").in("key", ["studio", "notify", "templates"]);
  const settings: Record<string, any> = Object.fromEntries((settingsRows || []).map((r: any) => [r.key, r.value]));
  const studio = settings.studio || {};
  const notify = settings.notify || {};
  const templates = { ...DEFAULT_TEMPLATES, ...(settings.templates || {}) };
  const siteUrl = (Deno.env.get("SITE_URL") || studio.site_url || "").replace(/\/$/, "");
  const adminLineIds = (Deno.env.get("LINE_ADMIN_USER_IDS") || notify.line_admin_ids || "")
    .split(",").map((s: string) => s.trim()).filter(Boolean);

  const { data: claimed, error } = await db.rpc("claim_notifications", { p_limit: 30 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const summary = { sent: 0, skipped: 0, failed: 0 };
  const customerCache = new Map<string, any>();
  const bookingCache = new Map<string, any>();

  for (const n of claimed || []) {
    let status = "sent", err = "", recipient = "";
    const vars = { ...n.payload, studio_name: studio.name || "即美創畫攝影", studio_phone: studio.phone || "", site_url: siteUrl };
    const tpl = (n.audience === "studio" && templates[`studio_${n.event}`]) || templates[n.event] || { subject: n.event, body: "" };
    let subject = render(tpl.subject, vars);
    const body = render(tpl.body, vars);
    if (n.audience === "studio" && !templates[`studio_${n.event}`]) subject = `［工作室通知］${subject}`;

    try {
      let customer: any = null, booking: any = null;
      if (n.customer_id) {
        if (!customerCache.has(n.customer_id)) {
          const { data } = await db.from("customers").select("email,line_user_id").eq("id", n.customer_id).maybeSingle();
          customerCache.set(n.customer_id, data);
        }
        customer = customerCache.get(n.customer_id);
      }
      if (n.booking_id) {
        if (!bookingCache.has(n.booking_id)) {
          const { data } = await db.from("bookings").select("email").eq("id", n.booking_id).maybeSingle();
          bookingCache.set(n.booking_id, data);
        }
        booking = bookingCache.get(n.booking_id);
      }

      let result: any;
      if (n.channel === "email") {
        recipient = n.audience === "studio" ? (notify.studio_email || studio.email || "") : (booking?.email || customer?.email || "");
        result = recipient ? await sendEmail(recipient, subject, body) : { skipped: "沒有收件 Email" };
      } else {
        if (n.audience === "studio") {
          recipient = adminLineIds.join(",");
          if (!adminLineIds.length) result = { skipped: "尚未設定工作室 LINE userId（LINE_ADMIN_USER_IDS）" };
          else { for (const id of adminLineIds) result = await sendLine(id, `${subject}\n\n${body}`); }
        } else {
          recipient = customer?.line_user_id || "";
          result = recipient ? await sendLine(recipient, `${subject}\n\n${body}`) : { skipped: "客戶尚未綁定 LINE 官方帳號" };
        }
      }
      if (result?.skipped) { status = "skipped"; err = result.skipped; }
    } catch (e) {
      status = "failed";
      err = String((e as Error)?.message || e);
    }

    summary[status as keyof typeof summary]++;
    await db.from("notifications").update({
      status, error: err, recipient, subject, body, sent_at: status === "sent" ? new Date().toISOString() : null,
    }).eq("id", n.id);
  }

  return new Response(JSON.stringify({ processed: (claimed || []).length, ...summary }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
