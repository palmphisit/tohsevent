import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Tohs Event</h1>
      <p className="mt-3 text-zinc-600">
        แชร์รูปในงานอีเวนต์ด้วย QR Code — สแกน ถ่าย อัปโหลด ได้ทันที ไม่ต้องโหลดแอป ไม่ต้องสมัครสมาชิก
      </p>
      <Link href="/dashboard" className="mt-8 w-fit rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white">
        สำหรับเจ้าภาพ: สร้างงาน
      </Link>
      {process.env.NODE_ENV !== "production" && (
        <div className="mt-4 flex gap-3 text-sm">
          <Link href="/e/demo" className="rounded-lg border border-zinc-300 px-4 py-2">
            Demo event
          </Link>
          <Link href="/e/demo-private" className="rounded-lg border border-zinc-300 px-4 py-2">
            Demo (password)
          </Link>
        </div>
      )}
    </main>
  );
}
