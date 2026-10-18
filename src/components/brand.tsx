import Link from "next/link";

/** Tohs Event mark: blue rounded square with an aperture-like "T". */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="tohs-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#tohs-mark)" />
      <path d="M9 10.5h14v3.2h-5.4V23h-3.2v-9.3H9z" fill="#fff" />
      <circle cx="23.5" cy="21.5" r="2.2" fill="#7dd3fc" />
    </svg>
  );
}

export function BrandLogo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-semibold tracking-tight text-slate-900 ${className}`}>
      <BrandMark />
      <span>Tohs Event</span>
    </Link>
  );
}
