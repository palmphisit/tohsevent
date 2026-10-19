import type { Metadata } from "next";
import { HtmlLang } from "@/components/html-lang";
import { LoginView } from "../../_site/login";

export const metadata: Metadata = { title: { absolute: "เข้าสู่ระบบ · Tohs Event" }, robots: { index: false, follow: false } };

export default function LoginPageTh() {
  return (
    <>
      <HtmlLang lang="th" />
      <LoginView locale="th" />
    </>
  );
}
