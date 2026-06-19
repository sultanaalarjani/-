import { NextResponse } from "next/server";
import { getUserByEmail, setOtp } from "@/lib/db";
import { sendOtpEmail } from "@/lib/mailer";

const OTP_TTL_MS = 1000 * 60 * 10; // 10 دقائق

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({ email: "" }));
  const clean = (email || "").trim().toLowerCase();

  if (!clean || !clean.includes("@")) {
    return NextResponse.json({ error: "أدخل إيميل صحيح" }, { status: 400 });
  }

  const user = getUserByEmail(clean);
  // لا نكشف إن كان الإيميل مسجلًا أو لا، إلا أننا نمنع الإرسال لغير المسجلين.
  if (!user || !user.active) {
    return NextResponse.json(
      { error: "هذا الإيميل غير مصرّح له بالدخول. تواصل مع مدير الإدارة." },
      { status: 403 }
    );
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  setOtp(clean, code, OTP_TTL_MS);

  try {
    const result = await sendOtpEmail(clean, code);
    return NextResponse.json({
      ok: true,
      // في وضع التجربة فقط نُرجع الرمز ليسهل اختباره
      devCode: result.delivered ? undefined : result.code,
    });
  } catch (e) {
    console.error("فشل إرسال الإيميل:", e);
    return NextResponse.json(
      { error: "تعذّر إرسال رمز الدخول. تحقق من إعدادات البريد." },
      { status: 500 }
    );
  }
}
