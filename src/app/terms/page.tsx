import type { Metadata } from "next";
import { languageAlternates } from "@/lib/site";
import { TermsEn } from "../_site/terms-en";

export const metadata: Metadata = { title: "Terms of use", alternates: languageAlternates("/terms", "en") };

export default function TermsPage() {
  return <TermsEn />;
}
