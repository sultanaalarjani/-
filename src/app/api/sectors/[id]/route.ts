import { NextResponse } from "next/server";
import { deleteSector, updateSector } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { name } = await req.json().catch(() => ({}));
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "أدخل اسم القطاع" }, { status: 400 });
  }
  await updateSector(id, String(name));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { id } = await ctx.params;
  await deleteSector(id);
  return NextResponse.json({ ok: true });
}
