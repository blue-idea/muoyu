/**
 * next-intl 请求配置
 * 供 next-intl 插件使用
 */
import { getRequestConfig } from "next-intl/server";
import { routing } from "@/lib/i18n/routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as "zh" | "en")) {
    return {
      locale: routing.defaultLocale,
      messages: {},
    };
  }

  // errors.* 始终走 en.json（英文错误）
  const messages = {
    en: (await import("@/messages/en.json")).default,
  };

  return {
    locale,
    messages,
  };
});