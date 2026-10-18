import { CalendarHeart } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand";
import { SignOutButton } from "./_components/sign-out-button";

export const metadata = { title: { absolute: "Dashboard · Tohs Event" }, robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <BrandLogo href="/dashboard" />
            <Link href="/dashboard" className="hidden items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 sm:flex">
              <CalendarHeart className="h-4 w-4" /> งานของฉัน
            </Link>
          </div>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
