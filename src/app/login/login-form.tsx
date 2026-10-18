"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

const inputClass =
  "w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

/** Only allow redirects back into the app (never to another origin). */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name, email, password });
    setPending(false);

    if (result.error) {
      const code = result.error.code;
      setError(
        code === "INVALID_EMAIL_OR_PASSWORD"
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน"
            : code === "PASSWORD_TOO_SHORT"
              ? "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"
              : (result.error.message ?? "เกิดข้อผิดพลาด ลองอีกครั้ง"),
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
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === m ? "bg-white shadow-sm" : "text-slate-500"}`}
          >
            {m === "sign-in" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
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
            placeholder="ชื่อ"
            className={inputClass}
          />
        )}
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="อีเมล"
          className={inputClass}
        />
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          placeholder="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
          className={inputClass}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={pending}
          className="w-full rounded-xl bg-primary hover:bg-primary-hover px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {pending ? "กำลังดำเนินการ…" : mode === "sign-in" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
        </button>
      </form>
    </>
  );
}
