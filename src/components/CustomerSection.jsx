import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, LabelList,
} from "recharts";
import {
  parseCustomers, customerKpis, newMembersByMonth, membersByBranch, ageProfile, GENDERS,
  fmtNum, fmtBaht, fmtPct, fmtThaiMonth,
} from "../lib/metrics.js";
import { Card, Kpi, ChartTooltip } from "./ui.jsx";

const ALL = "ทุกสาขา";
const C = { roast: "#6b4226", caramel: "#b07a45", latte: "#d9c3a5", grid: "#ece2d3", axis: "#8a7563" };
const GENDER_COLOR = { หญิง: C.roast, ชาย: C.caramel, ไม่ระบุ: C.latte };
const NOTEBOOK = "notebooks/Lab2_1_Customers_Data_Profiling.ipynb";
const COLAB_URL = `https://colab.research.google.com/github/opongpangs-star/baanbrew-lab1/blob/main/${NOTEBOOK}`;
const axis = { tick: { fill: C.axis, fontSize: 12 }, tickLine: false };

export default function CustomerSection({ salesRows, branch, onSelectBranch }) {
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Papa.parse(`${import.meta.env.BASE_URL}customers_clean.csv`, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => setCustomers(parseCustomers(res.data)),
      error: (err) => setError(err.message || "โหลดไฟล์ไม่สำเร็จ"),
    });
  }, []);

  if (error) return <p className="mt-6 text-roast">⚠️ โหลดข้อมูลลูกค้าไม่สำเร็จ: {error}</p>;
  if (!customers) return <p className="mt-6 animate-pulse text-roast">👥 กำลังโหลดข้อมูลลูกค้า…</p>;
  return <CustomerView all={customers} salesRows={salesRows} branch={branch} onSelectBranch={onSelectBranch} />;
}

function CustomerView({ all, salesRows, branch, onSelectBranch }) {
  const customers = useMemo(() => (branch === ALL ? all : all.filter((c) => c.branch === branch)), [all, branch]);
  const k = useMemo(() => customerKpis(customers, salesRows), [customers, salesRows]);
  const months = useMemo(() => newMembersByMonth(customers), [customers]);
  const byBranch = useMemo(() => membersByBranch(all), [all]);
  const ages = useMemo(() => ageProfile(customers), [customers]);
  const quality = useMemo(() => ({
    notYet: customers.filter((c) => !c.hasPurchase).length,
    minors: customers.filter((c) => c.isMinor).length,
    shared: customers.filter((c) => c.phoneShared).length,
    switched: customers.filter((c) => c.hasPurchase && c.topBranch && c.topBranch !== c.branch).length,
  }), [customers]);

  return (
    <>
      <DataQualityCard total={customers.length} q={quality} />

      <section aria-label="ตัวชี้วัดลูกค้า" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon="👥" label="สมาชิกทั้งหมด" value={fmtNum(k.members)} hint="จากทะเบียนลูกค้าที่ทำความสะอาดแล้ว" />
        <Kpi icon="🛍️" label="เคยซื้อแล้ว" value={fmtNum(k.buyers)} hint={`${fmtPct(k.buyerRate)} ของสมาชิก`} />
        <Kpi icon="💳" label="ยอดซื้อเฉลี่ยต่อสมาชิก" value={fmtBaht(k.spendPerBuyer)} hint={`เฉลี่ย ${k.ordersPerBuyer.toFixed(1)} บิล/คน (เฉพาะคนที่เคยซื้อ)`} />
        <Kpi icon="📊" label="ยอดขายจากสมาชิก" value={fmtPct(k.memberSalesShare)} hint="ที่เหลือคือลูกค้าทั่วไป (ไม่มี customer_id)" />
      </section>

      <Card className="mt-4" title="สมาชิกใหม่รายเดือน" sub="แท่ง = สมัครใหม่ในเดือนนั้น · เส้น = สมาชิกสะสม · แท่งจาง = ก.ย. 69 มีข้อมูลถึง 20 ก.ย. เท่านั้น">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 18, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtThaiMonth} {...axis} minTickGap={20} axisLine={{ stroke: C.latte }} />
                <YAxis {...axis} axisLine={false} width={44} />
                <Tooltip cursor={{ fill: "#f6efe4" }} content={<ChartTooltip labelFormatter={(d) => fmtThaiMonth(d) + (months.find((m) => m.date === d)?.partial ? " (ไม่ครบเดือน)" : "")} valueFormatter={(v) => `${fmtNum(v)} คน`} />} />
                <Bar dataKey="newMembers" name="สมัครใหม่" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {months.map((m) => <Cell key={m.month} fill={m.partial ? C.latte : C.caramel} stroke={m.partial ? C.caramel : "none"} strokeDasharray="4 3" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={months} margin={{ top: 18, right: 8, bottom: 0, left: -4 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtThaiMonth} {...axis} minTickGap={20} axisLine={{ stroke: C.latte }} />
                <YAxis {...axis} axisLine={false} width={52} tickFormatter={fmtNum} domain={[0, "auto"]} />
                <Tooltip content={<ChartTooltip labelFormatter={fmtThaiMonth} valueFormatter={(v) => `${fmtNum(v)} คน`} />} />
                <Line type="monotone" dataKey="cumulative" name="สมาชิกสะสม" stroke={C.roast} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="สมาชิกแยกสาขาประจำ" sub="ซื้อแล้ว vs ยังไม่เคยซื้อ · ตัวเลขบนแท่ง = % ที่ซื้อแล้ว · คลิกแท่งเพื่อกรอง">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBranch} margin={{ top: 22, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="branch" {...axis} interval={0} axisLine={{ stroke: C.latte }} />
                <YAxis {...axis} axisLine={false} width={44} />
                <Tooltip cursor={{ fill: "#f6efe4" }} content={<ChartTooltip valueFormatter={(v) => `${fmtNum(v)} คน`} />} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="bought" name="ซื้อแล้ว" stackId="a" cursor="pointer" isAnimationActive={false}
                  onClick={(d) => onSelectBranch(branch === d.branch ? ALL : d.branch)}>
                  {byBranch.map((b) => <Cell key={b.branch} fill={branch === ALL || branch === b.branch ? C.roast : C.latte} />)}
                </Bar>
                <Bar dataKey="notYet" name="ยังไม่เคยซื้อ" stackId="a" radius={[6, 6, 0, 0]} cursor="pointer" isAnimationActive={false}
                  onClick={(d) => onSelectBranch(branch === d.branch ? ALL : d.branch)}>
                  {byBranch.map((b) => <Cell key={b.branch} fill={branch === ALL || branch === b.branch ? C.latte : "#efe6d8"} />)}
                  <LabelList dataKey="rate" position="top" formatter={(v) => fmtPct(v, 0)} style={{ fill: C.roast, fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="กลุ่มอายุ × เพศ" sub={branch === ALL ? "สมาชิกทุกสาขา" : `สมาชิกสาขา${branch}`}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ages} margin={{ top: 10, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="age" {...axis} interval={0} axisLine={{ stroke: C.latte }} />
                <YAxis {...axis} axisLine={false} width={44} />
                <Tooltip cursor={{ fill: "#f6efe4" }} content={<ChartTooltip valueFormatter={(v) => `${fmtNum(v)} คน`} />} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                {GENDERS.map((g, i) => (
                  <Bar key={g} dataKey={g} name={g} stackId="g" fill={GENDER_COLOR[g]} isAnimationActive={false}
                    radius={i === GENDERS.length - 1 ? [6, 6, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2" title="ยอดซื้อเฉลี่ยต่อคน ตามกลุ่มอายุ" sub="เฉพาะสมาชิกที่เคยซื้อ · ยอดรวมตลอดช่วงข้อมูล">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ages} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={C.grid} horizontal={false} />
                <XAxis type="number" {...axis} axisLine={false} tickFormatter={fmtNum} domain={[0, "auto"]} />
                <YAxis type="category" dataKey="age" {...axis} axisLine={false} width={70} />
                <Tooltip cursor={{ fill: "#f6efe4" }} content={<ChartTooltip valueFormatter={(v) => fmtBaht(v)} />} />
                <Bar dataKey="avgSpend" name="ยอดซื้อเฉลี่ย" fill={C.caramel} radius={[0, 6, 6, 0]} isAnimationActive={false}>
                  <LabelList dataKey="avgSpend" position="right" formatter={fmtBaht} style={{ fill: C.roast, fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <CustomerInsights className="lg:col-span-3" byBranch={byBranch} ages={ages} k={k} q={quality} branch={branch} />
      </div>
    </>
  );
}

function DataQualityCard({ total, q }) {
  const items = [
    { icon: "🛒", label: "ยังไม่เคยซื้อ", n: q.notYet, note: "กลุ่มเป้าหมายโปรฯ แก้วแรก" },
    { icon: "🧒", label: "อายุต่ำกว่า 18", n: q.minors, note: "ต้องมีความยินยอมผู้ปกครอง (PDPA)" },
    { icon: "📱", label: "ใช้เบอร์ร่วมกัน", n: q.shared, note: "อาจสมัครซ้ำ ตรวจก่อนส่ง SMS" },
    { icon: "🔀", label: "ซื้อที่อื่นบ่อยกว่าสาขาประจำ", n: q.switched, note: "สาขาประจำอาจไม่อัปเดต" },
  ];
  return (
    <Card className="mt-4" title="🧹 ผล Data Profiling ข้อมูลลูกค้า (Lab 2.1)"
      sub="ตรวจ 24 ข้อใน Google Colab — รูปแบบข้อมูลผ่านทั้งหมด พบประเด็นเชิงธุรกิจที่ติดธงไว้ (ไม่ลบทิ้ง) ดังนี้"
      action={
        <a href={COLAB_URL} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-roast px-4 py-1.5 text-sm font-medium text-cream shadow hover:bg-espresso">
          📓 เปิด Notebook ใน Colab
        </a>
      }>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((it) => (
          <li key={it.label} className="rounded-xl bg-foam/70 p-3">
            <div className="text-sm text-roast">{it.icon} {it.label}</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-espresso">
              {fmtNum(it.n)} <span className="text-sm font-medium text-roast/70">คน ({fmtPct(total ? it.n / total : 0)})</span>
            </div>
            <div className="mt-0.5 text-xs text-roast/70">{it.note}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CustomerInsights({ className, byBranch, ages, k, q, branch }) {
  const low = [...byBranch].sort((a, b) => a.rate - b.rate)[0];
  const high = [...byBranch].sort((a, b) => b.rate - a.rate)[0];
  const biggestAge = [...ages].sort((a, b) => b.total - a.total)[0];
  const topSpendAge = [...ages].sort((a, b) => b.avgSpend - a.avgSpend)[0];
  const items = [
    {
      t: `สมาชิกสร้างยอดขาย ${fmtPct(k.memberSalesShare, 0)}`,
      d: `${branch === ALL ? "ทุกสาขา" : `สาขา${branch}`}: ยอดขายเกินครึ่งยังมาจากลูกค้าทั่วไปที่ไม่ได้สมัครสมาชิก — ยังมีโอกาสเปลี่ยนลูกค้าขาจรเป็นสมาชิก`,
      a: "ให้พนักงานชวนสมัครที่จุดชำระเงิน แลกส่วนลดแก้วถัดไป",
    },
    {
      t: `${low.branch}: สมาชิกซื้อจริงน้อยที่สุด (${fmtPct(low.rate)})`,
      d: `เทียบกับ${high.branch}ที่ ${fmtPct(high.rate)} — สมาชิก${low.branch} ${fmtNum(low.notYet)} คนสมัครแล้วยังไม่เคยกลับมาซื้อ`,
      a: `ส่งคูปองแก้วแรกให้สมาชิกที่ยังไม่ซื้อ เริ่มจาก${low.branch}`,
    },
    {
      t: `กลุ่มใหญ่สุดคือ ${biggestAge.age} ปี (${fmtNum(biggestAge.total)} คน)`,
      d: `แต่กลุ่มที่ใช้จ่ายต่อคนสูงสุดคือ ${topSpendAge.age} ปี (${fmtBaht(topSpendAge.avgSpend)}/คน) — จำนวนคนมากไม่ได้แปลว่าใช้จ่ายมากที่สุด`,
      a: "ออกแบบโปรฯ แยกกลุ่ม: ดึงคนจำนวนมากด้วยราคา และดูแลกลุ่มใช้จ่ายสูงด้วยสิทธิพิเศษ",
    },
    {
      t: `เบอร์โทรซ้ำ ${fmtNum(q.shared)} คน`,
      d: "อาจเป็นคนในบ้านเดียวกันหรือสมัครซ้ำ ถ้าส่ง SMS โปรฯ จะได้ข้อความซ้ำ และนับจำนวนสมาชิกเกินจริง",
      a: "ส่งรายชื่อให้ทีม CRM ตรวจก่อนรวมบัญชี",
    },
  ];
  return (
    <Card className={className} title="📝 ข้อสังเกตจากข้อมูลลูกค้า" sub="ตัวเลขคำนวณจากข้อมูลจริงตามสาขาที่เลือก">
      <ol className="grid gap-3">
        {items.map((it, i) => (
          <li key={it.t} className="rounded-xl bg-foam/70 p-3">
            <div className="flex gap-2 font-semibold text-espresso">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-roast text-xs text-cream">{i + 1}</span>
              {it.t}
            </div>
            <p className="mt-1 text-sm text-roast">{it.d}</p>
            <p className="mt-1 text-sm text-espresso">👉 {it.a}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
