// إرسال رمز الدخول عبر رسالة SMS.
// يدعم عدة مزوّدات عبر متغير SMS_PROVIDER. وإن لم يُضبط، يعمل في "وضع التجربة"
// ويعرض الرمز على الشاشة/السجل بدل إرساله فعليًا.

export async function sendOtpSms(phone: string, code: string) {
  const provider = (process.env.SMS_PROVIDER || "").toLowerCase();
  const message = `رمز الدخول إلى لوحة إدارة عمليات الأداء: ${code}\nصالح لمدة 10 دقائق.`;

  try {
    if (provider === "twilio") {
      await sendTwilio(phone, message);
      return { delivered: true as const };
    }
    if (provider === "generic" || provider === "http") {
      await sendGeneric(phone, message);
      return { delivered: true as const };
    }
  } catch (e) {
    console.error("فشل إرسال SMS:", e);
    return { delivered: false as const, code, error: true as const };
  }

  // وضع التجربة: لا يوجد مزوّد مضبوط
  console.log("\n==============================================");
  console.log(`📱 رمز الدخول للجوال: ${phone}`);
  console.log(`🔑 الرمز: ${code}`);
  console.log("(لإرسال SMS فعلي اضبط متغيرات SMS_* في الإعدادات)");
  console.log("==============================================\n");
  return { delivered: false as const, code };
}

// Twilio: يحتاج TWILIO_SID و TWILIO_TOKEN و TWILIO_FROM
async function sendTwilio(to: string, body: string) {
  const sid = process.env.TWILIO_SID!;
  const token = process.env.TWILIO_TOKEN!;
  const from = process.env.TWILIO_FROM!;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams({ To: `+${to.replace(/^\+/, "")}`, From: from, Body: body });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

// مزوّد عام (مناسب لكثير من المزوّدات السعودية): POST JSON إلى SMS_API_URL
// المتغيرات: SMS_API_URL, SMS_API_KEY (اختياري), SMS_SENDER (اسم المُرسِل)
async function sendGeneric(to: string, body: string) {
  const url = process.env.SMS_API_URL!;
  const key = process.env.SMS_API_KEY || "";
  const sender = process.env.SMS_SENDER || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ to, sender, message: body, text: body, body }),
  });
  if (!res.ok) throw new Error(`SMS ${res.status}: ${await res.text()}`);
}
