import { NextResponse } from "next/server";
import { deleteEntry, getEntry, updateEntry } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

async function canEdit(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "غير مصرّح", status: 401 as const };
  const entry = getEntry(id);
  if (!entry) return { error: "الإدخال غير موجود", status: 404 as const };
  // المدير العام يعدّل الكل، والمدير يعدّل إدخالاته فقط
  if (user.role !== "admin" && entry.userId !== user.id) {
    return { error: "لا تملك صلاحية تعديل هذا الإدخال", status: 403 as const };
  }
  return { user, entry };
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const check = await canEdit(id);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { values } = await req.json().catch(() => ({}));
  if (!values || typeof values !== "object") {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }
  const entry = updateEntry(id, values as Record<string, string>);
  return NextResponse.json({ ok: true, entry });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const check = await canEdit(id);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  deleteEntry(id);
  return NextResponse.json({ ok: true });
}
