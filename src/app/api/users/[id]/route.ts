import { NextResponse } from "next/server";
import { deleteUser, getUserById, updateUser } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { active, sectorIds, name } = await req.json().catch(() => ({}));
  await updateUser(id, {
    active: typeof active === "boolean" ? active : undefined,
    sectorIds: Array.isArray(sectorIds) ? sectorIds : undefined,
    name: typeof name === "string" ? name : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (id === user.id) {
    return NextResponse.json(
      { error: "لا يمكنك حذف حسابك الخاص" },
      { status: 400 }
    );
  }
  if (!(await getUserById(id))) {
    return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
  }
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
