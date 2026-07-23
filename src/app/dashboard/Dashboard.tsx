"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { evaluate, fmtValue, fmtNum, bandOf, tint, Band, DEFAULT_BANDS } from "@/lib/calc";

type Role = "admin" | "manager";
type Unit = "percent" | "number";

interface Me {
  id: string;
  name: string;
  phone: string;
  role: Role;
  sectorIds: string[];
}
interface Sector {
  id: string;
  name: string;
  order: number;
}
interface Indicator {
  id: string;
  name: string;
  unit: Unit;
  active: boolean;
  order: number;
}
interface Period {
  id: string;
  label: string;
  order: number;
  weekStart?: string;
}

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayISO(): string {
  return isoDate(new Date());
}
// حساب أسبوع التاريخ (يبدأ الأحد) وإرجاع تاريخ البداية واسم معروض بالتاريخ
function weekOf(dateStr: string): { weekStart: string; label: string } {
  const d = new Date(dateStr + "T00:00:00");
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay()); // الأحد
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // السبت
  const label =
    start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()} ${AR_MONTHS[start.getMonth()]} ${start.getFullYear()}`
      : `${start.getDate()} ${AR_MONTHS[start.getMonth()]} – ${end.getDate()} ${AR_MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  return { weekStart: isoDate(start), label };
}
interface Measurement {
  id: string;
  sectorId: string;
  indicatorId: string;
  periodId: string;
  target: number | null;
  actual: number | null;
  updatedAt: string;
}
interface RefData {
  sectors: Sector[];
  indicators: Indicator[];
  periods: Period[];
  statuses: Band[]; // حالات الأداء القابلة للتخصيص
  targets: Record<string, number>; // المستهدفات السنوية لكل (قطاع|مؤشر)
}

const EMPTY_REF: RefData = {
  sectors: [],
  indicators: [],
  periods: [],
  statuses: DEFAULT_BANDS,
  targets: {},
};

function tkey(sectorId: string, indicatorId: string) {
  return `${sectorId}|${indicatorId}`;
}

const GAUGE_TRACK = "rgba(255,255,255,0.08)";

export default function Dashboard({ me }: { me: Me }) {
  const router = useRouter();
  const isAdmin = me.role === "admin";
  const [tab, setTab] = useState<string>("overview");
  const [refData, setRefData] = useState<RefData>(EMPTY_REF);
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const loadRef = useCallback(async () => {
    const [s, i, p, st, tg] = await Promise.all([
      fetch("/api/sectors").then((r) => r.json()),
      fetch(`/api/indicators${isAdmin ? "?all=1" : ""}`).then((r) => r.json()),
      fetch("/api/periods").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/targets").then((r) => r.json()),
    ]);
    setRefData({
      sectors: s.sectors || [],
      indicators: i.indicators || [],
      periods: p.periods || [],
      statuses: st.settings?.statuses?.length ? st.settings.statuses : DEFAULT_BANDS,
      targets: tg.targets || {},
    });
    setLoaded(true);
  }, [isAdmin]);

  useEffect(() => {
    loadRef();
  }, [loadRef]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="topbar">
        <div className="brand">إدارة عمليات الأداء</div>
        <div className="user">
          <span>
            {me.name}{" "}
            <span className={`badge ${isAdmin ? "badge-admin" : "badge-manager"}`}>
              {isAdmin ? "مدير الإدارة" : "مدير قطاع"}
            </span>
          </span>
          <select
            className="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            title="الثيم / لون الخلفية"
            aria-label="الثيم"
          >
            <option value="dark">🌙 داكن</option>
            <option value="light">☀️ فاتح</option>
            <option value="black">⚫ أسود</option>
            <option value="slate">🌫️ رمادي</option>
            <option value="royal">🔵 أزرق</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            خروج
          </button>
        </div>
      </div>

      <div className="container">
        <div className="tabs">
          <button className={`tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
            النظرة العامة
          </button>
          <button className={`tab ${tab === "weekly" ? "active" : ""}`} onClick={() => setTab("weekly")}>
            التحديث الأسبوعي
          </button>
          <button className={`tab ${tab === "entry" ? "active" : ""}`} onClick={() => setTab("entry")}>
            إدخال البيانات
          </button>
          {isAdmin && (
            <>
              <button className={`tab ${tab === "structure" ? "active" : ""}`} onClick={() => setTab("structure")}>
                الهيكل التنظيمي
              </button>
              <button className={`tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
                المدراء والصلاحيات
              </button>
            </>
          )}
        </div>

        {!loaded ? (
          <div className="empty">جارٍ التحميل...</div>
        ) : (
          <>
            {tab === "overview" && <Overview me={me} refData={refData} />}
            {tab === "weekly" && <WeeklyReview me={me} refData={refData} />}
            {tab === "entry" && <EntrySection me={me} refData={refData} reload={loadRef} />}
            {tab === "structure" && isAdmin && <SectorsManager refData={refData} reload={loadRef} />}
            {tab === "users" && isAdmin && <UsersManager refData={refData} />}
          </>
        )}
      </div>
    </>
  );
}

/* ============ أدوات مساعدة ============ */
function visibleSectors(me: Me, refData: RefData): Sector[] {
  if (me.role === "admin") return refData.sectors;
  return refData.sectors.filter((s) => me.sectorIds.includes(s.id));
}
function activeIndicators(refData: RefData): Indicator[] {
  return refData.indicators.filter((i) => i.active);
}
function mkey(sectorId: string, indicatorId: string, periodId: string) {
  return `${sectorId}|${indicatorId}|${periodId}`;
}

/* ============ عدّاد نصف دائري (Gauge) ============ */
function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}
function arc(cx: number, cy: number, r: number, v0: number, v1: number, max: number) {
  const a0 = 180 - (Math.min(v0, max) / max) * 180;
  const a1 = 180 - (Math.min(v1, max) / max) * 180;
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function Gauge({
  value,
  bands,
  max = 120,
}: {
  value: number | null;
  bands: Band[];
  max?: number;
}) {
  const cx = 100;
  const cy = 95;
  const r = 72;
  const sw = 16;
  const v = value == null ? 0 : Math.max(0, Math.min(value, max));
  const color = bandOf(value, bands)?.color ?? "#64748b";
  const needleAngle = 180 - (v / max) * 180;
  const [nx, ny] = polar(cx, cy, r - 6, needleAngle);
  // رسم أقواس ملوّنة من الحالات (كل حالة من نسبتها إلى بداية التالية)
  const sorted = [...bands].sort((a, b) => a.from - b.from);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox="0 0 200 118" width="100%" style={{ display: "block" }}>
        <path d={arc(cx, cy, r, 0, max, max)} stroke={GAUGE_TRACK} strokeWidth={sw} fill="none" strokeLinecap="round" />
        {sorted.map((b, i) => {
          const to = i < sorted.length - 1 ? sorted[i + 1].from : max;
          if (to <= b.from) return null;
          return (
            <path
              key={i}
              d={arc(cx, cy, r, b.from, to, max)}
              stroke={b.color}
              strokeWidth={sw}
              fill="none"
              strokeLinecap={i === 0 || i === sorted.length - 1 ? "round" : "butt"}
            />
          );
        })}
        {value != null && (
          <>
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e8eefc" strokeWidth={3} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={6} fill="#e8eefc" />
          </>
        )}
      </svg>
      <div style={{ textAlign: "center", marginTop: -10 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color }}>
          {value == null ? "—" : `${Math.round(value)}%`}
        </span>
      </div>
    </div>
  );
}

/* ============ النظرة العامة ============ */
const SCOPES: { key: string; label: string; q: number | null }[] = [
  { key: "year", label: "السنة كاملة", q: null },
  { key: "q1", label: "الربع الأول", q: 1 },
  { key: "q2", label: "الربع الثاني", q: 2 },
  { key: "q3", label: "الربع الثالث", q: 3 },
  { key: "q4", label: "الربع الرابع", q: 4 },
];
function periodQuarter(p: Period): number | null {
  if (!p.weekStart) return null;
  const m = Number(p.weekStart.slice(5, 7)) - 1;
  return Number.isFinite(m) ? Math.floor(m / 3) + 1 : null;
}

function Overview({ me, refData }: { me: Me; refData: RefData }) {
  const sectors = visibleSectors(me, refData);
  const indicators = activeIndicators(refData);
  const bands = refData.statuses;
  const [scope, setScope] = useState("year");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSector, setOpenSector] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null); // اسم الحالة
  const [openIndicator, setOpenIndicator] = useState<(Indicator & { num: number }) | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetch("/api/measurements").then((r) => r.json());
    setMeasurements(d.measurements || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const mMap = useMemo(() => {
    const m = new Map<string, Measurement>();
    for (const x of measurements) m.set(mkey(x.sectorId, x.indicatorId, x.periodId), x);
    return m;
  }, [measurements]);

  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  // الأسابيع ضمن النطاق المختار (سنة أو ربع)
  const scopeWeeks = useMemo(() => {
    const q = SCOPES.find((x) => x.key === scope)?.q ?? null;
    if (q == null) return refData.periods;
    return refData.periods.filter((p) => periodQuarter(p) === q);
  }, [scope, refData.periods]);

  // نسبة إنجاز (قطاع×مؤشر) = مجموع المنجز في النطاق ÷ المستهدف السنوي
  const achOf = useCallback(
    (sectorId: string, indId: string): number | null => {
      const target = refData.targets[tkey(sectorId, indId)] ?? null;
      if (!target || target <= 0) return null;
      let sum = 0;
      let has = false;
      for (const p of scopeWeeks) {
        const a = mMap.get(mkey(sectorId, indId, p.id))?.actual;
        if (a != null) {
          sum += a;
          has = true;
        }
      }
      return has ? (sum / target) * 100 : null;
    },
    [mMap, scopeWeeks, refData.targets]
  );

  const indData = useMemo(
    () =>
      indicators.map((ind, i) => {
        const vals = sectors.map((s) => achOf(s.id, ind.id)).filter((v): v is number => v != null);
        const a = avg(vals);
        const value = a == null ? null : Math.round(a);
        const band = bandOf(a, bands);
        return { ...ind, num: i + 1, value, band, bandLabel: band?.label ?? null };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indicators, sectors, achOf, bands]
  );

  const bandCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of bands) map[b.label] = 0;
    for (const d of indData) if (d.bandLabel) map[d.bandLabel] = (map[d.bandLabel] || 0) + 1;
    return map;
  }, [indData, bands]);

  const overall = useMemo(() => {
    const vals = indData.filter((d) => d.value != null).map((d) => d.value as number);
    return vals.length ? Math.round(avg(vals)!) : null;
  }, [indData]);

  const shownInd = statusFilter ? indData.filter((d) => d.bandLabel === statusFilter) : indData;

  function sectorAch(sectorId: string): number | null {
    const vals = indicators.map((ind) => achOf(sectorId, ind.id)).filter((v): v is number => v != null);
    return avg(vals) == null ? null : Math.round(avg(vals)!);
  }

  function exportCsv() {
    const header = ["القطاع", "المؤشر", "الوحدة", "الأسبوع", "المستهدف", "المحقق", "نسبة الإنجاز %"];
    const rows: string[][] = [];
    for (const s of sectors)
      for (const ind of indicators)
        for (const p of scopeWeeks) {
          const m = mMap.get(mkey(s.id, ind.id, p.id));
          const rr = evaluate(m?.actual, m?.target, bands);
          rows.push([
            s.name,
            ind.name,
            ind.unit === "percent" ? "نسبة" : "عدد",
            p.label,
            m?.target != null ? String(m.target) : "",
            m?.actual != null ? String(m.actual) : "",
            rr.achievement != null ? String(Math.round(rr.achievement)) : "",
          ]);
        }
    const csv = [header, ...rows]
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "الأداء.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <label style={{ marginBottom: 4 }}>النطاق</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            {SCOPES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={load}>
          تحديث
        </button>
        <button className="btn btn-sm" onClick={exportCsv}>
          ⬇ تصدير Excel
        </button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="v" style={{ color: "#22d3ee" }}>{overall != null ? `${overall}%` : "—"}</div>
          <div className="l">الإنجاز العام للمؤشرات</div>
        </div>
        <div className="kpi">
          <div className="v">{indicators.length}</div>
          <div className="l">عدد المؤشرات</div>
        </div>
        {bands.map((b) => (
          <div
            key={b.label}
            className={`kpi clickable${statusFilter === b.label ? " active" : ""}`}
            style={statusFilter === b.label ? { borderColor: b.color } : undefined}
            onClick={() => setStatusFilter(statusFilter === b.label ? null : b.label)}
          >
            <div className="v" style={{ color: b.color }}>{bandCounts[b.label] || 0}</div>
            <div className="l">{b.label}</div>
          </div>
        ))}
      </div>
      {statusFilter && (
        <div className="filter-note">
          عرض حالة: <strong>{statusFilter}</strong> فقط
          <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 10 }} onClick={() => setStatusFilter(null)}>
            إظهار الكل
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty">جارٍ التحميل...</div>
      ) : shownInd.length === 0 ? (
        <div className="empty">لا توجد مؤشرات مطابقة.</div>
      ) : (
        <div className="gauge-grid">
          {shownInd.map((ind) => (
            <div
              key={ind.id}
              className="gauge-box clickable"
              style={{ borderTopColor: ind.band?.color ?? "#475569" }}
              onClick={() => setOpenIndicator(ind)}
            >
              <div className="gauge-head">
                <span className="gauge-num">المؤشر {ind.num}</span>
              </div>
              <div className="gauge-name" title={ind.name}>
                {ind.name}
              </div>
              <Gauge value={ind.value} bands={bands} />
              <div className="gauge-status" style={{ color: ind.band?.color ?? "#64748b" }}>
                {ind.bandLabel ?? "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {openIndicator && (
        <IndicatorModal
          indicator={openIndicator}
          sectors={sectors}
          periods={scopeWeeks}
          mMap={mMap}
          bands={bands}
          onClose={() => setOpenIndicator(null)}
        />
      )}

      <h2 className="section-title" style={{ marginTop: 28 }}>
        تفاصيل القطاعات
      </h2>
      <div className="sector-list">
        {sectors.map((s) => {
          const ach = sectorAch(s.id);
          const band = bandOf(ach, bands);
          const isOpen = openSector === s.id;
          return (
            <div key={s.id} className="sector-panel">
              <button className="sector-head" onClick={() => setOpenSector(isOpen ? null : s.id)}>
                <span className="sector-arrow">{isOpen ? "▼" : "◀"}</span>
                <span className="sector-name">{s.name}</span>
                <span
                  className="sector-pct"
                  style={{ background: band ? tint(band.color) : "rgba(255,255,255,0.05)", color: band?.color ?? "#64748b" }}
                >
                  {ach != null ? `${ach}%` : "—"}
                </span>
              </button>
              {isOpen && (
                <SectorDetail sector={s} indicators={indicators} periods={scopeWeeks} mMap={mMap} bands={bands} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectorDetail({
  sector,
  indicators,
  periods,
  mMap,
  bands,
}: {
  sector: Sector;
  indicators: Indicator[];
  periods: Period[];
  mMap: Map<string, Measurement>;
  bands: Band[];
}) {
  return (
    <div className="sector-detail" style={{ overflowX: "auto" }}>
      <table className="detail-table">
        <thead>
          <tr>
            <th className="ind-col">المؤشر</th>
            {periods.map((p) => (
              <th key={p.id} colSpan={3}>
                {p.label}
              </th>
            ))}
          </tr>
          <tr className="sub-head">
            <th className="ind-col"></th>
            {periods.map((p) => (
              <SubHead key={p.id} />
            ))}
          </tr>
        </thead>
        <tbody>
          {indicators.map((ind, i) => (
            <tr key={ind.id}>
              <td className="ind-col">
                <strong>م{i + 1}.</strong> {ind.name}{" "}
                <span className="muted">({ind.unit === "percent" ? "%" : "عدد"})</span>
              </td>
              {periods.map((p) => {
                const m = mMap.get(mkey(sector.id, ind.id, p.id));
                const r = evaluate(m?.actual, m?.target, bands);
                return (
                  <ValueCells
                    key={p.id}
                    target={fmtValue(m?.target, ind.unit)}
                    actual={fmtValue(m?.actual, ind.unit)}
                    pct={r.achievement != null ? `${Math.round(r.achievement)}%` : "—"}
                    bg={r.bg}
                    color={r.color}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubHead() {
  return (
    <>
      <th className="mini">مستهدف</th>
      <th className="mini">محقق</th>
      <th className="mini">الإنجاز</th>
    </>
  );
}

function ValueCells({
  target,
  actual,
  pct,
  bg,
  color,
}: {
  target: string;
  actual: string;
  pct: string;
  bg: string;
  color: string;
}) {
  return (
    <>
      <td className="mini">{target}</td>
      <td className="mini">{actual}</td>
      <td className="mini" style={{ background: bg, color, fontWeight: 700 }}>
        {pct}
      </td>
    </>
  );
}

function IndicatorModal({
  indicator,
  sectors,
  periods,
  mMap,
  bands,
  onClose,
}: {
  indicator: Indicator & { num: number };
  sectors: Sector[];
  periods: Period[];
  mMap: Map<string, Measurement>;
  bands: Band[];
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 920 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>المؤشر {indicator.num}</div>
            <h3 style={{ margin: "4px 0 0" }}>{indicator.name}</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              مقارنة التطور عبر الأرباع · {indicator.unit === "percent" ? "نسبة %" : "عدد"}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            إغلاق
          </button>
        </div>

        <div className="sector-detail" style={{ overflowX: "auto", marginTop: 16, padding: 0 }}>
          <table className="detail-table">
            <thead>
              <tr>
                <th className="ind-col">القطاع</th>
                {periods.map((p) => (
                  <th key={p.id} colSpan={3}>
                    {p.label}
                  </th>
                ))}
              </tr>
              <tr className="sub-head">
                <th className="ind-col"></th>
                {periods.map((p) => (
                  <SubHead key={p.id} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sectors.map((s) => (
                <tr key={s.id}>
                  <td className="ind-col">{s.name}</td>
                  {periods.map((p) => {
                    const m = mMap.get(mkey(s.id, indicator.id, p.id));
                    const r = evaluate(m?.actual, m?.target, bands);
                    return (
                      <ValueCells
                        key={p.id}
                        target={fmtValue(m?.target, indicator.unit)}
                        actual={fmtValue(m?.actual, indicator.unit)}
                        pct={r.achievement != null ? `${Math.round(r.achievement)}%` : "—"}
                        bg={r.bg}
                        color={r.color}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ التحديث الأسبوعي ============ */
function TargetActualCell({
  target,
  actual,
  week,
  bg,
  fg,
  strong,
}: {
  target: number | null;
  actual: number;
  week: number | null;
  bg: string;
  fg: string;
  strong?: boolean;
}) {
  return (
    <div className="ta-cell" style={{ background: bg, color: fg }}>
      <div className="ta-box">
        <span className="ta-lbl">مستهدف</span>
        <span className="ta-val">{target != null ? fmtNum(target) : "—"}</span>
      </div>
      <div className="ta-sep" />
      <div className="ta-box">
        <span className="ta-lbl">منجز</span>
        <span className={"ta-val" + (strong ? " strong" : "")}>{fmtNum(actual)}</span>
      </div>
      {week != null && week > 0 && (
        <span className="ta-week" dir="ltr">
          +{fmtNum(week)}
        </span>
      )}
    </div>
  );
}

function WeeklyReview({ me, refData }: { me: Me; refData: RefData }) {
  const sectors = visibleSectors(me, refData);
  const indicators = activeIndicators(refData);
  const bands = refData.statuses;
  const [date, setDate] = useState(todayISO());
  const week = weekOf(date);
  const period = refData.periods.find((p) => p.weekStart === week.weekStart);
  const periodId = period?.id || "";
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  const load = useCallback(async () => {
    const d = await fetch("/api/measurements").then((r) => r.json());
    setMeasurements(d.measurements || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const mMap = useMemo(() => {
    const m = new Map<string, Measurement>();
    for (const x of measurements) m.set(mkey(x.sectorId, x.indicatorId, x.periodId), x);
    return m;
  }, [measurements]);

  // الأسابيع حتى الأسبوع المختار (لحساب التراكمي) — الترتيب زمني حسب تاريخ البداية
  const periodsSorted = useMemo(
    () => [...refData.periods].sort((a, b) => a.order - b.order),
    [refData.periods]
  );
  // ترتيب الأسبوع المختار زمنيًا (حتى لو لم يُنشأ له سجل بعد)
  const curOrder = Math.floor(new Date(week.weekStart + "T00:00:00Z").getTime() / 86400000);

  // جهات هذا الأسبوع + التراكمي حتى الآن لكل (قطاع×مؤشر)
  const indRows = useMemo(() => {
    const weeksUpTo = periodsSorted.filter((p) => p.order <= curOrder);
    const cumOf = (sId: string, iId: string) =>
      weeksUpTo.reduce((t, p) => {
        const a = mMap.get(mkey(sId, iId, p.id))?.actual;
        return a != null ? t + a : t;
      }, 0);
    return indicators.map((ind, i) => {
      const perSector = sectors.map((s) => {
        const target = refData.targets[tkey(s.id, ind.id)] ?? null;
        const week = mMap.get(mkey(s.id, ind.id, periodId))?.actual ?? null; // جهات هذا الأسبوع
        const cum = cumOf(s.id, ind.id); // التراكمي حتى الآن
        const band = target && target > 0 ? bandOf((cum / target) * 100, bands) : null;
        return { sector: s, week, cum, target, band };
      });
      const weekSum = perSector.reduce((t, ps) => (ps.week != null ? t + ps.week : t), 0);
      const cumSum = perSector.reduce((t, ps) => t + ps.cum, 0);
      const tgtSum = perSector.reduce((t, ps) => (ps.target != null ? t + ps.target : t), 0);
      const rowBand = tgtSum > 0 ? bandOf((cumSum / tgtSum) * 100, bands) : null;
      return { ind, num: i + 1, perSector, weekSum, cumSum, tgtSum, rowBand };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators, sectors, periodId, curOrder, mMap, bands, refData.targets, periodsSorted]);

  // عدّ الخلايا حسب الحالة (التقدّم التراكمي)
  const bandCounts: Record<string, number> = {};
  for (const b of bands) bandCounts[b.label] = 0;
  for (const r of indRows)
    for (const ps of r.perSector) if (ps.band) bandCounts[ps.band.label] = (bandCounts[ps.band.label] || 0) + 1;

  // إجماليات
  let weekTotal = 0;
  let cumTotal = 0;
  let tgtTotal = 0;
  for (const r of indRows) {
    weekTotal += r.weekSum;
    cumTotal += r.cumSum;
    tgtTotal += r.tgtSum;
  }

  // أبرز إنجازات هذا الأسبوع (أعلى تغطية جهات هذا الأسبوع)
  const weekWins: { indicator: string; sector: string; week: number; cum: number; target: number | null }[] = [];
  for (const r of indRows)
    for (const ps of r.perSector)
      if (ps.week != null && ps.week > 0)
        weekWins.push({ indicator: r.ind.name, sector: ps.sector.name, week: ps.week, cum: ps.cum, target: ps.target });
  weekWins.sort((a, b) => b.week - a.week);

  const periodLabel = week.label;
  const today = new Date().toLocaleDateString("ar-SA-u-nu-latn", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

  // تقرير PDF كامل (كل الفترات وكل التفاصيل) عبر نافذة طباعة
  function printPDF() {
    const sections = refData.periods
      .map((p) => {
        const rows = sectors
          .map((s) =>
            indicators
              .map((ind) => {
                const m = mMap.get(mkey(s.id, ind.id, p.id));
                const r = evaluate(m?.actual, m?.target, bands);
                return `<tr>
                  <td>${esc(s.name)}</td>
                  <td>${esc(ind.name)}</td>
                  <td class="c">${ind.unit === "percent" ? "نسبة" : "عدد"}</td>
                  <td class="c">${m?.target != null ? m.target : "—"}</td>
                  <td class="c">${m?.actual != null ? m.actual : "—"}</td>
                  <td class="c">${r.achievement != null ? Math.round(r.achievement) + "%" : "—"}</td>
                  <td class="c" style="background:${r.bg};color:${r.color}">${r.label}</td>
                </tr>`;
              })
              .join("")
          )
          .join("");
        return `<h2>${esc(p.label)}</h2>
          <table><thead><tr><th>القطاع</th><th>المؤشر</th><th>الوحدة</th><th>المستهدف</th><th>المحقق</th><th>الإنجاز</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table>`;
      })
      .join("");
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأداء</title>
      <style>
        *{font-family:"Segoe UI",Tahoma,Arial,sans-serif}
        body{padding:20px;color:#1a2233}
        h1{color:#0e3a5f;margin:0 0 2px;font-size:22px}
        .sub{color:#5b6b82;margin:0 0 14px;font-size:12px}
        h2{color:#0e3a5f;font-size:15px;margin:18px 0 6px;border-right:4px solid #22a3c4;padding-right:8px}
        table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11.5px}
        th,td{border:1px solid #d4dbe6;padding:5px 7px;text-align:right}
        th{background:#eef4f8}
        td.c{text-align:center}
        @media print{h2{page-break-after:avoid}tr{page-break-inside:avoid}}
      </style></head><body>
      <h1>تقرير حالة المؤشرات — إدارة عمليات الأداء</h1>
      <p class="sub">${esc(today)} · التراكمي/المستهدف: ${fmtNum(cumTotal)} / ${fmtNum(tgtTotal)}</p>
      ${sections}
      <script>window.onload=function(){window.print()}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  function exportExcel() {
    const header = ["القطاع", "المؤشر", "الوحدة", "الفترة", "المستهدف", "المحقق", "نسبة الإنجاز %", "الحالة"];
    const rows: string[][] = [];
    for (const s of sectors)
      for (const ind of indicators)
        for (const p of refData.periods) {
          const m = mMap.get(mkey(s.id, ind.id, p.id));
          const r = evaluate(m?.actual, m?.target, bands);
          rows.push([
            s.name,
            ind.name,
            ind.unit === "percent" ? "نسبة" : "عدد",
            p.label,
            m?.target != null ? String(m.target) : "",
            m?.actual != null ? String(m.actual) : "",
            r.achievement != null ? String(Math.round(r.achievement)) : "",
            r.label,
          ]);
        }
    const csv = [header, ...rows]
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "تقرير-الأداء-الكامل.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const cellOf = (band: Band | null) =>
    band ? { bg: tint(band.color), fg: band.color } : { bg: "rgba(255,255,255,0.04)", fg: "#64748b" };

  return (
    <div>
      {/* شريط العنوان للعرض الأسبوعي */}
      <div className="weekly-banner">
        <div>
          <div className="weekly-title">التحديث الأسبوعي لحالة المؤشرات</div>
          <div className="weekly-date">{today} · {periodLabel}</div>
        </div>
        <div className="weekly-actions">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayISO())}
            style={{
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 10,
              padding: "8px 10px",
            }}
          />
          <button className="btn btn-sm btn-ghost" onClick={load}>تحديث</button>
          <button className="btn btn-sm" onClick={printPDF}>🖨 حفظ PDF</button>
          <button className="btn btn-sm" onClick={exportExcel}>⬇ Excel</button>
        </div>
      </div>

      {/* ملخص سريع */}
      <div className="kpis" style={{ marginTop: 14 }}>
        <div className="kpi">
          <div className="v" style={{ color: "#22d3ee" }}>{fmtNum(weekTotal)}</div>
          <div className="l">جهات غُطّيت هذا الأسبوع</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ color: "#a78bfa" }} dir="ltr">
            {fmtNum(cumTotal)} / {fmtNum(tgtTotal)}
          </div>
          <div className="l">التراكمي / المستهدف السنوي</div>
        </div>
        {bands.map((b) => (
          <div className="kpi" key={b.label}>
            <div className="v" style={{ color: b.color }}>{bandCounts[b.label] || 0}</div>
            <div className="l">{b.label}</div>
          </div>
        ))}
      </div>

      {/* مصفوفة المؤشرات × القطاعات */}
      <div className="card" style={{ marginTop: 16, overflowX: "auto" }}>
        <h2 className="section-title">
          المستهدف والمنجز لكل قطاع
          <span className="muted" style={{ fontSize: 12, fontWeight: 400, marginRight: 8 }}>
            (المنجز = التراكمي حتى هذا الأسبوع · +N = المُغطّى هذا الأسبوع)
          </span>
        </h2>
        <table className="matrix">
          <thead>
            <tr>
              <th style={{ textAlign: "right", minWidth: 220 }}>المؤشر</th>
              {sectors.map((s) => (
                <th key={s.id}>{s.name}</th>
              ))}
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {indRows.map((r) => (
              <tr key={r.ind.id}>
                <td style={{ textAlign: "right" }}>
                  <span className="muted">م{r.num}.</span> {r.ind.name}
                </td>
                {r.perSector.map((ps) => {
                  const c = cellOf(ps.band);
                  return (
                    <td key={ps.sector.id}>
                      <TargetActualCell
                        target={ps.target}
                        actual={ps.cum}
                        week={ps.week}
                        bg={c.bg}
                        fg={c.fg}
                      />
                    </td>
                  );
                })}
                <td>
                  <TargetActualCell
                    target={r.tgtSum > 0 ? r.tgtSum : null}
                    actual={r.cumSum}
                    week={r.weekSum}
                    bg={cellOf(r.rowBand).bg}
                    fg={cellOf(r.rowBand).fg}
                    strong
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* أبرز إنجازات هذا الأسبوع */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="section-title" style={{ color: "#22c55e" }}>
          أبرز إنجازات هذا الأسبوع ({weekWins.length})
        </h2>
        {weekWins.length === 0 ? (
          <div className="muted">لم تُسجّل أي جهات مُغطّاة في هذا الأسبوع بعد.</div>
        ) : (
          <div className="weak-grid">
            {weekWins.slice(0, 12).map((w, i) => (
              <div key={i} className="weak-item" style={{ borderRightColor: "#22c55e" }}>
                <span className="weak-pct" style={{ color: "#22c55e" }} dir="ltr">
                  {fmtNum(w.week)}
                </span>
                <div>
                  <div className="weak-ind">{w.sector}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {w.indicator}
                    {w.target != null && (
                      <>
                        {" · "}
                        <span dir="ltr">
                          التراكمي {fmtNum(w.cum)}/{fmtNum(w.target)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ إدخال البيانات ============ */
function DataEntry({ me, refData, reload }: { me: Me; refData: RefData; reload: () => void }) {
  const sectors = visibleSectors(me, refData);
  const indicators = activeIndicators(refData);
  const bands = refData.statuses;
  const [sectorId, setSectorId] = useState(sectors[0]?.id || "");
  const [date, setDate] = useState(todayISO());
  const week = weekOf(date);
  const period = refData.periods.find((p) => p.weekStart === week.weekStart);
  const periodId = period?.id || "";
  const [vals, setVals] = useState<Record<string, string>>({}); // المنجز فقط
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const targetOf = (indId: string): number | null => refData.targets[tkey(sectorId, indId)] ?? null;

  const loadVals = useCallback(async () => {
    if (!sectorId || !periodId) {
      setVals({});
      return;
    }
    const d = await fetch(`/api/measurements?sectorId=${sectorId}&periodId=${periodId}`).then((r) => r.json());
    const map: Record<string, string> = {};
    for (const m of (d.measurements || []) as Measurement[]) {
      map[m.indicatorId] = m.actual != null ? String(m.actual) : "";
    }
    setVals(map);
  }, [sectorId, periodId]);

  useEffect(() => {
    loadVals();
  }, [loadVals]);

  function setVal(indId: string, v: string) {
    setVals((s) => ({ ...s, [indId]: v }));
  }

  async function ensurePeriodId(): Promise<string> {
    if (periodId) return periodId;
    const res = await fetch("/api/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: week.label, weekStart: week.weekStart }),
    });
    const d = await res.json();
    if (!res.ok || !d.period) throw new Error(d.error || "تعذّر إنشاء الأسبوع");
    return d.period.id as string;
  }

  async function save() {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      // تأكيد وجود الأسبوع (يُنشأ تلقائيًا من التاريخ إن لم يكن موجودًا)
      const pid = await ensurePeriodId();
      // المنجز لهذا الأسبوع فقط (المستهدف ثابت من شاشة المستهدفات)
      const items = indicators.map((ind) => ({
        sectorId,
        indicatorId: ind.id,
        periodId: pid,
        target: targetOf(ind.id) ?? "",
        actual: vals[ind.id] ?? "",
      }));
      const res = await fetch("/api/measurements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || "تعذّر الحفظ");
      else {
        setMsg("تم الحفظ بنجاح ✓");
        reload();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setLoading(false);
    }
  }

  if (sectors.length === 0) {
    return <div className="empty">لم تُسند لك أي قطاعات بعد. تواصل مع مدير الإدارة لإسناد قطاع لك.</div>;
  }

  return (
    <div className="card">
      <h2 className="section-title">إدخال المنجز الأسبوعي</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>
        اختر القطاع وتاريخ الأسبوع، ثم عبّئ <strong>المنجز</strong> لهذا الأسبوع (عدد الجهات). المستهدف
        ثابت للسنة ويُضبط من تبويب «المستهدفات».
      </p>
      <div className="row" style={{ marginBottom: 18 }}>
        <div>
          <label>القطاع</label>
          <select value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>اختر تاريخًا (يحدّد الأسبوع)</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
            الأسبوع: <strong style={{ color: "var(--text)" }}>{week.label}</strong>
            {!period && <span style={{ color: "#22c55e" }}> · (أسبوع جديد يُنشأ عند الحفظ)</span>}
          </div>
        </div>
      </div>

      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="entry-cards">
        {indicators.map((ind, i) => {
          const tgt = targetOf(ind.id);
          const av = vals[ind.id] ?? "";
          const r = evaluate(av === "" ? null : Number(av), tgt, bands);
          return (
            <div className="entry-card" key={ind.id}>
              <div className="ec-title">
                <span className="ec-num">م{i + 1}</span>
                {ind.name}
              </div>
              <div className="ec-boxes">
                <div className="ec-box">
                  <label>المستهدف (ثابت)</label>
                  <input
                    type="number"
                    value={tgt != null ? String(tgt) : ""}
                    placeholder="—"
                    disabled
                    title="يُضبط من تبويب المستهدفات"
                    readOnly
                  />
                </div>
                <div className="ec-box">
                  <label>المنجز</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="—"
                    value={av}
                    onChange={(e) => setVal(ind.id, e.target.value)}
                  />
                </div>
              </div>
              <div className="ec-status">
                <span className="badge" style={{ background: r.bg, color: r.color }}>
                  {r.achievement != null ? `${Math.round(r.achievement)}% · ${r.label}` : "لم يُعبّأ"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 18 }}>
        <button className="btn" onClick={save} disabled={loading}>
          {loading ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}

/* ============ قسم إدخال البيانات (مع تبويبات الإدارة) ============ */
function EntrySection({ me, refData, reload }: { me: Me; refData: RefData; reload: () => void }) {
  const isAdmin = me.role === "admin";
  const [sub, setSub] = useState<"entry" | "indicators" | "targets" | "periods" | "thresholds">(
    "entry"
  );
  return (
    <div>
      {isAdmin && (
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab ${sub === "entry" ? "active" : ""}`} onClick={() => setSub("entry")}>
            الإدخال
          </button>
          <button className={`tab ${sub === "indicators" ? "active" : ""}`} onClick={() => setSub("indicators")}>
            المؤشرات
          </button>
          <button className={`tab ${sub === "targets" ? "active" : ""}`} onClick={() => setSub("targets")}>
            المستهدفات
          </button>
          <button className={`tab ${sub === "periods" ? "active" : ""}`} onClick={() => setSub("periods")}>
            الأسابيع
          </button>
          <button className={`tab ${sub === "thresholds" ? "active" : ""}`} onClick={() => setSub("thresholds")}>
            عتبات الحالة
          </button>
        </div>
      )}
      {sub === "entry" && <DataEntry me={me} refData={refData} reload={reload} />}
      {sub === "indicators" && isAdmin && <IndicatorsManager refData={refData} reload={reload} />}
      {sub === "targets" && isAdmin && <TargetsManager refData={refData} reload={reload} />}
      {sub === "periods" && isAdmin && <PeriodsManager refData={refData} reload={reload} />}
      {sub === "thresholds" && isAdmin && <StatusBandsManager refData={refData} reload={reload} />}
    </div>
  );
}

/* ============ المستهدفات السنوية ============ */
function TargetsManager({ refData, reload }: { refData: RefData; reload: () => void }) {
  const sectors = refData.sectors;
  const indicators = refData.indicators;
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [k, v] of Object.entries(refData.targets || {})) init[k] = String(v);
    return init;
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function setVal(sectorId: string, indId: string, v: string) {
    setVals((s) => ({ ...s, [tkey(sectorId, indId)]: v }));
  }

  async function save() {
    setMsg("");
    setErr("");
    setLoading(true);
    try {
      const targets: Record<string, number> = {};
      for (const [k, v] of Object.entries(vals)) {
        const n = Number(v);
        if (v !== "" && Number.isFinite(n) && n >= 0) targets[k] = n;
      }
      const res = await fetch("/api/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      const d = await res.json();
      if (!res.ok) setErr(d.error || "تعذّر الحفظ");
      else {
        setMsg("تم حفظ المستهدفات ✓ (تُطبّق على كل الأسابيع)");
        reload();
      }
    } finally {
      setLoading(false);
    }
  }

  if (sectors.length === 0 || indicators.length === 0) {
    return <div className="empty">أضِف القطاعات والمؤشرات أولًا ثم اضبط المستهدفات.</div>;
  }

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <h2 className="section-title">المستهدفات السنوية (عدد الجهات لكل قطاع × مؤشر)</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>
        تُدخل مرة واحدة وتبقى ثابتة طوال السنة. المنجز يُحدّث أسبوعيًا من تبويب «إدخال المنجز».
      </p>
      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}
      <table className="matrix">
        <thead>
          <tr>
            <th style={{ textAlign: "right", minWidth: 220 }}>المؤشر</th>
            {sectors.map((s) => (
              <th key={s.id}>{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {indicators.map((ind, i) => (
            <tr key={ind.id}>
              <td style={{ textAlign: "right" }}>
                <span className="muted">م{i + 1}.</span> {ind.name}
              </td>
              {sectors.map((s) => (
                <td key={s.id}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    style={{ width: 80, textAlign: "center" }}
                    value={vals[tkey(s.id, ind.id)] ?? ""}
                    onChange={(e) => setVal(s.id, ind.id, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16 }}>
        <button className="btn" onClick={save} disabled={loading}>
          {loading ? "جارٍ الحفظ..." : "حفظ المستهدفات"}
        </button>
      </div>
    </div>
  );
}

function StatusBandsManager({ refData, reload }: { refData: RefData; reload: () => void }) {
  const [list, setList] = useState<Band[]>(() =>
    (refData.statuses.length ? refData.statuses : DEFAULT_BANDS).map((b) => ({ ...b }))
  );
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function upd(i: number, patch: Partial<Band>) {
    setList((s) => s.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function add() {
    const last = list[list.length - 1];
    setList((s) => [...s, { label: "حالة جديدة", color: "#3b82f6", from: last ? last.from + 10 : 0 }]);
  }
  function remove(i: number) {
    setList((s) => s.filter((_, idx) => idx !== i));
  }

  async function save() {
    setMsg("");
    setErr("");
    const statuses = list
      .filter((b) => b.label.trim())
      .map((b) => ({ label: b.label.trim(), color: b.color, from: Number(b.from) || 0 }));
    if (statuses.length === 0) {
      setErr("أضف حالة واحدة على الأقل");
      return;
    }
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statuses }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error || "تعذّر الحفظ");
    else {
      setMsg("تم حفظ الحالات ✓");
      reload();
    }
  }

  const sorted = [...list].sort((a, b) => a.from - b.from);

  return (
    <div className="card">
      <h2 className="section-title">حالات الأداء (الألوان والنِّسَب)</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        لكل حالة: اسم ولون والنسبة التي تبدأ منها. تُلوّن المؤشرات حسب أعلى حالة تتجاوز نسبتُها نسبةَ الإنجاز.
      </p>
      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      {list.map((b, i) => (
        <div key={i} className="band-row">
          <input
            type="color"
            className="band-color"
            value={/^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : "#3b82f6"}
            onChange={(e) => upd(i, { color: e.target.value })}
            title="اللون"
          />
          <input
            className="band-label"
            placeholder="اسم الحالة"
            value={b.label}
            onChange={(e) => upd(i, { label: e.target.value })}
          />
          <div className="band-from">
            <span className="muted">من %</span>
            <input
              type="number"
              min="0"
              value={String(b.from)}
              onChange={(e) => upd(i, { from: Number(e.target.value) })}
            />
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => remove(i)}>
            حذف
          </button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={add}>
          + إضافة حالة
        </button>
        <button className="btn" onClick={save}>
          حفظ الحالات
        </button>
      </div>

      <div className="muted" style={{ marginTop: 14, fontSize: 12 }}>
        معاينة:{" "}
        {sorted.map((b, i) => (
          <span
            key={i}
            style={{
              background: tint(b.color),
              color: b.color,
              padding: "3px 10px",
              borderRadius: 8,
              fontWeight: 700,
              marginInlineEnd: 6,
              display: "inline-block",
            }}
          >
            {b.label} ≥ {b.from}%
          </span>
        ))}
      </div>
    </div>
  );
}

function SectorsManager({ refData, reload }: { refData: RefData; reload: () => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  async function add() {
    setErr("");
    const res = await fetch("/api/sectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error || "خطأ");
    else {
      setName("");
      reload();
    }
  }
  async function rename(id: string, current: string) {
    const v = prompt("اسم القطاع الجديد:", current);
    if (v && v.trim()) {
      await fetch(`/api/sectors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: v }),
      });
      reload();
    }
  }
  async function remove(id: string) {
    if (!confirm("حذف القطاع سيحذف قياساته. متابعة؟")) return;
    await fetch(`/api/sectors/${id}`, { method: "DELETE" });
    reload();
  }
  return (
    <div className="card">
      <h2 className="section-title">القطاعات ({refData.sectors.length}/7)</h2>
      {err && <div className="alert alert-error">{err}</div>}
      <div className="row" style={{ marginBottom: 16 }}>
        <input placeholder="اسم القطاع" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn" onClick={add} disabled={refData.sectors.length >= 7}>
            إضافة قطاع
          </button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>القطاع</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {refData.sectors.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => rename(s.id, s.name)}>
                    تعديل
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>
                    حذف
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface EditableInd {
  id: string;
  name: string;
  unit: Unit;
  active: boolean;
}
function IndicatorsManager({ refData, reload }: { refData: RefData; reload: () => void }) {
  const [list, setList] = useState<EditableInd[]>(
    refData.indicators.map((i) => ({ id: i.id, name: i.name, unit: i.unit, active: i.active }))
  );
  const [msg, setMsg] = useState("");

  function upd(i: number, patch: Partial<EditableInd>) {
    setList((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function addInd() {
    setList((s) => [...s, { id: "", name: "", unit: "percent", active: true }]);
  }
  function removeInd(i: number) {
    setList((s) => s.filter((_, idx) => idx !== i));
  }
  async function save() {
    setMsg("");
    const res = await fetch("/api/indicators", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indicators: list.filter((x) => x.name.trim()) }),
    });
    if (res.ok) {
      setMsg("تم حفظ المؤشرات ✓");
      reload();
    }
  }
  return (
    <div className="card">
      <h2 className="section-title">المؤشرات ({list.length})</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        أضف أو احذف أو عدّل المؤشرات. اختر &quot;عدد&quot; للمؤشرات الرقمية و&quot;نسبة&quot; للنسب المئوية.
      </p>
      {msg && <div className="alert alert-success">{msg}</div>}
      {list.map((ind, i) => (
        <div key={i} className="field-row">
          <span className="muted" style={{ flex: "0 0 30px" }}>
            م{i + 1}
          </span>
          <input placeholder="اسم المؤشر" value={ind.name} onChange={(e) => upd(i, { name: e.target.value })} />
          <select
            value={ind.unit}
            onChange={(e) => upd(i, { unit: e.target.value as Unit })}
            style={{ flex: "0 0 110px" }}
          >
            <option value="percent">نسبة %</option>
            <option value="number">عدد</option>
          </select>
          <label className="checkbox-inline">
            <input type="checkbox" checked={ind.active} onChange={(e) => upd(i, { active: e.target.checked })} />
            مُفعّل
          </label>
          <button className="btn btn-danger btn-sm" style={{ flex: "0 0 auto" }} onClick={() => removeInd(i)}>
            حذف
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={addInd}>
          + إضافة مؤشر
        </button>
        <button className="btn" onClick={save}>
          حفظ المؤشرات
        </button>
      </div>
    </div>
  );
}

function PeriodsManager({ refData, reload }: { refData: RefData; reload: () => void }) {
  const [label, setLabel] = useState("");
  async function add() {
    if (!label.trim()) return;
    await fetch("/api/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setLabel("");
    reload();
  }
  async function rename(id: string, current: string) {
    const v = prompt("اسم الأسبوع الجديد:", current);
    if (v && v.trim()) {
      await fetch(`/api/periods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: v }),
      });
      reload();
    }
  }
  async function remove(id: string) {
    if (!confirm("حذف الأسبوع سيحذف بياناته. متابعة؟")) return;
    await fetch(`/api/periods/${id}`, { method: "DELETE" });
    reload();
  }
  return (
    <div className="card">
      <h2 className="section-title">الأسابيع ({refData.periods.length})</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>
        أضِف أسبوعًا جديدًا كل مرة تبين ترصدين فيها التحديث. المستهدفات تُنسخ تلقائيًا للأسبوع الجديد.
      </p>
      <div className="row" style={{ marginBottom: 16 }}>
        <input placeholder="مثال: أسبوع 1 · 5 يناير 2026" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn" onClick={add}>
            إضافة أسبوع
          </button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>الأسبوع</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {refData.periods.map((p) => (
            <tr key={p.id}>
              <td>{p.label}</td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => rename(p.id, p.label)}>
                    تعديل
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>
                    حذف
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============ المدراء والصلاحيات ============ */
interface UserRow {
  id: string;
  phone: string;
  name: string;
  role: Role;
  active: boolean;
  sectorIds: string[];
}
function UsersManager({ refData }: { refData: RefData }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("manager");
  const [sectorIds, setSectorIds] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const d = await fetch("/api/users").then((r) => r.json());
    setUsers(d.users || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function toggleSector(id: string) {
    setSectorIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name, role, sectorIds: role === "manager" ? sectorIds : [] }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error || "خطأ");
    else {
      setMsg(`تمت إضافة ${d.user.name} ✓`);
      setPhone("");
      setName("");
      setRole("manager");
      setSectorIds([]);
      load();
    }
  }

  async function patch(id: string, body: object) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }
  async function remove(u: UserRow) {
    if (!confirm(`حذف ${u.name}؟`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) alert(d.error || "تعذّر الحذف");
    else load();
  }

  async function editSectors(u: UserRow) {
    const names = refData.sectors.map((s, i) => `${i + 1}) ${s.name}`).join("\n");
    const input = prompt(
      `أرقام القطاعات لـ ${u.name} (مفصولة بفاصلة):\n${names}`,
      u.sectorIds
        .map((id) => refData.sectors.findIndex((s) => s.id === id) + 1)
        .filter((n) => n > 0)
        .join(",")
    );
    if (input == null) return;
    const idxs = input
      .split(/[،,]/)
      .map((x) => parseInt(x.trim(), 10) - 1)
      .filter((n) => n >= 0 && n < refData.sectors.length);
    const ids = idxs.map((n) => refData.sectors[n].id);
    patch(u.id, { sectorIds: ids });
  }

  const sectorNames = (ids: string[]) =>
    ids.map((id) => refData.sectors.find((s) => s.id === id)?.name).filter(Boolean).join("، ") || "—";

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 className="section-title">إضافة مستخدم</h2>
        <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
          مدير القطاع = يدخل بيانات قطاعاته فقط. مدير الإدارة = صلاحيات كاملة على كل القطاعات.
        </p>
        {err && <div className="alert alert-error">{err}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}
        <form onSubmit={add}>
          <div className="row">
            <div>
              <label>رقم الجوال</label>
              <input
                type="tel"
                inputMode="tel"
                placeholder="05XXXXXXXX"
                value={phone}
                dir="ltr"
                style={{ textAlign: "left" }}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <label>الاسم</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div style={{ flex: "0 0 170px" }}>
              <label>الصلاحية</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="manager">مدير قطاع</option>
                <option value="admin">مدير الإدارة</option>
              </select>
            </div>
          </div>
          {role === "manager" && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>القطاعات المسؤول عنها</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {refData.sectors.map((s) => (
                  <label key={s.id} className="checkbox-inline">
                    <input type="checkbox" checked={sectorIds.includes(s.id)} onChange={() => toggleSector(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <button className="btn" style={{ marginTop: 12 }}>
            إضافة
          </button>
        </form>
      </div>

      <h2 className="section-title">المستخدمون ({users.length})</h2>
      <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>رقم الجوال</th>
            <th>الصلاحية</th>
            <th>القطاعات</th>
            <th>الحالة</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td dir="ltr" style={{ textAlign: "right" }}>
                {u.phone}
              </td>
              <td>
                <span className={`badge ${u.role === "admin" ? "badge-admin" : "badge-manager"}`}>
                  {u.role === "admin" ? "مدير الإدارة" : "مدير قطاع"}
                </span>
              </td>
              <td>{u.role === "manager" ? sectorNames(u.sectorIds) : "الكل"}</td>
              <td>
                {u.active ? (
                  <span className="badge badge-manager">نشط</span>
                ) : (
                  <span className="badge badge-off">موقوف</span>
                )}
              </td>
              <td>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {u.role === "manager" && (
                    <button className="btn btn-ghost btn-sm" onClick={() => editSectors(u)}>
                      القطاعات
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => patch(u.id, { active: !u.active })}>
                    {u.active ? "إيقاف" : "تفعيل"}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>
                    حذف
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
