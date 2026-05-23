/**
 * next-intl 国际化配置
 *
 * 默认 locale: zh
 * errors.* 文案走 messages/en.json（始终英文）
 */
import { defaultLocale, locales } from "@/config/app";

export { defaultLocale, locales };
export type AppLocale = "zh" | "en";