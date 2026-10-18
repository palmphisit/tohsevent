import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="mt-auto px-4 py-6 text-center text-xs text-zinc-400 print:hidden">
      <Link href="/privacy" className="hover:text-zinc-600">
        นโยบายความเป็นส่วนตัว
      </Link>
      <span className="mx-2">·</span>
      <Link href="/terms" className="hover:text-zinc-600">
        ข้อกำหนดการใช้งาน
      </Link>
    </footer>
  );
}
