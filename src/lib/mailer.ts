import nodemailer from "nodemailer";

// يرسل رمز الدخول عبر SMTP إذا كانت الإعدادات موجودة،
// وإلا يطبع الرمز في الـ Terminal (وضع التجربة).
export async function sendOtpEmail(email: string, code: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  const subject = "رمز الدخول إلى لوحة التحكم";
  const text = `رمز الدخول الخاص بك هو: ${code}\nالرمز صالح لمدة 10 دقائق.`;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // وضع التجربة: لا يوجد إعداد بريد — نعرض الرمز في الـ Terminal
    console.log("\n==============================================");
    console.log(`📧 رمز الدخول للإيميل: ${email}`);
    console.log(`🔑 الرمز: ${code}`);
    console.log("(لإرسال إيميل حقيقي عبّئ إعدادات SMTP في ملف .env)");
    console.log("==============================================\n");
    return { delivered: false as const, code };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: email,
    subject,
    text,
    html: `<div style="font-family:Tahoma,Arial;direction:rtl;text-align:right">
      <h2>رمز الدخول إلى لوحة التحكم</h2>
      <p>رمز الدخول الخاص بك هو:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
      <p style="color:#666">الرمز صالح لمدة 10 دقائق.</p>
    </div>`,
  });

  return { delivered: true as const };
}
