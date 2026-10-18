import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ · Tohs Event" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Tohs Event สำหรับเจ้าภาพ</h1>
      <p className="mt-2 text-sm text-zinc-500">สร้างงาน แชร์ QR Code และดูแลรูปภาพในงานของคุณ</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
