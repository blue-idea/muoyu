/**
 * 根布局：不带 locale，作为 next-intl 的入口
 * locale 由 [locale] 动态段提供
 */
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales } from "@/lib/i18n";
import { Toaster } from "sonner";
import "./globals.css";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 根布局使用默认 locale，next-intl 会自动处理
  return children;
}