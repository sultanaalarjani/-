import { NextResponse } from "next/server";
import { IndicatorInput, IndicatorUnit, listIndicators, saveIndicators } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const includeInactive =
    user.role === "admin" &&
    new URL(req.url).searchParams.get("all") === "1";
  return NextResponse.json({ indicators: await listIndicators(includeInactive) });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { indicators } = await req.json().catch(() => ({}));
  if (!Array.isArray(indicators)) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }
  const cleaned: IndicatorInput[] = indicators
    .filter((i: { name?: string }) => i && String(i.name || "").trim())
    .map((i: { id?: string; name: string; unit?: string; active?: boolean }) => ({
      id: i.id || undefined,
      name: String(i.name).trim(),
      unit: (i.unit === "number" ? "number" : "percent") as IndicatorUnit,
      active: i.active !== false,
    }));
  const saved = await saveIndicators(cleaned);
  return NextResponse.json({ ok: true, indicators: saved });
}
