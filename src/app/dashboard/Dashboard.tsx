"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { evaluate, fmtValue } from "@/lib/calc";

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
interface Entity {
  id: string;
  sectorId: string;
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
  entityId: string;
  indicatorId: string;
  periodId: string;
  target: number | null;
  actual: number | null;
  updatedAt: string;
}
interface RefData {
  sectors: Sector[];
  entities: Entity[];
  indicators: Indicator[];
  periods: Period[];
}

const EMPTY_REF: RefData = { sectors: [], entities: [], indicators: [], periods: [] };

export default function Dashboard({ me }: { me: Me }) {
  const router = useRouter();
  const isAdmin = me.role === "admin";
  const [tab, setTab] = useState<string>("overview");
  const [refData, setRef] = useState<RefData>(EMPTY_REF);
  const [loaded, setLoaded] = useState(false);

  const loadRef = useCallback(async () => {
    const [s, e, i, p] = await Promise.all([
      fetch("/api/sectors").then((r) => r.json()),
      fetch("/api/entities").then((r) => r.json()),
      fetch(`/api/indicators${isAdmin ? "?all=1" : ""}`).then((r) => r.json()),
      fetch("/api/periods").then((r) => r.json()),
    ]);
    setRef({
      sectors: s.sectors || [],
      entities: e.entities || [],
      indicators: i.indicators || [],
      periods: p.periods || [],
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
          <button
            className={`tab ${tab === "overview" ? "active" : ""}`}
            onClick={() => setTab("overview")}
          >
            النظرة العامة
          </button>
          <button
            className={`tab ${tab === "entry" ? "active" : ""}`}
            onClick={() => setTab("entry")}
          >
            إدخال البيانات
          </button>
          {isAdmin && (
            <>
              <button
                className={`tab ${tab === "structure" ? "active" : ""}`}
                onClick={() => setTab("structure")}
              >
                الهيكل التنظيمي
              </button>
              <button
                className={`tab ${tab === "users" ? "active" : ""}`}
                onClick={() => setTab("users")}
              >
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
            {tab === "structure" && isAdmin && (
              <StructureManager refData={refData} reload={loadRef} />
            )}
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

/* ============ النظرة العامة ============ */
function Overview({ me, refData }: { me: Me; refData: RefData }) {
  const [periodId, setPeriodId] = useState(refData.periods[0]?.id || "");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!periodId) {
      setMeasurements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const d = await fetch(`/api/measurements?periodId=${periodId}`).then((r) => r.json());
    setMeasurements(d.measurements || []);
    setLoading(false);
  }, [periodId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const sectors = visibleSectors(me, refData);
  const indicators = activeIndicators(refData);
  const sectorIds = new Set(sectors.map((s) => s.id));
  const entities = refData.entities.filter((e) => sectorIds.has(e.sectorId));

  // خريطة القياسات: entityId|indicatorId -> measurement
  const mMap = useMemo(() => {
    const m = new Map<string, Measurement>();
    for (const x of measurements) m.set(`${x.entityId}|${x.indicatorId}`, x);
    return m;
  }, [measurements]);

  // ملخص: متوسط الإنجاز العام، عدد الخلايا المتعثرة
  const summary = useMemo(() => {
    let sum = 0;
    let count = 0;
    let weak = 0;
    for (const m of measurements) {
      const r = evaluate(m.actual, m.target);
      if (r.achievement != null) {
        sum += r.achievement;
        count++;
        if (r.status === "weak") weak++;
      }
    }
    return {
      avg: count ? Math.round(sum / count) : null,
      measured: count,
      weak,
    };
  }, [measurements]);

  function exportCsv() {
    const header = [
      "القطاع",
      "الجهة",
      "المؤشر",
      "الوحدة",
      "المستهدف",
      "المحقق",
      "نسبة الإنجاز %",
      "الحالة",
    ];
    const rows: string[][] = [];
    for (const s of sectors) {
      for (const e of entities.filter((x) => x.sectorId === s.id)) {
        for (const ind of indicators) {
          const m = mMap.get(`${e.id}|${ind.id}`);
          const r = evaluate(m?.actual, m?.target);
          rows.push([
            s.name,
            e.name,
            ind.name,
            ind.unit === "percent" ? "نسبة" : "عدد",
            m?.target != null ? String(m.target) : "",
            m?.actual != null ? String(m.actual) : "",
            r.achievement != null ? String(Math.round(r.achievement)) : "",
            r.label,
          ]);
        }
      }
    }
    const csv = [header, ...rows]
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const plabel = refData.periods.find((p) => p.id === periodId)?.label || "";
    a.download = `الأداء-${plabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (refData.periods.length === 0) {
    return <div className="empty">لا توجد فترات. أضف فترة من تبويب الهيكل التنظيمي.</div>;
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

      {/* بطاقات الملخص */}
      <div className="cards">
        <StatCard label="متوسط الإنجاز العام" value={summary.avg != null ? `${summary.avg}%` : "—"} />
        <StatCard label="عدد الجهات" value={String(entities.length)} />
        <StatCard label="المؤشرات المقاسة" value={String(summary.measured)} />
        <StatCard label="مؤشرات متعثرة" value={String(summary.weak)} danger={summary.weak > 0} />
      </div>

      {loading ? (
        <div className="empty">جارٍ التحميل...</div>
      ) : entities.length === 0 ? (
        <div className="empty">لا توجد جهات بعد.</div>
      ) : (
        <div style={{ overflowX: "auto" }} className="spacer-top">
          <table className="matrix">
            <thead>
              <tr>
                <th className="sticky-col">الجهة</th>
                {indicators.map((ind, i) => (
                  <th key={ind.id} title={ind.name}>
                    م{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectors.map((s) => {
                const sectorEntities = entities.filter((e) => e.sectorId === s.id);
                if (sectorEntities.length === 0) return null;
                return (
                  <SectorRows
                    key={s.id}
                    sector={s}
                    entities={sectorEntities}
                    indicators={indicators}
                    mMap={mMap}
                  />
                );
              })}
            </tbody>
          </table>
          <IndicatorLegend indicators={indicators} />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={danger ? { color: "var(--danger)" } : undefined}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function SectorRows({
  sector,
  entities,
  indicators,
  mMap,
}: {
  sector: Sector;
  entities: Entity[];
  indicators: Indicator[];
  mMap: Map<string, Measurement>;
}) {
  return (
    <>
      <tr className="sector-row">
        <td className="sticky-col" colSpan={indicators.length + 1}>
          {sector.name}
        </td>
      </tr>
      {entities.map((e) => (
        <tr key={e.id}>
          <td className="sticky-col">{e.name}</td>
          {indicators.map((ind) => {
            const m = mMap.get(`${e.id}|${ind.id}`);
            const r = evaluate(m?.actual, m?.target);
            return (
              <td
                key={ind.id}
                style={{ background: r.color, color: r.text, textAlign: "center" }}
                title={`${ind.name}\nالمحقق: ${fmtValue(m?.actual, ind.unit)} | المستهدف: ${fmtValue(
                  m?.target,
                  ind.unit
                )}`}
              >
                {r.achievement != null ? `${Math.round(r.achievement)}%` : "—"}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function IndicatorLegend({ indicators }: { indicators: Indicator[] }) {
  return (
    <div className="legend">
      <div className="legend-title">دليل المؤشرات:</div>
      {indicators.map((ind, i) => (
        <div key={ind.id} className="legend-item">
          <strong>م{i + 1}:</strong> {ind.name}{" "}
          <span className="muted">({ind.unit === "percent" ? "نسبة" : "عدد"})</span>
        </div>
      ))}
    </div>
  );
}

/* ============ إدخال البيانات ============ */
function DataEntry({ me, refData }: { me: Me; refData: RefData }) {
  const sectors = visibleSectors(me, refData);
  const indicators = activeIndicators(refData);
  const [sectorId, setSectorId] = useState(sectors[0]?.id || "");
  const sectorEntities = refData.entities.filter((e) => e.sectorId === sectorId);
  const [entityId, setEntityId] = useState("");
  const [periodId, setPeriodId] = useState(refData.periods[0]?.id || "");
  const [vals, setVals] = useState<Record<string, { target: string; actual: string }>>({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // عند تغيير القطاع، اختر أول جهة
  useEffect(() => {
    const first = refData.entities.find((e) => e.sectorId === sectorId);
    setEntityId(first?.id || "");
  }, [sectorId, refData.entities]);

  // تحميل القياسات الحالية للجهة والفترة
  const loadVals = useCallback(async () => {
    if (!entityId || !periodId) {
      setVals({});
      return;
    }
    const d = await fetch(
      `/api/measurements?entityId=${entityId}&periodId=${periodId}`
    ).then((r) => r.json());
    const map: Record<string, { target: string; actual: string }> = {};
    for (const m of (d.measurements || []) as Measurement[]) {
      map[m.indicatorId] = {
        target: m.target != null ? String(m.target) : "",
        actual: m.actual != null ? String(m.actual) : "",
      };
    }
    setVals(map);
  }, [entityId, periodId]);

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
        entityId,
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
    return (
      <div className="empty">
        لم تُسند لك أي قطاعات بعد. تواصل مع مدير الإدارة لإسناد قطاع لك.
      </div>
    );
  }
  if (refData.periods.length === 0) {
    return <div className="empty">لا توجد فترات. أضف فترة من تبويب الهيكل التنظيمي.</div>;
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
          <label>الجهة</label>
          <select value={entityId} onChange={(e) => setEntityId(e.target.value)}>
            {sectorEntities.length === 0 && <option value="">لا توجد جهات</option>}
            {sectorEntities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>الفترة</label>
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

      {!entityId ? (
        <p className="empty">اختر جهة لإدخال بياناتها (أضف جهات من تبويب الهيكل).</p>
      ) : (
        <>
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
                  const r = evaluate(
                    av === "" ? null : Number(av),
                    tv === "" ? null : Number(tv)
                  );
                  return (
                    <tr key={ind.id}>
                      <td>
                        <strong>م{i + 1}.</strong> {ind.name}{" "}
                        <span className="muted">
                          ({ind.unit === "percent" ? "%" : "عدد"})
                        </span>
                      </td>
                      <td style={{ width: 110 }}>
                        <input
                          type="number"
                          step="any"
                          value={tv}
                          onChange={(e) => setVal(ind.id, "target", e.target.value)}
                        />
                      </td>
                      <td style={{ width: 110 }}>
                        <input
                          type="number"
                          step="any"
                          value={av}
                          onChange={(e) => setVal(ind.id, "actual", e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className="badge"
                          style={{ background: r.color, color: r.text }}
                        >
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
        </>
      )}
    </div>
  );
}

/* ============ الهيكل التنظيمي (مدير الإدارة) ============ */
function StructureManager({ refData, reload }: { refData: RefData; reload: () => void }) {
  const [sub, setSub] = useState<"sectors" | "entities" | "indicators" | "periods">(
    "sectors"
  );
  return (
    <div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${sub === "sectors" ? "active" : ""}`} onClick={() => setSub("sectors")}>
          القطاعات
        </button>
        <button className={`tab ${sub === "entities" ? "active" : ""}`} onClick={() => setSub("entities")}>
          الجهات
        </button>
        <button className={`tab ${sub === "indicators" ? "active" : ""}`} onClick={() => setSub("indicators")}>
          المؤشرات
        </button>
        <button className={`tab ${sub === "periods" ? "active" : ""}`} onClick={() => setSub("periods")}>
          الفترات
        </button>
      </div>
      {sub === "sectors" && <SectorsManager refData={refData} reload={reload} />}
      {sub === "entities" && <EntitiesManager refData={refData} reload={reload} />}
      {sub === "indicators" && <IndicatorsManager refData={refData} reload={reload} />}
      {sub === "periods" && <PeriodsManager refData={refData} reload={reload} />}
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
    if (!confirm("حذف القطاع سيحذف جهاته وقياساتها. متابعة؟")) return;
    await fetch(`/api/sectors/${id}`, { method: "DELETE" });
    reload();
  }
  return (
    <div className="card">
      <h2 className="section-title">القطاعات ({refData.sectors.length}/7)</h2>
      {err && <div className="alert alert-error">{err}</div>}
      <div className="row" style={{ marginBottom: 16 }}>
        <input
          placeholder="اسم القطاع"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
            <th>عدد الجهات</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {refData.sectors.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{refData.entities.filter((e) => e.sectorId === s.id).length}</td>
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

function EntitiesManager({ refData, reload }: { refData: RefData; reload: () => void }) {
  const [sectorId, setSectorId] = useState(refData.sectors[0]?.id || "");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  async function add() {
    setErr("");
    const res = await fetch("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectorId, name }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error || "خطأ");
    else {
      setName("");
      reload();
    }
  }
  async function rename(id: string, current: string) {
    const v = prompt("اسم الجهة الجديد:", current);
    if (v && v.trim()) {
      await fetch(`/api/entities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: v }),
      });
      reload();
    }
  }
  async function remove(id: string) {
    if (!confirm("حذف الجهة سيحذف قياساتها. متابعة؟")) return;
    await fetch(`/api/entities/${id}`, { method: "DELETE" });
    reload();
  }
  const sectorName = (id: string) => refData.sectors.find((s) => s.id === id)?.name || "—";
  return (
    <div className="card">
      <h2 className="section-title">الجهات ({refData.entities.length})</h2>
      {err && <div className="alert alert-error">{err}</div>}
      <div className="row" style={{ marginBottom: 16 }}>
        <div>
          <label>القطاع</label>
          <select value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
            {refData.sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>اسم الجهة</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn" onClick={add} disabled={!sectorId}>
            إضافة جهة
          </button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>الجهة</th>
            <th>القطاع</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {refData.entities.map((e) => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td>{sectorName(e.sectorId)}</td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => rename(e.id, e.name)}>
                    تعديل
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(e.id)}>
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
        أضف أو احذف أو عدّل المؤشرات. اختر &quot;عدد&quot; للمؤشرات الرقمية و&quot;نسبة&quot;
        للنسب المئوية.
      </p>
      {msg && <div className="alert alert-success">{msg}</div>}
      {list.map((ind, i) => (
        <div key={i} className="field-row">
          <span className="muted" style={{ flex: "0 0 30px" }}>
            م{i + 1}
          </span>
          <input
            placeholder="اسم المؤشر"
            value={ind.name}
            onChange={(e) => upd(i, { name: e.target.value })}
          />
          <select
            value={ind.unit}
            onChange={(e) => upd(i, { unit: e.target.value as Unit })}
            style={{ flex: "0 0 110px" }}
          >
            <option value="percent">نسبة %</option>
            <option value="number">عدد</option>
          </select>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={ind.active}
              onChange={(e) => upd(i, { active: e.target.checked })}
            />
            مُفعّل
          </label>
          <button
            className="btn btn-danger btn-sm"
            style={{ flex: "0 0 auto" }}
            onClick={() => removeInd(i)}
          >
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
        <input
          placeholder="مثال: الربع الأول 2026"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
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
    ids.map((id) => refData.sectors.find((s) => s.id === id)?.name).filter(Boolean).join("، ") ||
    "—";

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 className="section-title">إضافة مستخدم</h2>
        <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
          مدير القطاع = يدخل بيانات قطاعاته فقط. مدير الإدارة = صلاحيات كاملة على كل
          القطاعات.
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
                    <input
                      type="checkbox"
                      checked={sectorIds.includes(s.id)}
                      onChange={() => toggleSector(s.id)}
                    />
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
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => patch(u.id, { active: !u.active })}
                  >
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
