// Lab 3.2–3.3: Dashboard แบบ real-time จาก Firestore + ฟอร์มบันทึกยอดขาย + ต้องล็อกอินด้วย Google
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from "recharts";
import { db, firebaseReady, signInWithGoogle, bangkokNow, firebaseErrorText } from "../lib/firebase.js";
import {
  computeKpis, dailySales, salesByBranch, fmtBaht, fmtBaht2, fmtNum, fmtCompactBaht, fmtThaiDate, fmtThaiDateLong,
} from "../lib/metrics.js";
import { Card, Kpi, Segmented, ChartTooltip } from "./ui.jsx";

const ALL = "ทุกสาขา";
const BRANCHES = ["สยาม", "สีลม", "บางนา", "มหาวิทยาลัย", "อารีย์"];
const C = { roast: "#6b4226", caramel: "#b07a45", latte: "#d9c3a5", grid: "#ece2d3", axis: "#8a7563" };
const axis = { tick: { fill: C.axis, fontSize: 12 }, tickLine: false };
const SEED_START = "2026-06-21"; // ข้อมูลตั้งต้นใน Firestore เริ่มวันนี้ (3 เดือนล่าสุด)

const shiftDate = (iso, days) => {
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function RealtimeSection({ user, branch }) {
  if (!firebaseReady) {
    return (
      <Card className="mt-4" title="⚡ ยังไม่ได้เชื่อมต่อ Firebase" sub="ใส่ค่า web config ใน .env.local แล้ว build ใหม่ (ดู .env.example)">
        <p className="text-sm text-roast">หน้ายอดขายและลูกค้ายังใช้งานได้ตามปกติจากไฟล์ CSV</p>
      </Card>
    );
  }
  if (user === undefined) return <p className="mt-6 animate-pulse text-roast">🔐 กำลังตรวจสถานะการเข้าสู่ระบบ…</p>;
  if (!user) return <LoginGate />;
  return <LiveDashboard user={user} branch={branch} />;
}

function LoginGate() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const login = async () => {
    setBusy(true);
    setError("");
    try { await signInWithGoogle(); } catch (e) { setError(firebaseErrorText(e)); } finally { setBusy(false); }
  };
  return (
    <section className="mx-auto mt-10 max-w-md rounded-2xl border border-latte/50 bg-white p-8 text-center shadow-sm">
      <div className="text-5xl" aria-hidden>🔐</div>
      <h2 className="mt-3 text-xl font-semibold text-espresso">เข้าสู่ระบบเพื่อดู Dashboard แบบ Real-time</h2>
      <p className="mt-2 text-sm text-roast/80">
        ข้อมูลยอดขายบน Firestore อ่านได้เฉพาะผู้ที่ล็อกอินแล้ว (บังคับด้วย Security Rules ฝั่งเซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนปุ่ม)
      </p>
      <button onClick={login} disabled={busy}
        className="mt-6 inline-flex items-center gap-3 rounded-full border border-latte bg-white px-6 py-2.5 font-medium text-espresso shadow-sm transition hover:bg-foam disabled:opacity-60">
        <GoogleIcon /> {busy ? "กำลังเปิดหน้าต่างล็อกอิน…" : "เข้าสู่ระบบด้วย Google"}
      </button>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}

function LiveDashboard({ user, branch }) {
  const today = bangkokNow().date;
  const [range, setRange] = useState({ start: shiftDate(today, -29), end: today });
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const products = useProducts();

  // อ่านแบบ real-time: onSnapshot ฟังตลอด ข้อมูลเปลี่ยนเมื่อไร หน้าจออัปเดตเอง
  // กรองช่วงวันที่ที่ฝั่งฐานข้อมูล (อ่านเฉพาะที่ต้องใช้) ส่วนสาขากรองที่หน้าเว็บ เพื่อไม่ต้องสร้าง composite index
  useEffect(() => {
    setDocs(null);
    setError("");
    const q = query(collection(db, "sales"), where("date", ">=", range.start), where("date", "<=", range.end), orderBy("date"));
    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setFromCache(snap.metadata.fromCache);
        setUpdatedAt(new Date());
      },
      (err) => setError(firebaseErrorText(err))
    );
    return () => unsub(); // เลิกฟังเมื่อออกจากหน้า/เปลี่ยนช่วงวันที่ ไม่งั้นจะอ่านซ้ำเรื่อย ๆ
  }, [range.start, range.end]);

  // แปลงเอกสาร Firestore ให้เป็นรูปแบบเดียวกับแถวจาก CSV แล้วใช้สูตรใน metrics.js ชุดเดิม
  const rows = useMemo(() => (docs || []).map((d) => ({
    orderId: d.order_id, date: d.date, hour: d.hour, branch: d.branch, qty: d.qty, unitPrice: d.unit_price,
    revenue: d.revenue, customerId: d.customer_id || "", source: d.source, createdBy: d.created_by_name, createdAt: d.created_at, id: d.id,
  })), [docs]);
  const filtered = useMemo(() => (branch === ALL ? rows : rows.filter((r) => r.branch === branch)), [rows, branch]);
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const daily = useMemo(() => dailySales(filtered), [filtered]);
  const byBranch = useMemo(() => salesByBranch(rows), [rows]);
  const webEntries = useMemo(
    () => rows.filter((r) => r.source === "web").sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 8),
    [rows]
  );

  const presets = [
    { key: "7", label: "7 วัน", start: shiftDate(today, -6) },
    { key: "30", label: "30 วัน", start: shiftDate(today, -29) },
    { key: "all", label: "ทั้งหมด", start: SEED_START },
  ];
  const activePreset = range.end === today ? presets.find((p) => p.start === range.start)?.key : undefined;

  return (
    <>
      <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-latte/50 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className={`relative flex h-2.5 w-2.5 ${error ? "" : ""}`}>
            {!error && !fromCache && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${error ? "bg-red-500" : fromCache ? "bg-amber-400" : "bg-emerald-500"}`} />
          </span>
          <span className="font-medium text-espresso">{error ? "เชื่อมต่อไม่ได้" : fromCache ? "กำลังเชื่อมต่อ…" : "Live · Firestore"}</span>
          {updatedAt && !error && <span className="text-roast/70">อัปเดตล่าสุด {updatedAt.toLocaleTimeString("th-TH")}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Segmented label="ช่วงวันที่ด่วน" options={presets} value={activePreset}
            onChange={(k) => setRange({ start: presets.find((p) => p.key === k).start, end: today })} />
          <label className="flex items-center gap-1 text-roast">
            <span className="sr-only">ตั้งแต่</span>
            <input type="date" value={range.start} max={range.end} onChange={(e) => e.target.value && setRange((r) => ({ ...r, start: e.target.value }))}
              className="rounded-lg border border-latte px-2 py-1 text-espresso" />
          </label>
          <span className="text-roast/60">–</span>
          <label className="flex items-center gap-1 text-roast">
            <span className="sr-only">ถึง</span>
            <input type="date" value={range.end} min={range.start} onChange={(e) => e.target.value && setRange((r) => ({ ...r, end: e.target.value }))}
              className="rounded-lg border border-latte px-2 py-1 text-espresso" />
          </label>
        </div>
      </section>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">⚠️ {error}</p>}

      {!docs && !error ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-foam" />)}
        </div>
      ) : docs && (
        <>
          <section aria-label="ตัวชี้วัด real-time" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon="💰" label="ยอดขายรวม" value={fmtBaht(kpis.totalSales)} hint={`${fmtThaiDate(range.start)} – ${fmtThaiDate(range.end)}`} />
            <Kpi icon="🧾" label="จำนวนบิล" value={fmtNum(kpis.bills)} hint={`จาก ${fmtNum(kpis.rows)} รายการใน Firestore`} />
            <Kpi icon="☕" label="ยอดเฉลี่ยต่อบิล" value={fmtBaht2(kpis.avgPerBill)} hint="ยอดขายรวม ÷ จำนวนบิล" />
            <Kpi icon="✍️" label="บันทึกจากหน้าเว็บ" value={fmtNum(rows.filter((r) => r.source === "web").length)} hint="รายการที่กรอกผ่านฟอร์มในช่วงนี้" />
          </section>

          {filtered.length === 0 ? (
            <Card className="mt-4" title="ไม่มีข้อมูลในช่วงที่เลือก" sub={`${branch === ALL ? "ทุกสาขา" : `สาขา${branch}`} · ${fmtThaiDate(range.start)} – ${fmtThaiDate(range.end)}`}>
              <p className="text-sm text-roast">ข้อมูลตั้งต้นใน Firestore มีตั้งแต่ {fmtThaiDate(SEED_START)} ถึง 20 ก.ย. 69 — ลองกด “ทั้งหมด” หรือบันทึกยอดขายใหม่ด้านล่าง</p>
            </Card>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3" title="ยอดขายรายวัน (real-time)" sub="บันทึกยอดขายใหม่แล้วกราฟจะขยับเอง — ลองเปิดอีกเครื่องดูพร้อมกัน">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={daily} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={C.grid} vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtThaiDate} minTickGap={30} {...axis} axisLine={{ stroke: C.latte }} />
                      <YAxis tickFormatter={fmtCompactBaht} width={52} {...axis} axisLine={false} domain={[0, "auto"]} />
                      <Tooltip content={<ChartTooltip labelFormatter={fmtThaiDateLong} valueFormatter={(v) => fmtBaht(v)} />} />
                      <Line type="monotone" dataKey="sales" name="ยอดขาย" stroke={C.roast} strokeWidth={2} dot={daily.length < 40} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="lg:col-span-2" title="ยอดขายแยกสาขา" sub="ช่วงวันที่ที่เลือก · เรียงมากไปน้อย">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byBranch} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 4 }}>
                      <CartesianGrid stroke={C.grid} horizontal={false} />
                      <XAxis type="number" tickFormatter={fmtCompactBaht} {...axis} axisLine={false} domain={[0, "auto"]} />
                      <YAxis type="category" dataKey="branch" {...axis} axisLine={false} width={78} />
                      <Tooltip cursor={{ fill: "#f6efe4" }} content={<ChartTooltip valueFormatter={(v) => fmtBaht(v)} />} />
                      <Bar dataKey="sales" name="ยอดขาย" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                        {byBranch.map((b) => <Cell key={b.branch} fill={branch === ALL || branch === b.branch ? C.caramel : C.latte} />)}
                        <LabelList dataKey="sales" position="right" formatter={fmtCompactBaht} style={{ fill: C.roast, fontSize: 12, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <SaleForm className="lg:col-span-2" user={user} products={products} defaultBranch={branch === ALL ? "สยาม" : branch} />
            <RecentEntries className="lg:col-span-3" entries={webEntries} products={products} />
          </div>
        </>
      )}
    </>
  );
}

function SaleForm({ className, user, products, defaultBranch }) {
  const [form, setForm] = useState({ branch: defaultBranch, productId: "", qty: 1, payment: "QR พร้อมเพย์" });
  const [status, setStatus] = useState(null); // {type:'ok'|'error', text}
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (products.length) setForm((f) => ({ ...f, productId: f.productId || products[0].id })); }, [products]);
  useEffect(() => setForm((f) => ({ ...f, branch: defaultBranch })), [defaultBranch]);

  const product = products.find((p) => p.id === form.productId);
  const qty = Number(form.qty);
  const qtyValid = Number.isInteger(qty) && qty >= 1 && qty <= 50;
  const categories = [...new Set(products.map((p) => p.category))];

  const submit = async (e) => {
    e.preventDefault();
    if (!product || !qtyValid) return;
    setSaving(true);
    setStatus(null);
    const { date, hour } = bangkokNow();
    const orderId = `WEB${Date.now()}`;
    try {
      // document id ตามรูปแบบเดียวกับข้อมูลตั้งต้น: order_id-product_id
      await setDoc(doc(db, "sales", `${orderId}-${product.id}`), {
        order_id: orderId, date, hour, branch: form.branch, product_id: product.id,
        qty, unit_price: product.price, revenue: qty * product.price,
        customer_id: null, payment_method: form.payment, channel: "หน้าร้าน", source: "web",
        created_by: user.uid, created_by_name: user.displayName || user.email || "ผู้ใช้",
        created_at: serverTimestamp(),
      });
      setStatus({ type: "ok", text: `บันทึกแล้ว: ${product.name} × ${qty} = ${fmtBaht(qty * product.price)} (สาขา${form.branch})` });
      setForm((f) => ({ ...f, qty: 1 }));
    } catch (err) {
      setStatus({ type: "error", text: firebaseErrorText(err) });
    } finally {
      setSaving(false);
    }
  };

  const field = "mt-1 w-full rounded-lg border border-latte bg-white px-3 py-2 text-espresso focus:border-roast focus:outline-none";
  return (
    <Card className={className} title="✍️ บันทึกยอดขาย" sub="บันทึกเป็นวันที่และเวลาปัจจุบัน (เวลาไทย) · ราคาดึงจากเมนูอัตโนมัติ">
      <form onSubmit={submit} className="grid gap-3 text-sm">
        <label className="text-roast">สาขา
          <select className={field} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
            {BRANCHES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <label className="text-roast">เมนู
          <select className={field} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} disabled={!products.length}>
            {categories.map((c) => (
              <optgroup key={c} label={c}>
                {products.filter((p) => p.category === c).map((p) => <option key={p.id} value={p.id}>{p.name} — ฿{p.price}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-roast">จำนวน
            <input type="number" min="1" max="50" step="1" required className={field} value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })} aria-invalid={!qtyValid} />
          </label>
          <label className="text-roast">ชำระเงิน
            <select className={field} value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })}>
              {["QR พร้อมเพย์", "เงินสด", "บัตรเครดิต"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
        </div>
        {!qtyValid && <p className="text-xs text-red-700">จำนวนต้องเป็นจำนวนเต็ม 1–50</p>}
        <div className="flex items-center justify-between rounded-lg bg-foam px-3 py-2">
          <span className="text-roast">ยอดขาย</span>
          <b className="text-lg tabular-nums text-espresso">{product && qtyValid ? fmtBaht(qty * product.price) : "–"}</b>
        </div>
        <button type="submit" disabled={saving || !product || !qtyValid}
          className="rounded-full bg-roast px-4 py-2.5 font-medium text-cream shadow transition hover:bg-espresso disabled:opacity-50">
          {saving ? "กำลังบันทึก…" : "บันทึกยอดขาย"}
        </button>
        {status && (
          <p role="status" className={`rounded-lg px-3 py-2 ${status.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
            {status.type === "ok" ? "✅ " : "⚠️ "}{status.text}
          </p>
        )}
      </form>
    </Card>
  );
}

function RecentEntries({ className, entries, products }) {
  const name = (id) => products.find((p) => p.id === id)?.name || id;
  return (
    <Card className={className} title="🕒 รายการที่บันทึกจากหน้าเว็บล่าสุด" sub="อัปเดตอัตโนมัติจาก Firestore — รวมรายการที่คนอื่นบันทึกด้วย">
      {entries.length === 0 ? (
        <p className="rounded-lg bg-foam px-3 py-6 text-center text-sm text-roast">ยังไม่มีรายการจากหน้าเว็บในช่วงนี้ — ลองบันทึกยอดขายดูได้เลย</p>
      ) : (
        <ul className="divide-y divide-latte/40 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-espresso">{name(e.id.split("-")[1])} × {e.qty} · สาขา{e.branch}</div>
                <div className="truncate text-xs text-roast/70">
                  {e.createdBy} · {e.createdAt?.toDate ? e.createdAt.toDate().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "กำลังบันทึก…"}
                </div>
              </div>
              <b className="shrink-0 tabular-nums text-espresso">{fmtBaht(e.revenue)}</b>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// รายชื่อเมนูจาก products.csv — ราคาใส่ให้อัตโนมัติในฟอร์ม ผู้ใช้แก้ราคาเองไม่ได้
function useProducts() {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    Papa.parse(`${import.meta.env.BASE_URL}products.csv`, {
      download: true, header: true, skipEmptyLines: true,
      complete: (res) => setProducts(res.data.filter((p) => p.product_id)
        .map((p) => ({ id: p.product_id, name: p.product_name, category: p.category, price: Number(p.price) }))),
    });
  }, []);
  return products;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
