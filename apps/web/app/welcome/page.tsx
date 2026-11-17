import type { Metadata } from "next";
import { WelcomeFlow } from "@/components/welcome-flow";
import { getCatalog } from "@/lib/content";

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

/** Static, like the Parts, so it offers exactly the Parts that were built. `?next=` is read in the browser. */
export default function WelcomePage() {
  return <WelcomeFlow catalog={getCatalog()} />;
}
