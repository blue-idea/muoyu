/**
 * (app) 路由组布局
 *
 * EARS-4: 未登录用户访问偏好设置 → 跳转登录页
 *
 * 此布局对所有 (app) 下的路由做登录检查，未登录者重定向至登录页。
 */

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return <>{children}</>;
}