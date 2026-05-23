import { redirect } from "next/navigation";
import { defaultLocale } from "@/config/app";

export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
