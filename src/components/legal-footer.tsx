import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="mt-auto px-4 py-6 text-center text-xs text-muted/80 print:hidden">
      <Link href="/privacy" className="hover:text-ink/70">
        นโยบายความเป็นส่วนตัว
      </Link>
      <span className="mx-2">·</span>
      <Link href="/terms" className="hover:text-ink/70">
        ข้อกำหนดการใช้งาน
      </Link>
    </footer>
  );
}
