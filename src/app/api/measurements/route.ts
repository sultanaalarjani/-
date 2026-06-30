import { NextResponse } from "next/server";
import { User, listMeasurements, upsertMeasurement } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

function canAccessSector(user: User, sectorId: string): boolean {
  if (user.role === "admin") return true;
  return user.sectorIds.includes(sectorId);
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const periodId = sp.get("periodId") || undefined;
  const sectorId = sp.get("sectorId") || undefined;

  if (sectorId && !canAccessSector(user, sectorId)) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const scope =
    user.role === "admin" ? undefined : { sectorIds: user.sectorIds };
  let measurements = await listMeasurements({ periodId, sectorId, ...scope });
  if (sectorId) measurements = measurements.filter((m) => m.sectorId === sectorId);

  return NextResponse.json({ measurements });
}

// حفظ مجموعة قياسات دفعة واحدة (المستهدف والمحقق لكل مؤشر لقطاع وربع)
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "لا توجد بيانات للحفظ" }, { status: 400 });
  }

  const toNum = (v: unknown): number | null => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const saved = [];
  for (const it of items) {
    const { sectorId, indicatorId, periodId } = it;
    if (!sectorId || !indicatorId || !periodId) continue;
    if (!canAccessSector(user, sectorId)) {
      return NextResponse.json(
        { error: "لا تملك صلاحية على هذا القطاع" },
        { status: 403 }
      );
    }
    saved.push(
      await upsertMeasurement({
        sectorId,
        indicatorId,
        periodId,
        target: toNum(it.target),
        actual: toNum(it.actual),
        updatedBy: user.id,
      })
    );
  }
  return NextResponse.json({ ok: true, saved });
}
