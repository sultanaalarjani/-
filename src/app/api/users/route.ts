import { NextResponse } from "next/server";
import { createUser, listUsers } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  return NextResponse.json({ users: listUsers() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { phone, name, role, sectorIds } = await req.json().catch(() => ({}));
  if (!phone || String(phone).replace(/\D/g, "").length < 9) {
    return NextResponse.json({ error: "أدخل رقم جوال صحيح" }, { status: 400 });
  }
  try {
    const created = createUser({
      phone,
      name: name || "",
      role: role === "admin" ? "admin" : "manager",
      sectorIds: Array.isArray(sectorIds) ? sectorIds : [],
    });
    return NextResponse.json({ ok: true, user: created });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "خطأ" },
      { status: 400 }
    );
  }
}
