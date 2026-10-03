// ชิ้นส่วน UI ที่ใช้ร่วมกันทั้งหน้ายอดขายและหน้าลูกค้า

export function Centered({ children }) {
  return <div className="grid min-h-screen place-items-center p-6 text-lg text-roast">{children}</div>;
}

export function Card({ title, sub, children, className = "", action }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-latte/50 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-espresso">{title}</h2>
          {sub && <p className="text-sm text-roast/70">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Kpi({ icon, label, value, hint }) {
  return (
    <div className="min-w-0 rounded-2xl border border-latte/50 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm font-medium text-roast/80">
        {label}
        <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-foam">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-espresso sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs text-roast/60">{hint}</div>
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-foam p-1 text-xs font-medium">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`rounded-full px-3 py-1 transition ${value === o.key ? "bg-white text-espresso shadow" : "text-roast/70 hover:text-roast"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-latte bg-white/95 px-3 py-2 text-sm shadow-lg">
      <div className="mb-1 font-semibold text-espresso">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-roast">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b className="tabular-nums">{valueFormatter(p.value, p.dataKey)}</b>
        </div>
      ))}
    </div>
  );
}
