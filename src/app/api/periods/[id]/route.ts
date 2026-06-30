import { NextResponse } from "next/server";
import { deletePeriod, updatePeriod } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { label } = await req.json().catch(() => ({}));
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "أدخل اسم الفترة" }, { status: 400 });
  }
  await updatePeriod(id, String(label));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { id } = await ctx.params;
  await deletePeriod(id);
  return NextResponse.json({ ok: true });
}
