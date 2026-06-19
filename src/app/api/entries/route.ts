import { NextResponse } from "next/server";
import { createEntry, listEntries, listEntriesByUser, listUsers } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const entries = user.role === "admin" ? listEntries() : listEntriesByUser(user.id);

  // نرفق اسم صاحب الإدخال ليظهر للمدير العام
  const usersMap = new Map(listUsers().map((u) => [u.id, u]));
  const enriched = entries.map((e) => ({
    ...e,
    authorName: usersMap.get(e.userId)?.name || "غير معروف",
    authorEmail: usersMap.get(e.userId)?.email || "",
  }));

  return NextResponse.json({ entries: enriched });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { values } = await req.json().catch(() => ({}));
  if (!values || typeof values !== "object") {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const entry = createEntry(user.id, values as Record<string, string>);
  return NextResponse.json({ ok: true, entry });
}
