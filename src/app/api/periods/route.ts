import { NextResponse } from "next/server";
import { createPeriod, listPeriods } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  return NextResponse.json({ periods: listPeriods() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { label } = await req.json().catch(() => ({}));
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "أدخل اسم الفترة" }, { status: 400 });
  }
  const period = createPeriod(String(label));
  return NextResponse.json({ ok: true, period });
}
