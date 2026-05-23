# 系统信息与开发环境

## 文档信息

| 项 | 内容 |
|----|------|
| 版本 | **1.2.0** |
| 状态 | 已定稿 |
| 定稿日期 | 2026-05-23 |
| 关联 | [design.md](./design.md) §5.1、§8、[data.md](./data.md) |

---

## 1. 项目概览

| 项 | 内容 |
|----|------|
| 项目名称 | 摸鱼小说（muoyu） |
| 运行时 | Node.js LTS（≥20） |
| 包管理 | pnpm |
| Web 框架 | Next.js 16（App Router） |
| 数据库 | PostgreSQL 16.x |
| ORM | Drizzle ORM |
| 对象存储 | **Cloudflare R2**（唯一；所有 MD/JSON/导出文件） |
| 测试 | Vitest + Playwright |

---

## 2. 本地开发环境

### 2.1 前置依赖

| 依赖 | 用途 |
|------|------|
| Node.js ≥20 | 运行时 |
| pnpm | 包管理 |
| PostgreSQL 16+ | 元数据与 Auth 会话 |
| **Cloudflare R2** | 作品 MD/JSON、知识库全文、导出文件（**必填**） |
| Git | 版本控制 |

本地开发与生产均连接 R2；推荐使用独立 **dev Bucket**（如 `muoyu-dev`），避免污染生产数据。

### 2.2 环境变量

复制 `.env.example` 为 `.env.local` 并填写：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `AUTH_SECRET` | 是 | Auth.js 会话密钥 |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | OAuth 可选 | GitHub 登录 |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth 可选 | Google 登录 |
| `R2_ACCOUNT_ID` | **是** | Cloudflare 账户 ID |
| `R2_ACCESS_KEY_ID` | **是** | R2 API 令牌 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | **是** | R2 API 令牌 Secret Access Key |
| `R2_BUCKET` | **是** | Bucket 名称（dev 推荐 `muoyu-dev`） |
| `R2_ENDPOINT` | 否 | 默认 `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com` |
| `R2_REGION` | 否 | 默认 `auto` |
| `PLATFORM_LLM_BASE_URL` | 是 | 平台默认 LLM API |
| `PLATFORM_LLM_API_KEY` | 是 | 平台默认 LLM Key |
| `PLATFORM_LLM_MODEL` | 是 | 平台默认模型名 |
| `ENCRYPTION_KEY` | 是 | 用户 API Key AES 加密（32 字节 hex） |
| `RATE_LIMIT_MAX_REQUESTS` | 否 | 默认 100 |
| `RATE_LIMIT_WINDOW_MS` | 否 | 默认 3600000 |
| `NOVEL_*` | 否 | 见 `config/novel.ts` |

> **已移除：** `STORAGE_DRIVER`、`WORKSPACE_ROOT` — 不再支持本地文件系统存储。

### 2.3 Cloudflare R2 配置

1. Cloudflare Dashboard → **R2** → 创建 Bucket（dev：`muoyu-dev`；prod：`muoyu-prod`）
2. **Manage R2 API Tokens** → 创建 API 令牌（Object Read & Write，限定对应 Bucket）
3. 将 Account ID、Access Key、Secret、Bucket 写入环境变量
4. **Web 与 Worker 进程使用相同 R2 配置**
5. 启动时若缺少任一 `R2_*` 必填项，进程应失败并输出英文错误

**测试：** 单元测试通过 mock `@aws-sdk/client-s3` 覆盖 `R2StorageDriver`，无需真实 R2 连接。可选对 dev Bucket 做冒烟读写（`.env.test`，CI 可 skip）。

### 2.4 常用命令

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev          # Web
pnpm worker       # 后台 Worker（须与 Web 同 R2 配置）
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm test:e2e
pnpm build
```

### 2.5 PostgreSQL 连接

```bash
psql "$DATABASE_URL"
```

---

## 3. R2 存储布局

### 3.1 对象键（不含 Bucket 名）

```text
{userId}/{projectId}-{slug}/00-人物档案.md
{userId}/{projectId}-{slug}/01-大纲.md
{userId}/{projectId}-{slug}/02-写作计划.json
{userId}/{projectId}-{slug}/第01章-标题.md
{userId}/knowledge/{documentId}.txt
{userId}/exports/{projectId}/{exportId}.pdf
```

- DB 字段 `projects.storage_prefix` = `{userId}/{projectId}-{slug}/`（R2 前缀）
- DB 字段 `content_files.relative_path` = 对象键后缀（如 `第01章-标题.md`）
- 完整 R2 对象键 = `storage_prefix` + `relative_path`
- 正文类：`readText` / `writeText`；导出类：`readBytes` / `writeBytes`

### 3.2 数据库与 R2 分工

| 数据 | 存储位置 |
|------|----------|
| 章节/人物/大纲 MD、写作计划 JSON | **R2 对象** |
| 知识库解析全文 | R2（`knowledge_documents.text_storage_key`） |
| 导出 PDF/EPUB 等 | R2（`export_records.storage_key`） |
| 作品状态、章节索引、字数 | PostgreSQL（`projects`、`content_files`） |
| 创作配置、偏好 JSON | PostgreSQL（短 JSON，非 MD 正文） |

### 3.3 删除与补偿

- 删除作品：`deletePrefix(storage_prefix)` 批量删除 R2 前缀下全部对象
- 失败：`storage_delete_pending=true`，Worker 重试

---

## 4. 进程架构

```text
┌─────────────────┐     ┌─────────────────┐
│  Next.js :3000  │     │  worker.ts      │
│  页面 + API     │     │  规划/创作/补偿  │
└────────┬────────┘     └────────┬────────┘
         │      同一 R2 配置       │
         └───────────┬───────────┘
                     ▼
              PostgreSQL（元数据 + R2 路径索引）
                     │
                     ▼
              Cloudflare R2（MD/JSON/导出真源）
```

---

## 5. 部署要点

| 组件 | 说明 |
|------|------|
| Web | 需 `DATABASE_URL`、Auth、LLM、**完整 R2 配置** |
| Worker | 与 Web **相同** R2 凭证与 `R2_BUCKET` |
| PostgreSQL | 部署前执行 `pnpm db:migrate` |
| R2 | 生产使用独立 Bucket；服务端 S3 API 访问，无需浏览器 CORS |

---

## 6. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1 | 2026-05-20 | 仅 PostgreSQL 连接说明 |
| 1.0.0 | 2026-05-23 | 扩充环境变量与命令 |
| 1.1.0 | 2026-05-23 | R2 完整配置指南；双驱动键约定 |
| 1.2.0 | 2026-05-23 | **R2 唯一存储**；移除 local/WORKSPACE_ROOT；dev 亦需 R2 |
