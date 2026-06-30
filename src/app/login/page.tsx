"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
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
          setInfo(`وضع التجربة: رمزك هو ${data.devCode}`);
        } else {
          setInfo("تم إرسال رمز الدخول برسالة إلى جوالك.");
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
        <h1>لوحة إدارة عمليات الأداء</h1>
        <p className="sub">
          سجّل الدخول برقم جوالك المصرّح به. سيصلك رمز مكوّن من 6 أرقام برسالة نصية.
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {info && <div className="alert alert-info">{info}</div>}

        {step === "phone" ? (
          <form onSubmit={requestCode}>
            <div className="field">
              <label>رقم الجوال</label>
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
              {loading ? "جارٍ الإرسال..." : "إرسال رمز الدخول"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <div className="field">
              <label>رمز الدخول</label>
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
              {loading ? "جارٍ التحقق..." : "دخول"}
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
              تغيير الرقم
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
