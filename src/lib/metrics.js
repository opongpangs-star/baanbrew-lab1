// ฟังก์ชันคำนวณทั้งหมดของ Dashboard อยู่ที่ไฟล์นี้ไฟล์เดียว เพื่อให้ตรวจสูตรได้ง่าย (Verify)
// กติกาข้อมูล: 1 แถว = 1 รายการสินค้า, 1 บิลมีได้หลายแถว (order_id ซ้ำได้)
//             ยอดขาย = qty × unit_price, customer_id ว่าง = ลูกค้าทั่วไป (ไม่นับเป็นสมาชิก)

// แปลงแถวดิบจาก PapaParse ให้พร้อมใช้: qty/unit_price เป็น Number, ตัดวันที่/ชั่วโมงจากข้อความตรง ๆ
// (ใช้ 10 ตัวอักษรแรกของ datetime แทน new Date() เพื่อไม่ให้วันที่เลื่อนเพราะแปลงเป็นเวลา UTC)
export function parseRows(raw) {
  return raw
    .filter((r) => r.order_id && r.datetime)
    .map((r) => {
      const qty = Number(r.qty);
      const unitPrice = Number(r.unit_price);
      return {
        orderId: r.order_id,
        date: r.datetime.slice(0, 10), // "2025-04-01"
        hour: Number(r.datetime.slice(11, 13)), // 0–23 ตามเวลาไทย (+07:00) ที่อยู่ในข้อความ
        branch: r.branch.trim(),
        qty,
        unitPrice,
        revenue: qty * unitPrice,
        customerId: (r.customer_id || "").trim(),
      };
    });
}

// KPI 4 ตัว
// - totalSales: ผลรวม qty × unit_price ทุกแถว
// - bills: จำนวน order_id ที่ไม่ซ้ำ (ไม่ใช่จำนวนแถว)
// - avgPerBill: ยอดขายรวม ÷ จำนวนบิล (ไม่ใช่ ÷ จำนวนแถว)
// - members: จำนวน customer_id ที่ไม่ซ้ำ ไม่นับค่าว่าง
export function computeKpis(rows) {
  let totalSales = 0;
  const orders = new Set();
  const members = new Set();
  for (const r of rows) {
    totalSales += r.revenue;
    orders.add(r.orderId);
    if (r.customerId) members.add(r.customerId);
  }
  const bills = orders.size;
  return {
    totalSales,
    bills,
    avgPerBill: bills ? totalSales / bills : 0,
    members: members.size,
    rows: rows.length,
  };
}

// ยอดขายรายวัน เรียงตามวันที่ + ค่าเฉลี่ยเคลื่อนที่ 7 วัน (ma7) ทำให้เห็นแนวโน้มชัดกว่าเส้นรายวันที่แกว่ง
export function dailySales(rows) {
  const byDate = new Map();
  for (const r of rows) byDate.set(r.date, (byDate.get(r.date) || 0) + r.revenue);
  const days = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, sales]) => ({ date, sales }));
  let windowSum = 0;
  days.forEach((d, i) => {
    windowSum += d.sales;
    if (i >= 7) windowSum -= days[i - 7].sales;
    d.ma7 = i >= 6 ? Math.round(windowSum / 7) : null; // ยังไม่ครบ 7 วันแรก ไม่แสดงเส้นเฉลี่ย
  });
  return days;
}

// ยอดขายแยกสาขา เรียงมากไปน้อย
// แถม: จำนวนวันที่มีการขาย และยอดเฉลี่ยต่อวัน — ใช้เทียบอย่างยุติธรรม เพราะบางสาขาเปิดทีหลัง (เช่น อารีย์)
export function salesByBranch(rows) {
  const map = new Map();
  for (const r of rows) {
    const b = map.get(r.branch) || { branch: r.branch, sales: 0, days: new Set() };
    b.sales += r.revenue;
    b.days.add(r.date);
    map.set(r.branch, b);
  }
  return [...map.values()]
    .map((b) => ({ branch: b.branch, sales: b.sales, days: b.days.size, perDay: Math.round(b.sales / b.days.size) }))
    .sort((a, b) => b.sales - a.sales);
}

// การบ้าน: จำนวนบิลตามชั่วโมงของวัน — นับบิลละ 1 ครั้ง (order_id ไม่ซ้ำ) ไม่ใช่นับแถว
export function billsByHour(rows) {
  const seen = new Set();
  const counts = new Map();
  for (const r of rows) {
    if (seen.has(r.orderId)) continue;
    seen.add(r.orderId);
    counts.set(r.hour, (counts.get(r.hour) || 0) + 1);
  }
  const hours = [...counts.keys()];
  if (!hours.length) return [];
  const result = [];
  for (let h = Math.min(...hours); h <= Math.max(...hours); h++) {
    result.push({ hour: h, label: `${String(h).padStart(2, "0")}:00`, bills: counts.get(h) || 0 });
  }
  return result;
}

export function branchNames(rows) {
  return [...new Set(rows.map((r) => r.branch))];
}

// ---------- รูปแบบตัวเลข/วันที่ภาษาไทย ----------
const baht = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const baht2 = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("th-TH");

export const fmtBaht = (n) => `฿${baht.format(n)}`;
export const fmtBaht2 = (n) => `฿${baht2.format(n)}`;
export const fmtNum = (n) => num.format(n);
export const fmtCompactBaht = (n) => (n >= 1e6 ? `฿${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `฿${Math.round(n / 1e3)}k` : `฿${n}`);

// "2025-04-01" → "1 เม.ย. 68" (สร้าง Date แบบ local จากตัวเลข เพื่อไม่ให้วันเลื่อน)
const thShort = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit" });
const thMonth = new Intl.DateTimeFormat("th-TH", { month: "short", year: "2-digit" });
const thLong = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", weekday: "short" });
const toDate = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
export const fmtThaiDate = (iso) => thShort.format(toDate(iso));
export const fmtThaiMonth = (iso) => thMonth.format(toDate(iso));
export const fmtThaiDateLong = (iso) => thLong.format(toDate(iso));
