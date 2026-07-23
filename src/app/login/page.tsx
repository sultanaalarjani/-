"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const t = (ar: string, en: string) => (lang === "en" ? en : ar);
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    const sl = typeof window !== "undefined" ? localStorage.getItem("lang") : null;
    if (sl === "en" || sl === "ar") setLang(sl);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "en" ? "ltr" : "rtl");
    try {
      localStorage.setItem("lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang]);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
      } else {
        setStep("code");
        if (data.devCode) {
          setInfo(t(`وضع التجربة: رمزك هو ${data.devCode}`, `Demo mode: your code is ${data.devCode}`));
        } else {
          setInfo(t("تم إرسال رمز الدخول برسالة إلى جوالك.", "A login code has been sent to your phone."));
        }
      }
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "الرمز غير صحيح");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div style={{ textAlign: lang === "en" ? "right" : "left", marginBottom: 4 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          >
            {lang === "ar" ? "English" : "عربي"}
          </button>
        </div>
        <h1>{t("لوحة إدارة عمليات الأداء", "Performance Operations Dashboard")}</h1>
        <p className="sub">
          {t(
            "سجّل الدخول برقم جوالك المصرّح به. سيصلك رمز مكوّن من 6 أرقام برسالة نصية.",
            "Sign in with your authorized phone number. A 6-digit code will be sent to you by SMS."
          )}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {info && <div className="alert alert-info">{info}</div>}

        {step === "phone" ? (
          <form onSubmit={requestCode}>
            <div className="field">
              <label>{t("رقم الجوال", "Phone number")}</label>
              <input
                type="tel"
                inputMode="tel"
                placeholder="05XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                dir="ltr"
                style={{ textAlign: "left" }}
              />
            </div>
            <button className="btn" style={{ width: "100%" }} disabled={loading}>
              {loading ? t("جارٍ الإرسال...", "Sending...") : t("إرسال رمز الدخول", "Send login code")}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <div className="field">
              <label>{t("رمز الدخول", "Login code")}</label>
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="------"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                dir="ltr"
                style={{ textAlign: "center", letterSpacing: "8px", fontSize: "22px" }}
              />
            </div>
            <button className="btn" style={{ width: "100%" }} disabled={loading}>
              {loading ? t("جارٍ التحقق...", "Verifying...") : t("دخول", "Sign in")}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: "100%", marginTop: "10px" }}
              onClick={() => {
                setStep("phone");
                setCode("");
                setError("");
                setInfo("");
              }}
            >
              {t("تغيير الرقم", "Change number")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
