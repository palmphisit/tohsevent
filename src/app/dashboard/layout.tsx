import Link from "next/link";
import { SignOutButton } from "./_components/sign-out-button";

export const metadata = { title: "Dashboard · Tohs Event" };

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 print:hidden">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Tohs Event
          </Link>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
