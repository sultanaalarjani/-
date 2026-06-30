import { NextResponse } from "next/server";
import { getUserByPhone, setOtp } from "@/lib/db";
import { sendOtpSms } from "@/lib/smser";

const OTP_TTL_MS = 1000 * 60 * 10; // 10 دقائق

export async function POST(req: Request) {
  const { phone } = await req.json().catch(() => ({ phone: "" }));
  const clean = (phone || "").toString().trim();

  if (!clean || clean.replace(/\D/g, "").length < 9) {
    return NextResponse.json({ error: "أدخل رقم جوال صحيح" }, { status: 400 });
  }

  const user = getUserByPhone(clean);
  if (!user || !user.active) {
    return NextResponse.json(
      { error: "هذا الرقم غير مصرّح له بالدخول. تواصل مع مدير الإدارة." },
      { status: 403 }
    );
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  setOtp(clean, code, OTP_TTL_MS);

  try {
    const result = await sendOtpSms(clean, code);
    return NextResponse.json({
      ok: true,
      // في وضع التجربة فقط نُرجع الرمز ليسهل اختباره
      devCode: result.delivered ? undefined : result.code,
    });
  } catch (e) {
    console.error("فشل إرسال الرمز:", e);
    return NextResponse.json({ error: "تعذّر إرسال رمز الدخول." }, { status: 500 });
  }
}
