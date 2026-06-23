"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { evaluate, fmtValue, perfStatus, statusMeta, Thresholds, DEFAULT_THRESHOLDS } from "@/lib/calc";

type Role = "admin" | "manager";
type Unit = "percent" | "number";

interface Me {
  id: string;
  name: string;
  email: string;
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
  thresholds: Thresholds;
}

const EMPTY_REF: RefData = {
  sectors: [],
  indicators: [],
  periods: [],
  thresholds: DEFAULT_THRESHOLDS,
};

const GAUGE = { weak: "#ef4444", good: "#f59e0b", excellent: "#22c55e", track: "rgba(255,255,255,0.08)" };
function statusColor(s: string) {
  return s === "excellent" ? GAUGE.excellent : s === "good" ? GAUGE.good : s === "weak" ? GAUGE.weak : "#475569";
}

export default function Dashboard({ me }: { me: Me }) {
  const router = useRouter();
  const isAdmin = me.role === "admin";
  const [tab, setTab] = useState<string>("overview");
  const [refData, setRefData] = useState<RefData>(EMPTY_REF);
  const [loaded, setLoaded] = useState(false);

  const loadRef = useCallback(async () => {
    const [s, i, p, st] = await Promise.all([
      fetch("/api/sectors").then((r) => r.json()),
      fetch(`/api/indicators${isAdmin ? "?all=1" : ""}`).then((r) => r.json()),
      fetch("/api/periods").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setRefData({
      sectors: s.sectors || [],
      indicators: i.indicators || [],
      periods: p.periods || [],
      thresholds: st.settings
        ? { good: st.settings.goodThreshold, excellent: st.settings.excellentThreshold }
        : DEFAULT_THRESHOLDS,
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
            {tab === "entry" && <DataEntry me={me} refData={refData} />}
            {tab === "structure" && isAdmin && <StructureManager refData={refData} reload={loadRef} />}
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
  thresholds,
  max = 120,
}: {
  value: number | null;
  thresholds: Thresholds;
  max?: number;
}) {
  const cx = 100;
  const cy = 95;
  const r = 72;
  const sw = 16;
  const v = value == null ? 0 : Math.max(0, Math.min(value, max));
  const status = perfStatus(value, thresholds);
  const color = statusColor(status);
  const needleAngle = 180 - (v / max) * 180;
  const [nx, ny] = polar(cx, cy, r - 6, needleAngle);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox="0 0 200 118" width="100%" style={{ display: "block" }}>
        {/* المناطق الثلاث */}
        <path d={arc(cx, cy, r, 0, thresholds.good, max)} stroke={GAUGE.weak} strokeWidth={sw} fill="none" strokeLinecap="round" />
        <path d={arc(cx, cy, r, thresholds.good, thresholds.excellent, max)} stroke={GAUGE.good} strokeWidth={sw} fill="none" />
        <path d={arc(cx, cy, r, thresholds.excellent, max, max)} stroke={GAUGE.excellent} strokeWidth={sw} fill="none" strokeLinecap="round" />
        {/* الإبرة */}
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
function Overview({ me, refData }: { me: Me; refData: RefData }) {
  const sectors = visibleSectors(me, refData);
  const indicators = activeIndicators(refData);
  const thr = refData.thresholds;
  const [periodId, setPeriodId] = useState(refData.periods[0]?.id || "");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSector, setOpenSector] = useState<string | null>(null);

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
  const achOf = useCallback(
    (sectorId: string, indId: string, pId: string): number | null => {
      const m = mMap.get(mkey(sectorId, indId, pId));
      return evaluate(m?.actual, m?.target).achievement;
    },
    [mMap]
  );

  // نسبة كل مؤشر (متوسط القطاعات) للفترة المختارة
  const indData = useMemo(
    () =>
      indicators.map((ind, i) => {
        const vals = sectors
          .map((s) => achOf(s.id, ind.id, periodId))
          .filter((v): v is number => v != null);
        const a = avg(vals);
        const value = a == null ? null : Math.round(a);
        const status = perfStatus(a, thr);
        return { ...ind, num: i + 1, value, status };
      }),
    [indicators, sectors, periodId, achOf, thr]
  );

  const counts = useMemo(() => {
    const c = { excellent: 0, good: 0, weak: 0 };
    indData.forEach((d) => {
      if (d.status in c) c[d.status as keyof typeof c]++;
    });
    return c;
  }, [indData]);

  const overall = useMemo(() => {
    const vals = indData.filter((d) => d.value != null).map((d) => d.value as number);
    return vals.length ? Math.round(avg(vals)!) : null;
  }, [indData]);

  function sectorAch(sectorId: string): number | null {
    const vals = indicators
      .map((ind) => achOf(sectorId, ind.id, periodId))
      .filter((v): v is number => v != null);
    return avg(vals) == null ? null : Math.round(avg(vals)!);
  }

  function exportCsv() {
    const header = ["القطاع", "المؤشر", "الوحدة", "الربع", "المستهدف", "المحقق", "نسبة الإنجاز %"];
    const rows: string[][] = [];
    for (const s of sectors)
      for (const ind of indicators)
        for (const p of refData.periods) {
          const m = mMap.get(mkey(s.id, ind.id, p.id));
          const rr = evaluate(m?.actual, m?.target, thr);
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

  if (refData.periods.length === 0) {
    return <div className="empty">لا توجد فترات. أضفها من تبويب الهيكل التنظيمي.</div>;
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <label style={{ marginBottom: 4 }}>الفترة</label>
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {refData.periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
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

      {/* المربعات الخمسة */}
      <div className="kpis">
        <div className="kpi">
          <div className="v" style={{ color: "#22d3ee" }}>{overall != null ? `${overall}%` : "—"}</div>
          <div className="l">الإنجاز العام للمؤشرات</div>
        </div>
        <div className="kpi">
          <div className="v">{indicators.length}</div>
          <div className="l">عدد المؤشرات</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ color: GAUGE.excellent }}>{counts.excellent}</div>
          <div className="l">المؤشرات وفق المسار</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ color: GAUGE.good }}>{counts.good}</div>
          <div className="l">المؤشرات المتعثرة جزئيًا</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ color: GAUGE.weak }}>{counts.weak}</div>
          <div className="l">المؤشرات المتعثرة</div>
        </div>
      </div>

      {/* المؤشرات التسعة كعدّادات */}
      {loading ? (
        <div className="empty">جارٍ التحميل...</div>
      ) : (
        <div className="gauge-grid">
          {indData.map((ind) => (
            <div key={ind.id} className="gauge-box" style={{ borderTopColor: statusColor(ind.status) }}>
              <div className="gauge-head">
                <span className="gauge-num">المؤشر {ind.num}</span>
              </div>
              <div className="gauge-name" title={ind.name}>
                {ind.name}
              </div>
              <Gauge value={ind.value} thresholds={thr} />
              <div className="gauge-status" style={{ color: statusColor(ind.status) }}>
                {statusMeta(ind.status).label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* تفاصيل القطاعات */}
      <h2 className="section-title" style={{ marginTop: 28 }}>
        تفاصيل القطاعات
      </h2>
      <div className="sector-list">
        {sectors.map((s) => {
          const ach = sectorAch(s.id);
          const status = perfStatus(ach, thr);
          const meta = statusMeta(status);
          const isOpen = openSector === s.id;
          return (
            <div key={s.id} className="sector-panel">
              <button className="sector-head" onClick={() => setOpenSector(isOpen ? null : s.id)}>
                <span className="sector-arrow">{isOpen ? "▼" : "◀"}</span>
                <span className="sector-name">{s.name}</span>
                <span className="sector-pct" style={{ background: meta.color, color: meta.text }}>
                  {ach != null ? `${ach}%` : "—"}
                </span>
              </button>
              {isOpen && (
                <SectorDetail sector={s} indicators={indicators} periods={refData.periods} mMap={mMap} thr={thr} />
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
  thr,
}: {
  sector: Sector;
  indicators: Indicator[];
  periods: Period[];
  mMap: Map<string, Measurement>;
  thr: Thresholds;
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
                const r = evaluate(m?.actual, m?.target, thr);
                return (
                  <ValueCells
                    key={p.id}
                    target={fmtValue(m?.target, ind.unit)}
                    actual={fmtValue(m?.actual, ind.unit)}
                    pct={r.achievement != null ? `${Math.round(r.achievement)}%` : "—"}
                    color={r.color}
                    text={r.text}
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
  color,
  text,
}: {
  target: string;
  actual: string;
  pct: string;
  color: string;
  text: string;
}) {
  return (
    <>
      <td className="mini">{target}</td>
      <td className="mini">{actual}</td>
      <td className="mini" style={{ background: color, color: text, fontWeight: 700 }}>
        {pct}
      </td>
    </>
  );
}

/* ============ إدخال البيانات ============ */
function DataEntry({ me, refData }: { me: Me; refData: RefData }) {
  const sectors = visibleSectors(me, refData);
  const indicators = activeIndicators(refData);
  const thr = refData.thresholds;
  const [sectorId, setSectorId] = useState(sectors[0]?.id || "");
  const [periodId, setPeriodId] = useState(refData.periods[0]?.id || "");
  const [vals, setVals] = useState<Record<string, { target: string; actual: string }>>({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const loadVals = useCallback(async () => {
    if (!sectorId || !periodId) {
      setVals({});
      return;
    }
    const d = await fetch(`/api/measurements?sectorId=${sectorId}&periodId=${periodId}`).then((r) => r.json());
    const map: Record<string, { target: string; actual: string }> = {};
    for (const m of (d.measurements || []) as Measurement[]) {
      map[m.indicatorId] = {
        target: m.target != null ? String(m.target) : "",
        actual: m.actual != null ? String(m.actual) : "",
      };
    }
    setVals(map);
  }, [sectorId, periodId]);

  useEffect(() => {
    loadVals();
  }, [loadVals]);

  function setVal(indId: string, key: "target" | "actual", v: string) {
    setVals((s) => ({ ...s, [indId]: { ...(s[indId] || { target: "", actual: "" }), [key]: v } }));
  }

  async function save() {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const items = indicators.map((ind) => ({
        sectorId,
        indicatorId: ind.id,
        periodId,
        target: vals[ind.id]?.target ?? "",
        actual: vals[ind.id]?.actual ?? "",
      }));
      const res = await fetch("/api/measurements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || "تعذّر الحفظ");
      else setMsg("تم حفظ البيانات بنجاح ✓");
    } finally {
      setLoading(false);
    }
  }

  if (sectors.length === 0) {
    return <div className="empty">لم تُسند لك أي قطاعات بعد. تواصل مع مدير الإدارة لإسناد قطاع لك.</div>;
  }
  if (refData.periods.length === 0) {
    return <div className="empty">لا توجد فترات. أضفها من تبويب الهيكل التنظيمي.</div>;
  }

  return (
    <div className="card">
      <h2 className="section-title">إدخال قياسات الأداء</h2>
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
          <label>الربع</label>
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {refData.periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 280 }}>المؤشر</th>
              <th>المستهدف</th>
              <th>المحقق</th>
              <th>نسبة الإنجاز</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind, i) => {
              const tv = vals[ind.id]?.target ?? "";
              const av = vals[ind.id]?.actual ?? "";
              const r = evaluate(av === "" ? null : Number(av), tv === "" ? null : Number(tv), thr);
              return (
                <tr key={ind.id}>
                  <td>
                    <strong>م{i + 1}.</strong> {ind.name}{" "}
                    <span className="muted">({ind.unit === "percent" ? "%" : "عدد"})</span>
                  </td>
                  <td style={{ width: 110 }}>
                    <input type="number" step="any" value={tv} onChange={(e) => setVal(ind.id, "target", e.target.value)} />
                  </td>
                  <td style={{ width: 110 }}>
                    <input type="number" step="any" value={av} onChange={(e) => setVal(ind.id, "actual", e.target.value)} />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className="badge" style={{ background: r.color, color: r.text }}>
                      {r.achievement != null ? `${Math.round(r.achievement)}% · ${r.label}` : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="btn" onClick={save} disabled={loading}>
          {loading ? "جارٍ الحفظ..." : "حفظ القياسات"}
        </button>
      </div>
    </div>
  );
}

/* ============ الهيكل التنظيمي ============ */
function StructureManager({ refData, reload }: { refData: RefData; reload: () => void }) {
  const [sub, setSub] = useState<"sectors" | "indicators" | "periods" | "thresholds">("sectors");
  return (
    <div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${sub === "sectors" ? "active" : ""}`} onClick={() => setSub("sectors")}>
          القطاعات
        </button>
        <button className={`tab ${sub === "indicators" ? "active" : ""}`} onClick={() => setSub("indicators")}>
          المؤشرات
        </button>
        <button className={`tab ${sub === "periods" ? "active" : ""}`} onClick={() => setSub("periods")}>
          الفترات
        </button>
        <button className={`tab ${sub === "thresholds" ? "active" : ""}`} onClick={() => setSub("thresholds")}>
          عتبات الحالة
        </button>
      </div>
      {sub === "sectors" && <SectorsManager refData={refData} reload={reload} />}
      {sub === "indicators" && <IndicatorsManager refData={refData} reload={reload} />}
      {sub === "periods" && <PeriodsManager refData={refData} reload={reload} />}
      {sub === "thresholds" && <ThresholdsManager refData={refData} reload={reload} />}
    </div>
  );
}

function ThresholdsManager({ refData, reload }: { refData: RefData; reload: () => void }) {
  const [good, setGood] = useState(String(refData.thresholds.good));
  const [excellent, setExcellent] = useState(String(refData.thresholds.excellent));
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save() {
    setMsg("");
    setErr("");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goodThreshold: Number(good), excellentThreshold: Number(excellent) }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error || "تعذّر الحفظ");
    else {
      setMsg("تم حفظ العتبات ✓");
      reload();
    }
  }

  return (
    <div className="card">
      <h2 className="section-title">عتبات حالة المؤشرات</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        تتحكم في تلوين المؤشرات حسب نسبة الإنجاز. أي مؤشر تحت حد التعثر الجزئي يعتبر متعثرًا (أحمر).
      </p>
      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}
      <div className="row">
        <div>
          <label>
            <span className="dot" style={{ background: GAUGE.good, display: "inline-block", marginInlineEnd: 6 }} />
            حد &quot;متعثر جزئيًا&quot; (أصفر) — النسبة من
          </label>
          <input type="number" step="any" value={good} onChange={(e) => setGood(e.target.value)} />
        </div>
        <div>
          <label>
            <span className="dot" style={{ background: GAUGE.excellent, display: "inline-block", marginInlineEnd: 6 }} />
            حد &quot;وفق المسار&quot; (أخضر) — النسبة من
          </label>
          <input type="number" step="any" value={excellent} onChange={(e) => setExcellent(e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: 8 }} className="muted">
        مثال: متعثر &lt; {good || "؟"}% · متعثر جزئيًا {good || "؟"}–{excellent || "؟"}% · وفق المسار ≥ {excellent || "؟"}%
      </div>
      <button className="btn" style={{ marginTop: 16 }} onClick={save}>
        حفظ العتبات
      </button>
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
    const v = prompt("اسم الفترة الجديد:", current);
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
    if (!confirm("حذف الفترة سيحذف قياساتها. متابعة؟")) return;
    await fetch(`/api/periods/${id}`, { method: "DELETE" });
    reload();
  }
  return (
    <div className="card">
      <h2 className="section-title">الفترات ({refData.periods.length})</h2>
      <div className="row" style={{ marginBottom: 16 }}>
        <input placeholder="مثال: الربع الأول 2026" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn" onClick={add}>
            إضافة فترة
          </button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>الفترة</th>
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
  email: string;
  name: string;
  role: Role;
  active: boolean;
  sectorIds: string[];
}
function UsersManager({ refData }: { refData: RefData }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
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
      body: JSON.stringify({ email, name, role, sectorIds: role === "manager" ? sectorIds : [] }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error || "خطأ");
    else {
      setMsg(`تمت إضافة ${d.user.name} ✓`);
      setEmail("");
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
              <label>إيميل الدوام</label>
              <input
                type="email"
                value={email}
                dir="ltr"
                style={{ textAlign: "left" }}
                onChange={(e) => setEmail(e.target.value)}
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
            <th>الإيميل</th>
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
                {u.email}
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
