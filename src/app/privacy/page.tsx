import type { Metadata } from "next";
import { languageAlternates } from "@/lib/site";
import { PrivacyEn } from "../_site/privacy-en";

export const metadata: Metadata = { title: "Privacy policy", alternates: languageAlternates("/privacy", "en") };

export default function PrivacyPage() {
  return <PrivacyEn />;
}
