"use client";

import { ClipboardCheck, CreditCard, Images, LayoutDashboard, MonitorPlay, Palette } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const TABS = [
  { href: "", label: "ภาพรวม", icon: LayoutDashboard, owner: false },
  { href: "/photos", label: "รูปภาพ", icon: Images, owner: false },
  { href: "/registration", label: "ลงทะเบียน", icon: ClipboardCheck, owner: true },
  { href: "/branding", label: "หน้าแขก", icon: Palette, owner: true },
  { href: "/slideshow", label: "Slideshow", icon: MonitorPlay, owner: true },
  { href: "/plan", label: "แพ็กเกจ", icon: CreditCard, owner: true },
] as const;

/** Section tabs shared by every page of an event (photographers see only what they can use). */
export function EventNav({ eventId, owner, alerts }: { eventId: string; owner: boolean; alerts: { photos?: number } }) {
  const pathname = usePathname();
  const base = `/dashboard/events/${eventId}`;
  const navRef = useRef<HTMLElement>(null);
  // On phones the tab row scrolls sideways: keep the current section in view.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    <nav ref={navRef} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex min-w-max gap-1">
        {TABS.filter((t) => owner || !t.owner).map(({ href, label, icon: Icon }) => {
          const target = base + href;
          const active =
            href === ""
              ? pathname === base
              : pathname.startsWith(target) || (href === "/registration" && pathname.startsWith(`${base}/checkin`));
          const badge = href === "/photos" ? alerts.photos : undefined;
          return (
            <li key={href}>
              <Link
                href={target}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-1.5 rounded-t-lg px-3 py-2.5 text-sm font-medium transition ${
                  active ? "text-primary" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {!!badge && (
                  <span className="rounded-full bg-red-600 px-1.5 text-[11px] leading-5 font-semibold text-white">{badge}</span>
                )}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
