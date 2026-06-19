import { NextResponse } from "next/server";
import {
  Entity,
  User,
  getEntity,
  listEntities,
  listMeasurements,
  upsertMeasurement,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// الجهات التي يحق للمستخدم رؤيتها/الكتابة فيها
function allowedEntities(user: User): Entity[] {
  const all = listEntities();
  if (user.role === "admin") return all;
  return all.filter((e) => user.sectorIds.includes(e.sectorId));
}

function canAccessEntity(user: User, entityId: string): boolean {
  if (user.role === "admin") return true;
  const e = getEntity(entityId);
  return !!e && user.sectorIds.includes(e.sectorId);
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const periodId = sp.get("periodId") || undefined;
  const entityId = sp.get("entityId") || undefined;

  const allowedIds = allowedEntities(user).map((e) => e.id);
  let measurements = listMeasurements({ periodId, entityIds: allowedIds });
  if (entityId) {
    if (!canAccessEntity(user, entityId)) {
      return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
    }
    measurements = measurements.filter((m) => m.entityId === entityId);
  }
  return NextResponse.json({ measurements });
}

// حفظ مجموعة قياسات دفعة واحدة (المحقق والمستهدف لكل مؤشر لجهة وفترة)
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
    const { entityId, indicatorId, periodId } = it;
    if (!entityId || !indicatorId || !periodId) continue;
    if (!canAccessEntity(user, entityId)) {
      return NextResponse.json(
        { error: "لا تملك صلاحية على هذه الجهة" },
        { status: 403 }
      );
    }
    saved.push(
      upsertMeasurement({
        entityId,
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
