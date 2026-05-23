/**
 * app/api/auth/[...nextauth]/route.ts
 * Auth.js v5 handler，暴露 GET / POST。
 *
 * 路由：/api/auth/*
 * 由 NextAuth 自动处理所有认证请求。
 */

// EARS-1: 覆盖 — 未登录访问创作功能时，中间件跳转登录页（middleware.ts）
// EARS-5: 覆盖 — 登录后通过 DrizzleAdapter 持久化 Database Session

import { handlers } from "../../../../lib/auth/auth";

export const { GET, POST } = handlers;