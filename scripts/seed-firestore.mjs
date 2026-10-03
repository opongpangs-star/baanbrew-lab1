// Lab 3.1 — นำข้อมูล sales.csv เข้า Firestore collection "sales" ด้วย firebase-admin
// รัน: npm run seed   (อ่านค่าจาก .env — ดูตัวอย่างใน .env.example)
//
// - นำเข้าเฉพาะ 3 เดือนล่าสุด (แผนฟรีจำกัดจำนวนการเขียนต่อวัน)
// - เพิ่ม field date, hour, revenue ไว้เลย เพื่อให้หน้าเว็บกรอง/รวมได้ทันที
// - document id = order_id + "-" + product_id → รันซ้ำได้ ไม่เกิดข้อมูลซ้ำ (เขียนทับของเดิม)
// - เขียนเป็น batch ครั้งละไม่เกิน 500 รายการ
//
// ⚠️ ไฟล์ service account key มีสิทธิ์ทำทุกอย่างกับฐานข้อมูล: เก็บไว้นอกโฟลเดอร์โปรเจกต์ ห้าม commit ห้ามวางใน AI chat

import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = process.env.SERVICE_ACCOUNT_PATH;
if (!keyPath) {
  console.error("❌ ไม่พบ SERVICE_ACCOUNT_PATH ใน .env — ใส่ path ของไฟล์ service account key (เก็บนอก repo)");
  process.exit(1);
}
const MONTHS = Number(process.env.SEED_MONTHS || 3);
const BATCH = 500;

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const db = getFirestore();

const rows = Papa.parse(readFileSync("public/sales.csv", "utf8"), { header: true, skipEmptyLines: true }).data;
const lastDate = rows.reduce((m, r) => (r.datetime.slice(0, 10) > m ? r.datetime.slice(0, 10) : m), "");
const start = new Date(`${lastDate}T00:00:00Z`);
start.setUTCMonth(start.getUTCMonth() - MONTHS);
start.setUTCDate(start.getUTCDate() + 1);
const startDate = start.toISOString().slice(0, 10); // 3 เดือน: 2026-06-21 ถึง 2026-09-20

const docs = rows
  .filter((r) => r.datetime.slice(0, 10) >= startDate)
  .map((r) => {
    const qty = Number(r.qty);
    const unitPrice = Number(r.unit_price);
    return {
      id: `${r.order_id}-${r.product_id}`,
      data: {
        order_id: r.order_id,
        date: r.datetime.slice(0, 10), // เก็บเป็นข้อความ "YYYY-MM-DD" กรองช่วงวันที่ได้ง่าย ไม่มีปัญหาเขตเวลา
        hour: Number(r.datetime.slice(11, 13)),
        branch: r.branch.trim(),
        product_id: r.product_id,
        qty,
        unit_price: unitPrice,
        revenue: qty * unitPrice,
        customer_id: r.customer_id ? r.customer_id.trim() : null,
        payment_method: r.payment_method || null,
        channel: r.channel || null,
        source: "seed",
      },
    };
  });

console.log(`📦 นำเข้า ${docs.length.toLocaleString()} แถว (${startDate} ถึง ${lastDate}) เข้า collection "sales"…`);
let written = 0;
for (let i = 0; i < docs.length; i += BATCH) {
  const batch = db.batch();
  for (const d of docs.slice(i, i + BATCH)) batch.set(db.collection("sales").doc(d.id), d.data);
  await batch.commit();
  written += Math.min(BATCH, docs.length - i);
  process.stdout.write(`\r   เขียนแล้ว ${written.toLocaleString()} / ${docs.length.toLocaleString()}`);
}
const revenue = docs.reduce((s, d) => s + d.data.revenue, 0);
console.log(`\n✅ นำเข้าเสร็จ ${written.toLocaleString()} เอกสาร · ยอดขายรวมช่วงนี้ ฿${revenue.toLocaleString()} (ใช้ตรวจเทียบกับ Dashboard)`);
