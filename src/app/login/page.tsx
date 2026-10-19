import type { Metadata } from "next";
import { LoginView } from "../_site/login";

export const metadata: Metadata = { title: { absolute: "Sign in · Tohs Event" }, robots: { index: false, follow: false } };

export default function LoginPage() {
  return <LoginView locale="en" />;
}
