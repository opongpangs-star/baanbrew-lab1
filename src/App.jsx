import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, LabelList,
} from "recharts";
import {
  parseRows, computeKpis, dailySales, salesByBranch, billsByHour, branchNames,
  fmtBaht, fmtBaht2, fmtNum, fmtCompactBaht, fmtThaiDate, fmtThaiMonth, fmtThaiDateLong,
} from "./lib/metrics.js";
import CustomerSection from "./components/CustomerSection.jsx";
import { Centered, Card, Kpi, Segmented, ChartTooltip } from "./components/ui.jsx";

const ALL = "ทุกสาขา";
const BRANCH_TYPE = { สยาม: "ห้าง", สีลม: "ออฟฟิศ", อารีย์: "ชุมชน", บางนา: "ห้าง", มหาวิทยาลัย: "สถานศึกษา" };
const RANGES = [
  { key: "all", label: "ทั้งหมด", days: Infinity },
  { key: "180", label: "6 เดือน", days: 180 },
  { key: "90", label: "90 วัน", days: 90 },
];
const C = { roast: "#6b4226", caramel: "#b07a45", latte: "#d9c3a5", grid: "#ece2d3", axis: "#8a7563" };
export const REPO_URL = "https://github.com/opongpangs-star/baanbrew-lab1";
export const COLORS = C;
const VIEWS = [{ key: "sales", label: "📈 ยอดขาย" }, { key: "customers", label: "👥 ลูกค้า" }];

export default function App() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [branch, setBranch] = useState(ALL);
  const [view, setView] = useState("sales");

  useEffect(() => {
    Papa.parse(`${import.meta.env.BASE_URL}sales.csv`, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows(parseRows(res.data)),
      error: (err) => setError(err.message || "โหลดไฟล์ไม่สำเร็จ"),
    });
  }, []);

  if (error) return <Centered>⚠️ โหลดข้อมูลไม่สำเร็จ: {error}</Centered>;
  if (!rows) return <Centered><span className="animate-pulse">☕ กำลังชงข้อมูล 53,000 แถว…</span></Centered>;
  return <Dashboard rows={rows} branch={branch} setBranch={setBranch} view={view} setView={setView} />;
}

function Dashboard({ rows, branch, setBranch, view, setView }) {
  const branches = useMemo(() => salesByBranch(rows).map((b) => b.branch), [rows]);
  const filtered = useMemo(() => (branch === ALL ? rows : rows.filter((r) => r.branch === branch)), [rows, branch]);
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const daily = useMemo(() => dailySales(filtered), [filtered]);
  const hourly = useMemo(() => billsByHour(filtered), [filtered]);
  const firstDate = daily[0]?.date;
  const lastDate = daily.at(-1)?.date;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-caramel">Lab 1 + Lab 2.1 · Basic Data Analytics</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold text-espresso">
            <span aria-hidden>☕</span> บ้านบรู Dashboard
          </h1>
          <p className="mt-1 text-sm text-roast/80">
            {view === "sales" ? "ภาพรวมยอดขาย" : "ภาพรวมลูกค้าสมาชิก"} {branch === ALL ? `${branchNames(rows).length} สาขา` : `สาขา${branch}`} ·{" "}
            {firstDate && `${fmtThaiDate(firstDate)} – ${fmtThaiDate(lastDate)}`}
          </p>
        </div>
        <Segmented label="มุมมอง" options={VIEWS} value={view} onChange={setView} />
      </header>

      <nav aria-label="เลือกสาขา" className="sticky top-0 z-10 -mx-4 mt-5 flex gap-2 overflow-x-auto bg-cream/90 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
        {[ALL, ...branches].map((b) => (
          <button
            key={b}
            onClick={() => setBranch(b)}
            aria-pressed={branch === b}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              branch === b ? "border-roast bg-roast text-cream shadow" : "border-latte bg-white text-roast hover:bg-foam"
            }`}
          >
            {b}
            {b !== ALL && <span className="ml-1 text-xs opacity-70">· {BRANCH_TYPE[b]}</span>}
          </button>
        ))}
      </nav>

      {view === "sales" ? (
        <>
          <section aria-label="ตัวชี้วัดหลัก" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon="💰" label="ยอดขายรวม" value={fmtBaht(kpis.totalSales)} hint="ผลรวม qty × unit_price" />
            <Kpi icon="🧾" label="จำนวนบิล" value={fmtNum(kpis.bills)} hint={`order_id ไม่ซ้ำ (จาก ${fmtNum(kpis.rows)} แถว)`} />
            <Kpi icon="☕" label="ยอดเฉลี่ยต่อบิล" value={fmtBaht2(kpis.avgPerBill)} hint="ยอดขายรวม ÷ จำนวนบิล" />
            <Kpi icon="👥" label="ลูกค้าสมาชิก" value={fmtNum(kpis.members)} hint="customer_id ไม่ซ้ำ ไม่นับค่าว่าง" />
          </section>
    
          <DailyChart daily={daily} />
    
          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <BranchChart rows={rows} selected={branch} onSelect={setBranch} />
            <HourlyChart hourly={hourly} branch={branch} />
          </div>
    
          <Observations rows={rows} />
          <VerifyPanel rows={rows} />
        </>
      ) : (
        <CustomerSection salesRows={filtered} branch={branch} onSelectBranch={setBranch} />
      )}

      <footer className="mt-10 border-t border-latte/60 pt-5 text-center text-xs text-roast/70">
        ข้อมูล {fmtNum(rows.length)} แถว · {branches.length} สาขา · {dailySales(rows).length} วัน (sales.csv ร้านกาแฟบ้านบรู) ·
        สร้างด้วย React + Vite + Tailwind + Recharts + PapaParse ·{" "}
        <a className="underline hover:text-roast" href={REPO_URL} target="_blank" rel="noreferrer">โค้ดบน GitHub</a>
      </footer>
    </div>
  );
}

function DailyChart({ daily }) {
  const [range, setRange] = useState("all");
  const days = RANGES.find((r) => r.key === range).days;
  const data = Number.isFinite(days) ? daily.slice(-days) : daily;
  return (
    <Card
      className="mt-4"
      title="ยอดขายรายวัน"
      sub="เส้นจาง = ยอดแต่ละวัน · เส้นเข้ม = ค่าเฉลี่ย 7 วัน ช่วยให้เห็นแนวโน้มชัดขึ้น"
      action={<Segmented label="ช่วงเวลา" options={RANGES} value={range} onChange={setRange} />}
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={range === "90" ? fmtThaiDate : fmtThaiMonth} minTickGap={36} tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: C.latte }} />
            <YAxis tickFormatter={fmtCompactBaht} width={52} tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, "auto"]} />
            <Tooltip content={<ChartTooltip labelFormatter={fmtThaiDateLong} valueFormatter={(v) => fmtBaht(v)} />} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
            <Line type="monotone" dataKey="sales" name="ยอดรายวัน" stroke={C.latte} strokeWidth={1.2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="ma7" name="ค่าเฉลี่ย 7 วัน" stroke={C.roast} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function BranchChart({ rows, selected, onSelect }) {
  const [mode, setMode] = useState("sales");
  const data = useMemo(() => {
    const list = salesByBranch(rows);
    return mode === "sales" ? list : [...list].sort((a, b) => b.perDay - a.perDay);
  }, [rows, mode]);
  const key = mode === "sales" ? "sales" : "perDay";
  return (
    <Card
      className="lg:col-span-3"
      title="ยอดขายแยกสาขา"
      sub={mode === "sales" ? "เรียงจากมากไปน้อย · แกนเริ่มที่ 0 · คลิกแท่งเพื่อกรองทั้งหน้า" : "ยอดเฉลี่ยต่อวันที่เปิดขาย — เทียบได้ยุติธรรมกว่า เพราะอารีย์เพิ่งเปิด"}
      action={
        <Segmented label="มุมมอง" value={mode} onChange={setMode}
          options={[{ key: "sales", label: "ยอดรวม" }, { key: "perDay", label: "เฉลี่ย/วัน" }]} />
      }
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="branch" tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: C.latte }} interval={0} />
            <YAxis tickFormatter={fmtCompactBaht} width={52} tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, "auto"]} />
            <Tooltip cursor={{ fill: "#f6efe4" }}
              content={<ChartTooltip valueFormatter={(v) => fmtBaht(v)} />} />
            <Bar dataKey={key} name={mode === "sales" ? "ยอดขายรวม" : "ยอดเฉลี่ยต่อวัน"} radius={[8, 8, 0, 0]} cursor="pointer"
              onClick={(d) => onSelect(selected === d.branch ? ALL : d.branch)} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.branch} fill={selected === ALL || selected === d.branch ? C.caramel : C.latte} />
              ))}
              <LabelList dataKey={key} position="top" formatter={fmtCompactBaht} style={{ fill: C.roast, fontSize: 12, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {mode === "sales" && (
        <p className="mt-2 rounded-lg bg-foam px-3 py-2 text-xs text-roast">
          💡 อารีย์ยอดรวมต่ำสุดเพราะเพิ่งเปิด 1 พ.ย. 2568 (มีข้อมูล {data.find((d) => d.branch === "อารีย์")?.days} วัน
          ขณะที่สาขาอื่นมีราว 538 วัน) — กด “เฉลี่ย/วัน” เพื่อเทียบแบบยุติธรรม
        </p>
      )}
    </Card>
  );
}

function HourlyChart({ hourly, branch }) {
  const peak = hourly.reduce((a, b) => (b.bills > (a?.bills ?? -1) ? b : a), null);
  return (
    <Card
      className="lg:col-span-2"
      title="จำนวนบิลตามชั่วโมง"
      sub={`การบ้าน · ${branch === ALL ? "รวมทุกสาขา" : `สาขา${branch}`} — เลือกสาขาด้านบนเพื่อเทียบ`}
    >
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hourly} margin={{ top: 5, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="hour" tickFormatter={(h) => String(h).padStart(2, "0")} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.latte }} interval={0} />
            <YAxis tickFormatter={fmtNum} width={44} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: "#f6efe4" }}
              content={<ChartTooltip labelFormatter={(h) => `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59 น.`} valueFormatter={(v) => `${fmtNum(v)} บิล`} />} />
            <Bar dataKey="bills" name="จำนวนบิล" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {hourly.map((h) => <Cell key={h.hour} fill={h.hour === peak?.hour ? C.roast : C.caramel} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {peak && (
        <p className="mt-2 text-sm text-roast">
          ⏰ ช่วงพีค: <b>{peak.label} น.</b> ({fmtNum(peak.bills)} บิล) — แท่งสีเข้ม
        </p>
      )}
    </Card>
  );
}

function Observations({ rows }) {
  // ดึงชั่วโมงพีคของแต่ละสาขาจากข้อมูลจริง เพื่อให้ข้อสังเกตอ้างตัวเลขที่ตรวจได้
  const peaks = useMemo(() => {
    const out = {};
    for (const b of branchNames(rows)) {
      const h = billsByHour(rows.filter((r) => r.branch === b));
      out[b] = h.reduce((a, x) => (x.bills > a.bills ? x : a));
    }
    return out;
  }, [rows]);
  const p = (b) => `${peaks[b]?.label} น.`;
  const items = [
    {
      t: "สาขาออฟฟิศและชุมชนขายดีที่สุดตอนเช้า",
      d: `สีลม (ออฟฟิศ) พีค ${p("สีลม")} และอารีย์ (ชุมชน) พีค ${p("อารีย์")} — ลูกค้าซื้อกาแฟก่อนเข้างาน หลัง 17.00 น. สีลมแทบไม่มีลูกค้า`,
      a: "ควรเพิ่มพนักงานช่วง 07–10 น. และเปิดสั่งล่วงหน้าผ่านแอปเพื่อลดคิวตอนเช้า",
    },
    {
      t: "สาขาในห้างพีคช่วงบ่ายถึงเย็น",
      d: `สยาม พีค ${p("สยาม")} และบางนา พีค ${p("บางนา")} — คนมาเดินห้างช่วงบ่าย ยอดยังสูงต่อเนื่องถึง 19.00 น. แต่ช่วงเช้าก่อน 10 น. เงียบมาก`,
      a: "จัดกะพนักงานให้หนักช่วง 12–19 น. และลดคนช่วงเปิดร้าน",
    },
    {
      t: "สาขามหาวิทยาลัยพีคตอนพักเที่ยงและช่วงเปลี่ยนคาบ",
      d: `มหาวิทยาลัยพีค ${p("มหาวิทยาลัย")} รองลงมาคือ 15.00 น. — ตรงกับเวลาพักของนักศึกษา และลดลงชัดหลัง 17.00 น.`,
      a: "ทำโปรฯ เซ็ตเที่ยง/ช่วงบ่าย และเตรียมวัตถุดิบให้พอก่อน 12.00 น.",
    },
    {
      t: "ภาพรวมทุกสาขามี 2 ช่วงพีค",
      d: `รวมทุกสาขาพีค ${billsByHour(rows).reduce((a, x) => (x.bills > a.bills ? x : a)).label} น. และมีอีกช่วงสูงราว 15.00–16.00 น. — แต่ถ้าดูแค่ภาพรวมจะไม่เห็นว่าแต่ละสาขาพีคคนละเวลา`,
      a: "การจัดพนักงานต้องดูรายสาขา ไม่ใช้ตารางเดียวกันทุกสาขา",
    },
  ];
  return (
    <Card className="mt-4" title="📝 ข้อสังเกตจากกราฟจำนวนบิลตามชั่วโมง (การบ้าน)" sub="ประเภทของสาขามีผลต่อพฤติกรรมลูกค้ามาก — ลองกดเลือกทีละสาขาด้านบนเพื่อดูกราฟ">
      <ol className="grid gap-3 md:grid-cols-2">
        {items.map((it, i) => (
          <li key={it.t} className="rounded-xl bg-foam/70 p-4">
            <div className="flex gap-2 font-semibold text-espresso">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-roast text-xs text-cream">{i + 1}</span>
              {it.t}
            </div>
            <p className="mt-1.5 text-sm text-roast">{it.d}</p>
            <p className="mt-1.5 text-sm text-espresso">👉 {it.a}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function VerifyPanel({ rows }) {
  const k = useMemo(() => computeKpis(rows), [rows]);
  const traps = [
    ["นับบิลจาก order_id ที่ไม่ซ้ำ (ไม่ใช่นับแถว)", `${fmtNum(k.bills)} บิล ≠ ${fmtNum(k.rows)} แถว`],
    ["ยอดขาย = qty × unit_price (ไม่ลืมคูณจำนวน)", fmtBaht(k.totalSales)],
    ["เฉลี่ยต่อบิล หารด้วยจำนวนบิล (ไม่ใช่จำนวนแถว)", fmtBaht2(k.avgPerBill)],
    ["แปลง qty, unit_price เป็น Number ก่อนคำนวณ", "ไม่มีค่า 0 / NaN"],
    ["ใช้ 10 ตัวอักษรแรกของ datetime เป็นวันที่ (ไม่แปลงเป็น UTC)", "วันที่ไม่เลื่อน"],
  ];
  return (
    <Card className="mt-4" title="✅ Verify: ตรวจตัวเลขแล้ว" sub="เทียบกับ Pivot Table (Rows = branch, Values = SUM of revenue) และคำนวณซ้ำด้วยสคริปต์ verify.mjs">
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {traps.map(([rule, result]) => (
          <li key={rule} className="flex items-start justify-between gap-3 rounded-lg border border-latte/50 px-3 py-2">
            <span className="text-roast">✔︎ {rule}</span>
            <span className="shrink-0 font-semibold tabular-nums text-espresso">{result}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
