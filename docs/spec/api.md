# API 设计文档

## 文档信息

| 项 | 内容 |
|----|------|
| 版本 | **1.0.0** |
| 状态 | **已定稿** |
| 定稿日期 | 2026-05-20 |
| 上游 | [requirements.md](./requirements.md) v1.0.0、[design.md](./design.md) v1.0.0、[data.md](./data.md) v1.0.0 |
| 实现目录 | `app/api/*`（REST）、`app/actions/*`（Server Actions） |

**范围说明：** 本文定义对外契约（REST Route Handlers + Server Actions）、鉴权、错误码与速率限制。**不**重复数据库字段，见 [data.md](./data.md)。

---

## 1. 架构约定（澄清 D4=C）

| 类型 | 用途 | 调用方 |
|------|------|--------|
| **RSC / Server Components** | 读：作品列表、详情、章节树、规划预览 | 页面直接 `await` 领域服务 |
| **Server Actions** | 写：向导、规划确认、手动触发生章、偏好 | 客户端 `form action` / `useActionState` |
| **Route Handlers（REST）** | 长任务进度轮询、健康检查、Auth 回调 | `fetch` + Zustand 定时器 |

```text
读  → RSC（无 /api 列表接口）
写  → Server Actions（默认）
轮询 → GET /api/projects/:projectId/generation-jobs/:jobId
```

---

## 2. 鉴权

### 2.1 会话

- **NextAuth.js（Auth.js v5）** + Database Session（见 design.md §6.1）
- Cookie 会话；`middleware.ts` 保护 `/[locale]/(app)/*` 与创作类 API

### 2.2 规则

| 场景 | HTTP | 行为 |
|------|------|------|
| 未登录访问受保护 Action/API | **401** | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 已登录但 `project.userId` 不匹配 | **404** | `PROJECT_NOT_FOUND`（不暴露他人作品存在） |
| 非法状态转换 | **409** | `INVALID_PROJECT_STATE` 等 |
| 手动模式跳章 | **409** | `CHAPTER_ORDER_VIOLATION` |

### 2.3 Auth 路由（框架内置）

| 方法 | 路径 | 说明 |
|------|------|------|
| * | `/api/auth/[...nextauth]` | 登录、OAuth 回调、登出 |

Credentials 注册/登录通过 NextAuth Credentials Provider + 自定义 `authorize`（见实现）。

---

## 3. 通用约定

### 3.1 基础 URL

| 环境 | REST 前缀 |
|------|-----------|
| 本地 | `http://localhost:3000/api` |
| 生产 | `https://{host}/api` |

页面路由带 locale：`/{locale}/...`（`zh` 默认）。REST **不**带 locale 前缀。

### 3.2 请求头

| 头 | 要求 |
|----|------|
| `Cookie` | 会话（浏览器自动） |
| `Content-Type` | `application/json`（REST POST 若有） |

### 3.3 错误响应体（REST）

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message in English."
  }
}
```

Server Actions 失败时返回：

```typescript
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

**文案语言：** 用户可见 `message` **一律英文**（requirements）；UI 可用 `error.code` 映射 i18n。

### 3.4 速率限制（REQ-018-AC-004）

| 项 | 值 |
|----|-----|
| 范围 | 全部 `/api/*` Route Handlers |
| 限额 | 每 IP **100 次 / 小时**（`RATE_LIMIT_MAX`、`RATE_LIMIT_WINDOW_MS`） |
| 超限 | **429** + `RATE_LIMIT_EXCEEDED` |
| 实现 | `middleware` 或 Route 包装器；键 = IP（一期）；P2 可按 `userId` 细分 |

Server Actions 建议同样经过限流包装（共享计数器）。

---

## 4. 错误码一览

| code | HTTP | 说明 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 未登录 |
| `VALIDATION_ERROR` | 400 | 参数校验失败 |
| `PROJECT_NOT_FOUND` | 404 | 作品不存在或无权 |
| `INVALID_PROJECT_STATE` | 409 | 状态机不允许 |
| `PLANNING_NOT_READY` | 409 | L4 时规划未就绪 |
| `CHAPTER_ORDER_VIOLATION` | 409 | 手动模式跳章 |
| `CHAPTER_NOT_GENERATABLE` | 409 | 目标章非 pending/failed 或非正常当前章 |
| `JOB_NOT_FOUND` | 404 | 任务不存在 |
| `JOB_NOT_RUNNING` | 409 | 任务已结束仍操作 |
| `WRITING_PLAN_CORRUPTED` | 500 | JSON 损坏 |
| `RATE_LIMIT_EXCEEDED` | 429 | 超限 |
| `LLM_PROVIDER_ERROR` | 502 | 上游模型失败 |
| `INTERNAL_ERROR` | 500 | 未分类；不返回堆栈 |

---

## 5. Server Actions

**路径约定：** `app/actions/{domain}.ts`  
**命名：** `camelCase`；下文用 `domain.actionName` 表示。

### 5.1 作品 `projects`

#### `projects.createProject`

| 项 | 内容 |
|----|------|
| 触发 | 新建作品 / 向导入口 |
| 输入 | `{ source?: 'wizard' \| 'quick_start' }` |
| 成功 | `{ projectId, localeRedirect: '/projects/{id}/wizard' }` |
| 副作用 | 插入 `projects`（`status: draft`），分配 `storage_prefix` |

#### `projects.deleteProject`

| 输入 | `{ projectId }` |
| 成功 | `{ ok: true }` |
| 副作用 | 软删或硬删 + `StorageDriver.deletePrefix` |

---

### 5.2 向导 `wizard`

#### `wizard.saveLayer1`

| 输入 | `{ projectId, layer1: Layer1Input }` |
| 成功 | `{ ok: true }` |
| 副作用 | 合并 `creation_config.layer1`；更新 `user_preferences`（REQ-001） |

#### `wizard.saveLayer2`

| 输入 | `{ projectId, layer2: Layer2Input }` |

#### `wizard.saveLayer3`

| 输入 | `{ projectId, title: string }` |
| 成功 | 更新 `projects.title`、`slug`；`creation_config.layer3` |
| 后置 | 可跳转 `plan` 或触发 `planning.startPlanning` |

---

### 5.3 快捷开写 `quickStart`

#### `quickStart.extract`

| 输入 | `{ description: string }`（≥20 字，见 `config/novel.ts`） |
| 成功 | `{ extract: QuickStartExtract, canSkipToPlanning: boolean }` |
| 规则 | 题材/主角/冲突均为空 → `canSkipToPlanning: false`（REQ-003-AC-007） |

#### `quickStart.choosePath`

| 输入 | `{ projectId, path: 'full_wizard' \| 'skip_to_planning' }` |
| 规则 | `skip_to_planning` 要求已有 title（REQ-003-AC-006） |

---

### 5.4 规划 `planning`

#### `planning.startPlanning`

| 项 | 内容 |
|----|------|
| 触发 | L3 完成 / 快捷开写跳规划 |
| 输入 | `{ projectId }` |
| 成功 | `{ ok: true }`（异步时返回 `{ planningJobId? }`） |
| 副作用 | `projects.status → planning`；生成 `00/01/02` 文件；`planning_ready = true` |

#### `planning.confirmPlan`（L4）

| 输入 | 见下表 |
| 成功 | `{ ok: true, redirect: '/projects/{id}/write' }` |

```typescript
type ConfirmPlanInput = {
  projectId: string;
  writingMode: 'serial'; // 一期仅 serial
  creationPace: 'auto' | 'manual';
};
```

| 副作用 | |
|--------|--|
| 更新 `02-写作计划.json`：`creationPace`、`writingMode`、根 `status: in_progress` | |
| `projects.status → writing` | |
| `creationPace === 'auto'` | 创建 `generation_jobs`（`pending`），Worker 消费 |

---

### 5.5 创作 `writing`

#### `writing.generateChapter`（手动模式）

| 输入 | `{ projectId, chapterNumber: number }` |
| 校验 | `creationPace === manual`；`chapterNumber === currentChapter`（最小 pending/failed 序号） |
| 失败 | `409 CHAPTER_ORDER_VIOLATION` |
| 成功 | `{ ok: true, chapterNumber }` |
| 行为 | 同步或短任务执行单章子流程；**不**自动下一章 |

#### `writing.cancelGenerationJob`

| 输入 | `{ projectId, jobId }` |
| 副作用 | `generation_jobs.status → cancelled`（仅 `pending`/`running`） |

---

### 5.6 偏好 `preferences`

#### `preferences.update`

| 输入 | `{ preferences: Partial<UserPreferences> }` |

#### `preferences.reset`

| 输入 | 无 |

---

### 5.7 阅读/编辑（三期部分，契约预留）

| Action | 分期 | 说明 |
|--------|------|------|
| `editor.saveChapter` | 三期 | 写回 MD + `wordCountPass` |
| `export.createExport` | 三期 | 触发导出任务 |

---

## 6. REST Route Handlers

### 6.1 健康检查

#### `GET /api/health`

| 响应 200 | `{ "status": "ok" }` |
| 鉴权 | 无 |

---

### 6.2 创作任务进度（自动模式轮询）

#### `GET /api/projects/[projectId]/generation-jobs/[jobId]`

| 项 | 内容 |
|----|------|
| 鉴权 | 必须登录；归属校验 |
| 用途 | L5 进度条；Zustand 每 2–3s 轮询（可配置） |

**响应 200：**

```json
{
  "job": {
    "id": "uuid",
    "status": "pending | running | completed | failed | cancelled",
    "currentChapterNumber": 5,
    "startedAt": "2026-05-20T10:00:00.000Z",
    "completedAt": null,
    "lastError": null
  },
  "progress": {
    "totalChapters": 20,
    "completedChapters": 4,
    "failedChapters": 0,
    "inProgressChapter": 5,
    "percent": 20
  },
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "星落",
      "status": "completed",
      "wordCount": 4200,
      "wordCountPass": true,
      "filePath": "第01章-星落.md"
    }
  ]
}
```

| 字段来源 | |
|----------|--|
| `job.*` | `generation_jobs` 表 |
| `progress.*` / `chapters[]` | `02-写作计划.json`（合并） |

**错误：** `401` | `404 PROJECT_NOT_FOUND` | `404 JOB_NOT_FOUND`

---

### 6.3 章节正文（可选专用接口）

> 默认阅读器通过 RSC 直读 `StorageDriver`；若客户端组件需按需加载，提供：

#### `GET /api/projects/[projectId]/chapters/[chapterNumber]/content`

| 查询 | `?format=markdown`（默认） |
| 响应 200 | `{ "chapterNumber", "title", "filePath", "content": "..." }` |
| 限制 | 仅作品所有者；**不**用于列表批量拉取 |

---

## 7. RSC 数据契约（非 REST，供页面实现参考）

### 7.1 作品列表 `getProjectsForDashboard()`

```typescript
type ProjectListItem = {
  id: string;
  title: string;
  status: 'draft' | 'planning' | 'writing' | 'validating' | 'completed';
  planningReady: boolean;
  updatedAt: string;
  progressLabel?: string; // e.g. "12/20 chapters"
  resumeHref: string;     // 续写 / 继续确认规划
};
```

| status | `resumeHref` 逻辑 |
|--------|-------------------|
| `writing` / `validating` | `/projects/{id}/write` |
| `planning` + `planningReady` | `/projects/{id}/plan` |
| `draft` | `/projects/{id}/wizard` |

---

### 7.2 作品详情 `getProjectDetail(projectId)`

```typescript
type ProjectDetail = {
  id: string;
  title: string;
  status: ProjectStatus;
  storagePrefix: string;
  creationConfig: CreationConfig;
  files: Array<{
    fileType: 'character' | 'outline' | 'writing_plan' | 'chapter';
    relativePath: string;
    chapterNumber?: number;
    wordCount?: number;
  }>;
  writingPlanSummary?: {
    totalChapters: number;
    creationPace: 'auto' | 'manual';
    writingMode: string;
    chapters: Array<ChapterListItem>;
  };
};
```

**不含**章节 `content` 全文（REQ-007-AC-004）。

---

### 7.3 规划预览 `getPlanningPreview(projectId)`

| 返回 | 人物/大纲摘要、`chapters` 前 N 章、`planningReady` |
| 全文 | 折叠区按需 RSC 加载 MD 片段 |

---

## 8. 状态与 Action 可用矩阵（一期）

| projects.status | 允许的主要 Action |
|-----------------|-------------------|
| `draft` | `wizard.*`, `quickStart.*`, `planning.startPlanning` |
| `planning` | `planning.confirmPlan`（需 `planningReady`） |
| `writing` | `writing.generateChapter`, `writing.cancelGenerationJob`, Job 轮询 |
| `validating` | 只读 + 进度（Phase 4 实现） |
| `completed` | 阅读 RSC；三期 `editor.*` |

---

## 9. Webhook / 外部

一期无对外 Webhook。LLM 调用均为服务端出站 HTTP。

---

## 10. 实现检查清单

| # | 项 |
|---|-----|
| 1 | 所有 Action 入口 `requireUser()` |
| 2 | `projectId` 路径均校验 `user_id` |
| 3 | 错误 `message` 英文，无 stack leak |
| 4 | `/api/*` 全局限流 100/h/IP |
| 5 | Job 轮询响应不含章节全文 |
| 6 | `confirmPlan` 仅在 `planning` + `planning_ready` 可调用 |
| 7 | 手动 `generateChapter` 校验 `currentChapter` |

---

## 11. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-05-20 | 初稿定稿；对齐 D4=C、data.md v1.0.0 |

---

*实现顺序建议：Auth → `projects.createProject` → 向导 Actions → `planning.*` → Job 轮询 API → Worker。*
