"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "./safe-next";
import { showError } from "@/lib/error-popup";
import { useLocale } from "@/lib/use-locale";

const T = {
  en: {
    wrongPassword: "Wrong email or password",
    exists: "This email already has an account. Try signing in.",
    tooShort: "Password must be at least 8 characters",
    failed: "Something went wrong. Please try again.",
    signIn: "Sign in",
    signUp: "Sign up",
    name: "Name",
    email: "Email",
    password: "Password (at least 8 characters)",
    working: "Working…",
    create: "Create account",
  },
  th: {
    wrongPassword: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    exists: "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน",
    tooShort: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร",
    failed: "เกิดข้อผิดพลาด ลองอีกครั้ง",
    signIn: "เข้าสู่ระบบ",
    signUp: "สมัครสมาชิก",
    name: "ชื่อ",
    email: "อีเมล",
    password: "รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)",
    working: "กำลังดำเนินการ…",
    create: "สร้างบัญชี",
  },
};


type Mode = "sign-in" | "sign-up";

const inputClass =
  "w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";


export function LoginForm() {
  const t = T[useLocale()];
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name, email, password });
    setPending(false);

    if (result.error) {
      const code = result.error.code;
      showError(
        code === "INVALID_EMAIL_OR_PASSWORD"
          ? t.wrongPassword
          : code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? t.exists
            : code === "PASSWORD_TOO_SHORT"
              ? t.tooShort
              : (result.error.message ?? t.failed),
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <>
      <div role="tablist" className="mt-6 flex gap-1 rounded-xl bg-slate-100 p-1">
        {(["sign-in", "sign-up"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === m ? "bg-white shadow-sm" : "text-slate-500"}`}
          >
            {m === "sign-in" ? t.signIn : t.signUp}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        {mode === "sign-up" && (
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
            placeholder={t.name}
            className={inputClass}
          />
        )}
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder={t.email}
          className={inputClass}
        />
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          placeholder={t.password}
          className={inputClass}
        />
        <button
          disabled={pending}
          className="w-full rounded-xl bg-primary hover:bg-primary-hover px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {pending ? t.working : mode === "sign-in" ? t.signIn : t.create}
        </button>
      </form>
    </>
  );
}
