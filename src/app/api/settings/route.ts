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
  const { statuses } = await req.json().catch(() => ({}));
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return NextResponse.json({ error: "أضف حالة واحدة على الأقل" }, { status: 400 });
  }
  const settings = await updateSettings({ statuses });
  return NextResponse.json({ ok: true, settings });
}
