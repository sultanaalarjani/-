import { NextResponse } from "next/server";
import { deleteEntity, updateEntity } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { name, sectorId } = await req.json().catch(() => ({}));
  updateEntity(id, { name, sectorId });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { id } = await ctx.params;
  deleteEntity(id);
  return NextResponse.json({ ok: true });
}
