import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  return NextResponse.json({ settings: await getSettings() });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { goodThreshold, excellentThreshold } = await req.json().catch(() => ({}));
  const g = Number(goodThreshold);
  const e = Number(excellentThreshold);
  if (!Number.isFinite(g) || !Number.isFinite(e) || g < 0 || e < 0) {
    return NextResponse.json({ error: "قيم غير صحيحة" }, { status: 400 });
  }
  if (g >= e) {
    return NextResponse.json(
      { error: "حد التعثر الجزئي يجب أن يكون أقل من حد وفق المسار" },
      { status: 400 }
    );
  }
  const settings = await updateSettings({ goodThreshold: g, excellentThreshold: e });
  return NextResponse.json({ ok: true, settings });
}
