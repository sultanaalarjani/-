import { NextResponse } from "next/server";
import { getTargets, saveTargets } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  return NextResponse.json({ targets: await getTargets() });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { targets } = await req.json().catch(() => ({}));
  if (!targets || typeof targets !== "object") {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }
  const saved = await saveTargets(targets as Record<string, number | number[]>);
  return NextResponse.json({ ok: true, targets: saved });
}
