// حساب نسبة الإنجاز وحالات الأداء القابلة للتخصيص (bands)

export interface Band {
  label: string;
  color: string; // لون الحالة (hex)
  from: number; // الحد الأدنى للنسبة المئوية
}

export const DEFAULT_BANDS: Band[] = [
  { label: "متعثر", color: "#ef4444", from: 0 },
  { label: "متعثر جزئيًا", color: "#f59e0b", from: 80 },
  { label: "وفق المسار", color: "#22c55e", from: 100 },
];

// نسبة الإنجاز = المحقق / المستهدف × 100
export function computeAchievement(
  actual: number | null | undefined,
  target: number | null | undefined
): number | null {
  if (actual == null || target == null || target === 0) return null;
  return (actual / target) * 100;
}

// إرجاع الحالة (band) المطابقة لنسبة معيّنة
export function bandOf(achievement: number | null, bands: Band[]): Band | null {
  if (achievement == null) return null;
  const list = (bands && bands.length ? bands : DEFAULT_BANDS)
    .slice()
    .sort((a, b) => a.from - b.from);
  let match: Band | null = null;
  for (const b of list) if (achievement >= b.from) match = b;
  return match ?? list[0] ?? null;
}

// تحويل لون hex إلى خلفية فاتحة (بإضافة شفافية)
export function tint(hex: string, alpha = "22"): string {
  let h = (hex || "#64748b").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h.slice(0, 6)}${alpha}`;
}

export interface EvalResult {
  achievement: number | null;
  band: Band | null;
  label: string;
  color: string; // لون النص/الحالة
  bg: string; // خلفية فاتحة
}

export function evaluate(
  actual: number | null | undefined,
  target: number | null | undefined,
  bands: Band[]
): EvalResult {
  const achievement = computeAchievement(actual, target);
  const band = bandOf(achievement, bands);
  return {
    achievement,
    band,
    label: band?.label ?? "—",
    color: band?.color ?? "#64748b",
    bg: band ? tint(band.color) : "rgba(255,255,255,0.05)",
  };
}

export function fmtNum(v: number | null | undefined): string {
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function fmtValue(v: number | null | undefined, unit: "percent" | "number"): string {
  if (v == null) return "—";
  return unit === "percent" ? `${fmtNum(v)}%` : fmtNum(v);
}
