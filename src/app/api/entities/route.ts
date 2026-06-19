import { NextResponse } from "next/server";
import { createEntity, listEntities } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  return NextResponse.json({ entities: listEntities() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { sectorId, name } = await req.json().catch(() => ({}));
  if (!sectorId || !name || !String(name).trim()) {
    return NextResponse.json({ error: "أدخل القطاع واسم الجهة" }, { status: 400 });
  }
  try {
    const entity = createEntity(String(sectorId), String(name));
    return NextResponse.json({ ok: true, entity });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "خطأ" },
      { status: 400 }
    );
  }
}
