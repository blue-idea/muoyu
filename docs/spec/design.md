# 技术设计文档

## 文档信息

| 项 | 内容 |
|----|------|
| 版本 | **1.0.1** |
| 状态 | **已定稿**（2026-05-22，已切换数据库方案为 PostgreSQL） |
| 上游 | [requirements.md](./requirements.md) v1.0.0（已定稿）、[project.md](../project.md) v2.5 |
| 下游 | [data.md](./data.md)（数据库设计）、[api.md](./api.md)（接口设计）、[tasks.md](./tasks.md) |
| 当前代码基线 | Next.js 16 App Router 脚手架（`app/page.tsx`），业务模块待实现 |

**范围说明：** 本文描述技术架构、模块划分、技术选型与横切关注点。**数据库表结构、字段、索引**见 [data.md](./data.md)；**HTTP API 路径、请求/响应契约**见 [api.md](./api.md)。本文仅引用，不重复展开。

---

## 1. 设计目标与约束

### 1.1 目标

| 目标 | 说明 |
|------|------|
| 对齐需求 | 覆盖 REQ-001 ~ REQ-018 及澄清 #1~#5 的产品行为 |
| 文件真源 | 人物/大纲/章节正文以作品目录内 Markdown 为权威副本（REQ-007） |
| 可测试 | 领域逻辑与文件 IO、LLM 调用可单元测试；核心流程可 E2E |
| 可分期 | 架构支持附录 C 一期 MVP 优先，三期以后能力预留扩展点 |

### 1.2 硬约束（来自需求定稿）

- 项目状态 **5 态**：`draft` / `planning` / `writing` / `validating` / `completed`
- **必须登录** 方可创作；访客仅公开页
- Phase 3：**自动**（`creationPace: auto`）与 **手动**（`creationPace: manual`，强制按序）并存
- 手动编辑字数越界：**警告可保存** + `wordCountPass: false`；自动创作仍硬门槛
- 用户可见错误文案：**英文**；代码注释：**中文**

---

## 2. 技术栈与选型

### 2.1 技术栈总览

| 层级 | 选型 | 版本策略 | 选型理由 |
|------|------|----------|----------|
| 运行时 | Node.js | LTS（≥20） | 与 Next.js 16、工具链兼容 |
| 框架 | **Next.js**（App Router） | 16.x 稳定版 | 已初始化；SSR/Route Handlers/中间件 |
| 语言 | **TypeScript** | 5.x | 项目规范；严格模式 |
| UI | **React** + **shadcn/ui** + **Tailwind CSS** | 稳定版 | 组件一致、可访问性、与现有 Tailwind 4 对齐 |
| 认证 | **NextAuth.js**（Auth.js v5） | 稳定版 | 会话、回调、与 App Router 集成 |
| 数据库 | **PostgreSQL** | 16.x 稳定版 | 关系型元数据、事务、生态成熟 |
| ORM | **Drizzle ORM** | 稳定版 | 类型安全 schema、迁移、轻量 |
| 国际化 | **next-intl** | 稳定版 | App Router 路由级 i18n |
| 客户端状态 | **Zustand** | 稳定版 | 向导多步、创作进度页局部 UI 状态 |
| 作品正文存储 | **`StorageDriver` 抽象**（一期 `local`，预留 **R2**） | — | 满足 REQ-007；DB 仅存路径/对象键索引（澄清 D3=B） |
| 单元测试 | **Vitest** + Testing Library | 稳定版 | 项目规范 |
| E2E | **Playwright** | 稳定版 | 项目规范；核心用户旅程 |
| 工程化 | ESLint、Husky、lint-staged、GitHub Actions | 已有/待补 | AGENTS.md 质量基线 |

> **说明：** 禁止使用 beta 包（AGENTS.md）。LLM 调用通过 OpenAI 兼容 HTTP 客户端封装，密钥走环境变量（REQ-014、REQ-018）。

### 2.2 明确不纳入本设计主路径的技术

| 技术 | 说明 |
|------|------|
| Supabase | AGENTS.md 安全示例中的 RLS 思路在 **PostgreSQL + 应用层归属校验（可选原生 RLS）** 中实现，不引入 Supabase |
| 正文字段入库 | 违反 REQ-007，禁止 |

### 2.3 核心依赖关系

```mermaid
flowchart TB
    subgraph client [浏览器]
        UI[React + shadcn]
        ZS[Zustand]
        UI --> ZS
    end

    subgraph next [Next.js App]
        RSC[RSC / Pages]
        API[Route Handlers]
        MW[Middleware\nAuth + i18n + RateLimit]
        RSC --> API
        MW --> RSC
        MW --> API
    end

    subgraph services [服务端模块 lib/]
        DOM[领域服务 novel/]
        WS[StorageDriver]
        AI[LLM Client]
        JOB[Job Runner]
        DOM --> WS
        DOM --> AI
        JOB --> DOM
    end

    subgraph data [持久化]
        PostgreSQL[(PostgreSQL\nDrizzle)]
        FS[(作品目录 MD/JSON)]
    end

    client --> next
    API --> services
    DOM --> PostgreSQL
    WS --> FS
```

---

## 3. 系统架构

### 3.1 逻辑分层

| 层 | 职责 | 目录（规划） |
|----|------|--------------|
| 表现层 | 页面、布局、表单、进度 UI | `app/[locale]/`、`components/` |
| 应用层 | Route Handlers、鉴权入口、DTO 校验 | `app/api/` |
| 领域层 | 项目状态机、Phase 流程、章节创作子流程 | `lib/novel/` |
| 基础设施层 | DB、存储、LLM、任务队列、配置 | `lib/db/`、`lib/storage/`、`lib/ai/`、`lib/jobs/`、`config/` |

**依赖规则：** 表现层 → 应用层 → 领域层 → 基础设施层；领域层不得依赖 React。

### 3.2 部署逻辑视图

```mermaid
flowchart LR
    User[用户浏览器]
    Next[Next.js 进程\nWeb + API]
    Worker[Worker 进程\nnpm run worker]
    PostgreSQL[(PostgreSQL)]
    Store[(StorageDriver\nlocal / 预留 R2)]

    User --> Next
    Next --> PostgreSQL
    Next --> Store
    Worker --> PostgreSQL
    Worker --> Store
    Next -.触发.-> Worker
```

| 组件 | 一期 MVP | 说明 |
|------|----------|------|
| Next.js Web | 必须 | 页面 + API |
| PostgreSQL | 必须 | 用户、项目元数据、任务、偏好 |
| 作品存储 | 必须 | `StorageDriver` 一期 **local**（`WORKSPACE_ROOT`）；接口预留 **Cloudflare R2**（S3 兼容） |
| 独立 Worker | **必须（澄清 D1=A）** | `npm run worker` 独立进程；消费 `generation_jobs`；`creationPace: auto` 时后台逐章，避免 Serverless 超时 |
| Redis | 可选 P2 | 分布式限流、任务锁；一期可用 DB 任务表 + 单 Worker |

### 3.3 与需求模块映射

| 需求 | 领域模块 | 主要技术落点 |
|------|----------|--------------|
| REQ-001 偏好 | `PreferenceService` | PostgreSQL `user_preferences`；见 data.md |
| REQ-002 工作台 | `ProjectService` | PostgreSQL `projects` + 状态枚举 |
| REQ-003 L0 快捷开写 | `QuickStartService` + 向导 Store | Zustand + `ExtractService`(AI) |
| REQ-007 文件真源 | `WorkspaceService` | FS 读写；`content_files` 索引 |
| REQ-008~009 规划 | `PlanningService` | AI + 写 `00/01/02` 文件 |
| REQ-010 创作 | `ChapterWriter` + `JobRunner` | 子流程纯函数 + Worker |
| REQ-011 校验 | `ValidationService` | 读 MD 统计字数；更新计划 JSON |
| REQ-012 阅读 | `ReaderService` | 读 MD 渲染；导出 P3 |
| REQ-013 编辑 | `EditorService` | 写回 MD；`wordCountPass` |
| REQ-014 模型 | `ModelConfigService` | 加密存 Key；`LlmRouter` |
| REQ-015 知识库 | `KnowledgeService` | 文档解析 + RAG 片段；P4 |
| REQ-016 章节重生 | `RegenerateService` | 复用 `ChapterWriter` |
| REQ-017 状态机 | `ProjectStateMachine` | 集中转换规则 |
| REQ-018 安全 | Middleware + 服务层校验 | 限流、归属、env |

---

## 4. 项目结构（规划）

当前仓库为脚手架，以下为 **目标结构**（一期按模块渐进创建）：

```text
moyu/
├── app/
│   ├── [locale]/                    # next-intl 语言前缀
│   │   ├── (marketing)/             # 访客：首页、落地页
│   │   ├── (auth)/                  # 登录/注册
│   │   └── (app)/                   # 需登录
│   │       ├── dashboard/           # 我的作品
│   │       └── projects/[projectId]/
│   │           ├── wizard/          # L1-L3
│   │           ├── plan/            # L4
│   │           ├── write/           # L5 创作进度
│   │           ├── read/            # 阅读器
│   │           └── edit/            # M8 编辑
│   └── api/                         # Route Handlers → 契约见 api.md
├── components/
│   ├── ui/                          # shadcn
│   └── novel/                       # 业务组件
├── config/                          # 集中配置（AGENTS.md）
│   ├── app.ts
│   ├── novel.ts                     # 字数区间、重试次数等
│   └── paths.ts
├── drizzle/
│   ├── schema/                      # 表定义 → 详见 data.md
│   └── migrations/
├── lib/
│   ├── auth/                        # NextAuth 配置
│   ├── db/                          # Drizzle client
│   ├── storage/                     # StorageDriver：local（一期）、r2（预留）
│   ├── ai/                          # OpenAI 兼容客户端
│   ├── jobs/                        # 任务入队与执行
│   └── novel/                       # 领域服务（按上表）
├── messages/                        # next-intl 文案（en 错误信息等）
├── stores/                          # Zustand：wizardStore、writeProgressStore
├── tpl/                             # 已有：流程与写作模版
├── tests/
│   ├── unit/                        # Vitest
│   └── e2e/                         # Playwright
├── scripts/
│   └── worker.ts                    # 后台创作 Worker 入口
└── docs/spec/
    ├── requirements.md
    ├── design.md                    # 本文
    ├── data.md                      # 待编写
    └── api.md                       # 待编写
```

---

## 5. 核心领域设计

### 5.1 双存储模型（REQ-007）

```mermaid
flowchart LR
    subgraph postgresql [PostgreSQL 元数据]
        P[projects]
        CF[content_files]
        WP[writing_plan 快照可选]
    end

    subgraph store [StorageDriver]
        F0[00-人物档案.md]
        F1[01-大纲.md]
        F2[02-写作计划.json]
        FN[第NN章-标题.md]
    end

    P -->|storageKey / workspacePath| store
    CF -->|relativePath| store
    DOM[领域服务] -->|先写对象| store
    DOM -->|后更新索引| postgresql
```

**存储抽象（澄清 D3=B，预留 R2）：**

```typescript
// lib/storage/types.ts — 领域层仅依赖此接口
interface StorageDriver {
  readText(key: string): Promise<string>;
  writeText(key: string, body: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  deletePrefix(prefix: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}
```

| 驱动 | 一期 | 说明 |
|------|------|------|
| `LocalStorageDriver` | **实现** | 根目录 `WORKSPACE_ROOT`（`.env`） |
| `R2StorageDriver` | **预留** | S3 兼容（`@aws-sdk/client-s3`）；`STORAGE_DRIVER=r2` + `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` |

- 工厂：`getStorageDriver()` ← `config/storage.ts`
- DB 仅存逻辑键（`relativePath` / `storageKey`），不存正文

| 操作 | 顺序 | 说明 |
|------|------|------|
| 生成/更新正文 | `writeText` → 更新 `content_files` + `projects.updatedAt` | 存储为真源 |
| 读取章节 | `storageKey` + `relativePath` → `readText` | 可短时内存缓存 |
| 删除作品 | `deletePrefix` + 级联删索引 | 先 DB 后存储，或补偿任务 |

**键约定（local）：** `{WORKSPACE_ROOT}/{userId}/{projectId}-{slug}/`；**R2** 使用相同相对路径作为 object key 前缀。

> 表字段与 ER 图见 **[data.md](./data.md)**。

### 5.2 项目状态机（REQ-017）

```mermaid
stateDiagram-v2
    [*] --> draft: 新建向导
    draft --> planning: 提交配置 / 开始 Phase2
    planning --> writing: L4 确认 + 选模式
    writing --> validating: 全章 completed
    validating --> writing: 校验失败需重写
    validating --> completed: 校验通过
    completed --> [*]
```

实现：`lib/novel/project-state-machine.ts` 纯函数 `assertTransition(from, to, event)`，非法转换抛业务错误（英文 message key）。

### 5.3 Phase 3 创作节奏（REQ-009、REQ-010）

```mermaid
flowchart TD
    Start[进入 Phase3] --> Pace{creationPace}
    Pace -->|auto| AutoLoop[JobRunner 主循环]
    Pace -->|manual| ManualUI[创作进度页]
    AutoLoop --> Sub[单章创作子流程]
    Sub --> NextAuto[认领下一 pending 章]
    NextAuto --> AutoLoop
    ManualUI --> Btn[用户点击生成本章]
    Btn --> Check{当前最小序号?}
    Check -->|否| Reject[拒绝跳章]
    Check -->|是| Sub
    Sub --> Preview[本章预览]
    Preview --> ManualUI
```

**单章创作子流程**（自动/手动共用，宜纯函数 + 可单测）：

1. 写前分析（读大纲行、人物、前章摘要、知识库片段）
2. 撰写 → 写 `第NN章-*.md`
3. 张力检查 / 润色（AI）
4. 字数检查；未达标 → 扩充，≤3 轮
5. 写摘要 → `01-大纲.md`
6. 更新 `02-写作计划.json`

模版与规则引用 `tpl/flows/phase3-writing.md`、`tpl/guides/*`。

### 5.4 后台任务（自动创作）

**部署（澄清 D1=A）：** Web 进程只负责入队与查询进度；**独立 Worker 进程**（`scripts/worker.ts`，`package.json` 脚本 `worker`）循环消费任务，与 Next.js 同连 PostgreSQL，经 `getStorageDriver()` 读写作品存储。

| 项 | 设计 |
|----|------|
| 触发 | L4 确认且 `creationPace=auto` → API 写入 `generation_jobs`（`status: pending`），Worker 拉取执行 |
| 消费 | Worker 单实例轮询（一期）；同项目互斥锁（DB `locked_at` / 行锁）避免双写 |
| 并发 | 一期单项目串行写章；`writingMode: parallel` 为 P2 |
| 断点续写 | Job 记录 `currentChapter`；Worker 从 `in_progress` / 下一 `pending` 继续 |
| 失败 | 章 `failed` + `retryCount`；超 3 次标异常继续下一章（REQ-010-AC-006） |
| 手动模式 | 不经过 Worker；API 同步或短任务调用 `ChapterWriter`（用户按章触发） |

> 任务表结构见 **[data.md](./data.md)**；启停/状态查询 API 见 **[api.md](./api.md)**。

### 5.5 快捷开写（REQ-003 澄清 #3）

- API/服务：`QuickStartService.extract(description)` → 结构化字段
- UI：提取结果页 + **用户**选择「进入完整向导」或「跳过至规划」
- 跳规划前若无 `novelName` → 先 L3

### 5.6 LLM 调用（REQ-014）

```mermaid
flowchart LR
    SVC[领域服务] --> Router[LlmRouter]
    Router --> UserCfg[用户 OpenAI 兼容配置]
    Router --> Platform[平台默认配置]
    UserCfg --> HTTP[Chat Completions API]
    Platform --> HTTP
```

- 密钥：加密存 DB（见 data.md），界面脱敏
- 用途：规划、创作、润色、标题、快捷提取、一致性检查（按分期启用）

---

## 6. 认证与授权

### 6.1 NextAuth 集成

**登录方式（澄清 D2=B）：** 一期同时支持 **Credentials（邮箱+密码）** 与 **OAuth**；OAuth Provider 首期建议 **GitHub + Google**（可配置开关，见 `config/auth.ts`）。

| 项 | 设计 |
|----|------|
| 适配器 | **Auth.js v5 + Drizzle Adapter** — `users`、`accounts`、`sessions`、`verification_tokens`（见 data.md） |
| 会话 | **Database Session**（便于撤销、与 OAuth `accounts` 关联） |
| Credentials | 邮箱注册/登录；密码 **bcrypt** 哈希存 `users.password_hash`（仅 Credentials 用户非空） |
| OAuth | `GitHubProvider`、`GoogleProvider`；`allowDangerousEmailAccountLinking: false`，同邮箱需显式绑定策略（api.md 约定） |
| 页面保护 | `middleware.ts`：`/app/*`、`/api/projects/*` 等需 `auth()` |
| 访客 | `(marketing)` 路由不强制登录；创作 API 返回 401 |
| 登录回跳 | `callbackUrl` 保留原目标（REQ 登录拦截点） |
| 环境变量 | `AUTH_SECRET`、`AUTH_GITHUB_ID/SECRET`、`AUTH_GOOGLE_ID/SECRET`（禁止硬编码，见 AGENTS.md） |

### 6.2 资源归属（应用层优先，兼容 RLS）

一期默认采用 **Repository/Service 层强制归属校验**（即使 PostgreSQL 支持原生 RLS 也先不依赖数据库策略）：

```text
∀ 查询/更新 projects, content_files, knowledge_documents, ...
  WHERE user_id = session.user.id
```

- Route Handler 入口：`requireUser()`  
- 禁止信任客户端传入的 `userId`  
- 跨用户访问返回 404（避免泄露存在性）或 403（按 api.md 约定）

---

## 7. 前端架构

### 7.0 数据获取策略（澄清 D4=C）

| 场景 | 方式 | 说明 |
|------|------|------|
| **读**（列表、详情、章节树） | **RSC + Server Components** | 在 Server Component 内直接调用领域服务 / Repository；`revalidatePath` / `revalidateTag` 失效缓存 |
| **写**（向导提交、保存章节、触发规划） | **Server Actions** | `app/actions/*.ts`；`useFormState` / `useActionState`；校验失败返回英文字段错误 |
| **长任务进度**（自动创作 Job） | **REST 轮询** | `GET /api/projects/[id]/jobs/[jobId]`（见 api.md）；客户端 **Zustand + `setInterval` fetch**，不用 React Query |
| **禁止** | 业务读走客户端 REST 再灌 Zustand 当真源 | 避免双份缓存与 RLS 遗漏 |

```mermaid
flowchart TB
    RSC[Server Components\n读数据]
    SA[Server Actions\n写数据]
    API[Route Handlers\nJob 进度轮询]
    DOM[领域服务]

    RSC --> DOM
    SA --> DOM
    API --> DOM
```

### 7.1 路由与国际化（next-intl）

**语言策略（澄清 D5=A）：**

| 项 | 约定 |
|----|------|
| 默认 locale | **`zh`**（`defaultLocale: 'zh'`，`localePrefix: 'always'`） |
| 界面文案 | `messages/zh.json` — 中文 UI |
| 错误/校验文案 | **始终英文** — `messages/en.json` 的 `errors.*` 命名空间；Server Actions / API 返回 `errorKey`，客户端用 `tErrors(errorKey)` 解析（与用户当前 UI locale 无关） |
| 可选英文 UI | `/en/...` + `messages/en.json` 完整翻译（P2 可渐进） |

| 模式 | 路径示例 | 说明 |
|------|----------|------|
| 默认 | `/zh/dashboard` | 未带 locale 时重定向至 `/zh` |
| 英文 UI | `/en/dashboard` | 可选第二语言界面 |
| 配置 | `middleware` 合并 auth + intl | 避免重复重定向；`config/app.ts` 导出 `locales`、`defaultLocale` |

### 7.2 状态划分

| 状态类型 | 工具 | 示例 |
|----------|------|------|
| 服务端数据 | **RSC**（读）、**Server Actions**（写） | 作品详情、章节列表、向导提交 |
| 多步向导草稿 | **Zustand** `wizardStore` | L1-L3 步骤、提取结果（未提交前） |
| 创作进度轮询 | **Zustand** + REST 定时 fetch | 仅 `creationPace: auto` 的 Job 进度 |
| URL 可分享状态 | `searchParams` | 当前章 `?chapter=3` |

**原则：** 业务真源不在 Zustand；仅 UI 草稿与 Job 轮询快照。

### 7.3 UI 组件

- 基础组件：`components/ui/*`（shadcn CLI 生成）
- 业务：`components/novel/*`（向导步、大纲表、进度条、阅读器）
- 披露层级 L0-L5 对应页面/折叠区（requirements §5）

---

## 8. 配置管理（config/）

| 文件 | 内容 |
|------|------|
| `config/app.ts` | 站点名、`defaultLocale: 'zh'`、`locales: ['zh','en']`、分页 |
| `config/novel.ts` | `MIN_WORDS=3000`、`MAX_WORDS=5000`、`MAX_RETRY=3`、`QUICK_START_MIN_CHARS=20` |
| `config/paths.ts` | 作品文件名常量（`00-人物档案.md` 等） |
| `config/storage.ts` | `STORAGE_DRIVER`、`getStorageDriver()` 工厂 |
| 环境变量 | 见下表；**禁止硬编码密钥** |

| 变量 | 用途 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接 |
| `AUTH_SECRET` | NextAuth |
| `STORAGE_DRIVER` | `local`（一期默认）或 `r2` |
| `WORKSPACE_ROOT` | local 驱动作品根目录 |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | R2 驱动（预留，S3 兼容 endpoint） |
| `PLATFORM_LLM_*` | 平台默认模型 |
| `ENCRYPTION_KEY` | 用户 API Key 加密 |
| `RATE_LIMIT_*` | 限流参数 |

---

## 9. 数据与接口（引用）

| 文档 | 内容 | 状态 |
|------|------|------|
| **[data.md](./data.md)** | ER 图、表结构、Drizzle schema 约定、索引、`02-写作计划.json` 与 DB 同步策略 | **v1.0.0 已定稿** |
| **[api.md](./api.md)** | REST/Route Handler 列表、请求/响应、错误码、鉴权 | **v1.0.0 已定稿** |

**设计层已约定的跨文档契约（写入 data/api 时需保持一致）：**

- `projects.status` ∈ `draft | planning | writing | validating | completed`
- `02-写作计划.json` 含 `creationPace`、`writingMode`、`chapters[].wordCountPass`
- 列表接口返回 `filePath`，**不**内嵌章节全文（REQ-007-AC-004）
- 未登录 → HTTP **401**，文案英文

---

## 10. 测试策略

### 10.1 测试金字塔

```mermaid
flowchart TB
    E2E[Playwright E2E\n少量关键路径]
    INT[集成测试 Vitest\nDB/FS 测试容器]
    UNIT[Vitest 单元\n领域逻辑为主]

    E2E --> INT
    INT --> UNIT
```

### 10.2 单元测试（Vitest）

| 范围 | 示例 |
|------|------|
| 状态机 | `draft → planning` 非法事件拒绝 |
| 手动模式 | 非当前最小序号章拒绝生成 |
| 字数策略 | 自动模式未达标不可 `completed`；编辑警告路径 |
| 写作计划 | 解析/更新 `02-写作计划.json` |
| Workspace | 读写 MD 使用临时目录 fixture |
| AI | `LlmRouter` mock，不测真实 API |

**工具：** `@testing-library/react` 测组件；`vi.mock` 隔离 FS/DB。

### 10.3 E2E（Playwright）

| 优先级 | 场景 | 对应需求 |
|--------|------|----------|
| P0 | 登录 → 完整向导 → 规划确认 → 自动创作 → 阅读 | 一期 MVP |
| P0 | 手动模式：按序生成本章 | 澄清 #1 |
| P1 | 快捷开写二选一 | 澄清 #3 |
| P1 | 未登录访问创作页跳转登录 | 澄清 #4 |

- 配置：Chromium 为主；CI 可选 Firefox/WebKit（AGENTS.md）
- 测试数据：见未来 `seed.md`；E2E 使用独立 DB + `WORKSPACE_ROOT` 临时目录
- 视觉回归：涉及 UI 任务时可用 Playwright MCP 做对比（AGENTS.md）

### 10.4 CI（GitHub Actions）

| 阶段 | 命令 |
|------|------|
| 静态检查 | `tsc --noEmit`、`eslint` |
| 单元测试 | `vitest run` |
| E2E | `playwright test`（可选仅 main PR） |
| 迁移 | `drizzle-kit migrate` 于部署前 |

---

## 11. 安全性

| 威胁 | 措施 | 需求 |
|------|------|------|
| 未授权访问 | NextAuth + 中间件 + Service 层 `userId` 过滤 | REQ-002、REQ-018 |
| 水平越权 | 所有 project 查询带 `userId` | 澄清 #4 |
| API 密钥泄露 | 环境变量 + 加密存储 + 日志脱敏 | REQ-014、REQ-018 |
| 速率滥用 | 全 API  IP 限流 100 次/小时（可配置） | AGENTS.md |
| 路径遍历 | `WorkspaceService` 规范化路径，禁止 `..` | REQ-007 |
| 文件上传 | 知识库 MIME/大小白名单；病毒扫描 P2 | REQ-015 |
| LLM 注入 | 模版化 prompt；用户输入转义；输出校验 | 通用 |
| 错误信息 | 英文对外；不暴露 stack | REQ-018-AC-004 |

**限流实现（一期）：** `middleware` 或 Route Handler 包装器 + 内存/DB 计数；生产建议 Redis（P2）。

---

## 12. 分期落地顺序（与 requirements 附录 C 对齐）

```mermaid
gantt
    title 技术落地顺序（建议）
    dateFormat YYYY-MM-DD
    section 基础设施
    Drizzle schema + Auth + config     :a1, 2026-06-01, 10d
    WorkspaceService + 状态机          :a2, after a1, 7d
    section 一期 MVP
    向导 L1-L4 + Planning              :b1, after a2, 14d
    ChapterWriter + Worker 自动模式    :b2, after b1, 14d
    手动模式 + 阅读                    :b3, after b2, 7d
    section 二期+
    校验/续写/快捷开写强化             :c1, after b3, 14d
```

| 阶段 | 架构增量 |
|------|----------|
| 一期 | PostgreSQL 核心表、FS、NextAuth、单 Worker、串行+自动/手动、Vitest 核心单测、Playwright 主路径 |
| 二期 | 校验 Job、偏好同步、断点续写强化 |
| 三期 | 编辑器、导出管道、用户 LLM 配置 |
| 四期 | 知识库 RAG、章节重生、并行 Worker |

---

## 13. 设计澄清决议（已定稿）

| # | 优先级 | 决议 |
|---|--------|------|
| D1 | P0 | **A** — Next.js Web + 独立 `npm run worker` + `generation_jobs` |
| D2 | P0 | **B** — Credentials + OAuth（GitHub、Google）；Drizzle Adapter + Database Session |
| D3 | P1 | **B** — `StorageDriver`；一期 `local`；预留 **Cloudflare R2** |
| D4 | P1 | **C** — 读 RSC；写 Server Actions；Job 进度 REST + Zustand |
| D5 | P1 | **A** — 默认 locale `zh`；错误/校验文案英文（`messages/en.json` `errors.*`） |

**下一阶段：**（可选）[tasks.md](./tasks.md) 任务拆分；进入 `drizzle/schema` 与基础设施实现。

---

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1 | 2026-05-20 | 初稿，基于 requirements v1.0.0 与指定技术栈 |
| 0.1.1 | 2026-05-20 | 澄清 D1：独立 Worker 进程（必须） |
| 0.1.2 | 2026-05-20 | 澄清 D2：Credentials + OAuth（GitHub、Google） |
| 0.1.3 | 2026-05-20 | 澄清 D3：StorageDriver + local 默认，预留 R2 |
| 0.1.4 | 2026-05-20 | 澄清 D4：RSC 读 + Server Actions 写 + Job REST 轮询 |
| 1.0.0 | 2026-05-20 | 澄清 D5；设计定稿，进入 data.md / api.md |
| 1.0.1 | 2026-05-22 | 数据库方案由 MySQL 调整为 PostgreSQL（含 RLS 策略说明与部署描述同步） |

---

*下游文档：[data.md](./data.md)、[api.md](./api.md) 按 PostgreSQL 方案对齐。*
