/**
 * next-intl 路由配置
 */
import { defineRouting } from "next-intl/routing";
import { defaultLocale } from "@/config/app";

export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale,
  localePrefix: "always",
});