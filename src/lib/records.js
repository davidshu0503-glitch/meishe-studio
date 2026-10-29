import { supabase } from "./supabase";

/**
 * 後台刪除紀錄的共用函式。
 * ・一次最多處理 200 筆，避免網址過長
 * ・所有刪除都會被資料庫自動寫進「變更紀錄」（可查誰、何時刪了什麼）
 */
const CHUNK = 200;
const chunks = (arr) => Array.from({ length: Math.ceil(arr.length / CHUNK) }, (_, i) => arr.slice(i * CHUNK, i * CHUNK + CHUNK));

async function del(table, ids, key = "id") {
  let n = 0;
  for (const part of chunks(ids)) {
    const { error } = await supabase.from(table).delete().in(key, part);
    if (error) throw error;
    n += part.length;
  }
  return n;
}

const isStoragePath = (p) => p && !/^(https?:|data:|blob:|\/)/.test(p);

/** 刪除訂單：連同相簿、照片與雲端檔案 */
export async function deleteOrders(orderIds) {
  if (!orderIds.length) return 0;
  const paths = [];
  for (const part of chunks(orderIds)) {
    const { data: albums } = await supabase.from("albums").select("id").in("order_id", part);
    const albumIds = (albums || []).map((a) => a.id);
    if (albumIds.length) {
      const { data: photos } = await supabase.from("photos").select("path,final_path").in("album_id", albumIds);
      (photos || []).forEach((p) => { if (isStoragePath(p.path)) paths.push(p.path); if (isStoragePath(p.final_path)) paths.push(p.final_path); });
    }
  }
  const n = await del("orders", orderIds);
  // 雲端檔案刪除失敗不影響資料刪除（檔案之後可在 Supabase Storage 手動清除）
  for (const part of chunks(paths)) await supabase.storage.from("albums").remove(part).catch(() => {});
  return n;
}

/** 刪除預約；withOrders 時一併刪除關聯訂單（含相簿照片） */
export async function deleteBookings(bookingIds, { withOrders = false } = {}) {
  if (!bookingIds.length) return 0;
  if (withOrders) {
    const orderIds = [];
    for (const part of chunks(bookingIds)) {
      const { data } = await supabase.from("orders").select("id").in("booking_id", part);
      (data || []).forEach((o) => orderIds.push(o.id));
    }
    await deleteOrders(orderIds);
  }
  return del("bookings", bookingIds);
}

/** 刪除客戶（歷史預約與訂單保留，只是不再連結到客戶資料） */
export const deleteCustomers = (ids) => del("customers", ids);
export const deleteNotifications = (ids) => del("notifications", ids);
export const deleteAuditLogs = (ids) => del("audit_logs", ids);
export const deleteRows = (table, ids) => del(table, ids);

/** 依條件找出要整理的紀錄編號（先預覽數量，確認後再刪） */
export async function findIds(table, build, key = "id") {
  let q = supabase.from(table).select(key).limit(5000);
  q = build(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r) => r[key]);
}
