import { NextResponse } from "next/server";
import { deleteUser, getUserById, setUserActive } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { active } = await req.json().catch(() => ({}));
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "قيمة غير صحيحة" }, { status: 400 });
  }
  setUserActive(id, active);
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
  if (!getUserById(id)) {
    return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
  }
  deleteUser(id);
  return NextResponse.json({ ok: true });
}
