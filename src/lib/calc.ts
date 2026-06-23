// حساب نسبة الإنجاز وحالة الأداء للمؤشر

export type PerfStatus = "excellent" | "good" | "weak" | "none";

export interface Thresholds {
  good: number; // حد التعثر الجزئي (أصفر) — أقل منه يعتبر متعثرًا
  excellent: number; // حد "وفق المسار" (أخضر)
}

export const DEFAULT_THRESHOLDS: Thresholds = { good: 80, excellent: 100 };

export interface PerfResult {
  achievement: number | null; // نسبة الإنجاز %
  status: PerfStatus;
  label: string;
  color: string; // لون الخلفية
  text: string; // لون النص
}

const STATUS_META: Record<PerfStatus, { label: string; color: string; text: string }> = {
  excellent: { label: "وفق المسار", color: "#dcfce7", text: "#15803d" },
  good: { label: "متعثر جزئيًا", color: "#fef9c3", text: "#a16207" },
  weak: { label: "متعثر", color: "#fee2e2", text: "#b91c1c" },
  none: { label: "—", color: "#f1f5f9", text: "#64748b" },
};

// نسبة الإنجاز = المحقق / المستهدف × 100
export function computeAchievement(
  actual: number | null | undefined,
  target: number | null | undefined
): number | null {
  if (actual == null || target == null || target === 0) return null;
  return (actual / target) * 100;
}

export function perfStatus(
  achievement: number | null,
  t: Thresholds = DEFAULT_THRESHOLDS
): PerfStatus {
  if (achievement == null) return "none";
  if (achievement >= t.excellent) return "excellent";
  if (achievement >= t.good) return "good";
  return "weak";
}

export function statusMeta(status: PerfStatus) {
  return STATUS_META[status];
}

export function evaluate(
  actual: number | null | undefined,
  target: number | null | undefined,
  t: Thresholds = DEFAULT_THRESHOLDS
): PerfResult {
  const achievement = computeAchievement(actual, target);
  const status = perfStatus(achievement, t);
  return { achievement, status, ...STATUS_META[status] };
}

export function fmtNum(v: number | null | undefined): string {
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function fmtValue(v: number | null | undefined, unit: "percent" | "number"): string {
  if (v == null) return "—";
  return unit === "percent" ? `${fmtNum(v)}%` : fmtNum(v);
}
