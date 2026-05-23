# API 设计文档

## 文档信息

| 项 | 内容 |
|----|------|
| 版本 | **1.4.0** |
| 状态 | **已定稿** |
| 定稿日期 | 2026-05-23 |
| 上游 | [requirements.md](./requirements.md) v1.4.0、[design.md](./design.md) v1.4.0、[data.md](./data.md) v1.3.0 |
| 实现目录 | `app/api/*`（REST）、`app/actions/*`（Server Actions） |

**范围说明：** 本文定义对外契约（REST Route Handlers + Server Actions）、鉴权、错误码与速率限制。**不**重复数据库字段，见 [data.md](./data.md)。

**存储约定：** 章节/人物/大纲等 MD 正文存 **Cloudflare R2**；API 中的 `filePath` 为 R2 对象键后缀或完整键（`storage_prefix` + `relative_path`），**不**返回正文（列表接口）；正文通过 R2 读取专用接口或 RSC 加载。

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
轮询 → GET /api/projects/:projectId/planning-jobs/:jobId
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

**文案语言：** 用户可见 `message` **一律英文**（requirements）；UI **必须**用 `error.code` 映射 `messages/en.json` 的 `errors.*`（与用户界面 locale 无关）。

**Server Actions 约定：** `error.code` 与 REST 错误码同名；客户端禁止直接展示 `message` 字符串（便于统一文案与测试）。

### 3.4 速率限制（REQ-018-AC-004、AC-006）

| 项 | 值 |
|----|-----|
| 范围 | 全部 `/api/*` Route Handlers |
| 限额 | 每 IP **100 次 / 小时**（`RATE_LIMIT_MAX`、`RATE_LIMIT_WINDOW_MS`） |
| 超限 | **429** + `RATE_LIMIT_EXCEEDED` |
| 实现 | `middleware` 或 Route 包装器；键 = IP；可按 `userId` 细分 |

Server Actions 建议同样经过限流包装（共享计数器）。

**UI 反馈（REQ-018-AC-006）：** 超限或 Action 返回 `RATE_LIMIT_EXCEEDED` 时，当前页面以 Toast/Banner 展示 `tErrors('rateLimited')`，不得静默失败。

### 3.5 错误码 → 客户端 `errors.*` 映射

| `error.code` | `messages/en.json` 键 | 建议 UI |
|--------------|----------------------|---------|
| `UNAUTHORIZED` | `errors.unauthorized` | 跳转登录（middleware 优先） |
| `VALIDATION_ERROR` | `errors.validation` | 表单字段旁提示 |
| `RATE_LIMIT_EXCEEDED` | `errors.rateLimited` | Toast |
| `PROJECT_NOT_FOUND` | `errors.projectNotFound` | Toast + 回仪表盘 |
| `INVALID_PROJECT_STATE` | `errors.invalidProjectState` | Toast |
| `PLANNING_NOT_READY` | `errors.planningNotReady` | 跳转 `/planning` 轮询 |
| `PLANNING_JOB_FAILED` | `errors.planningJobFailed` | 规划页展示 + 重试按钮 |
| `CHAPTER_ORDER_VIOLATION` | `errors.chapterOrderViolation` | Toast |
| `CHAPTER_NOT_GENERATABLE` | `errors.chapterNotGeneratable` | Toast |
| `JOB_NOT_FOUND` | `errors.jobNotFound` | Toast |
| `STORAGE_IO_ERROR` | `errors.storageIo` | Toast |
| `LLM_PROVIDER_ERROR` | `errors.llmProvider` | Toast |
| `EXPORT_FAILED` | `errors.exportFailed` | 导出页内联 |
| `INTERNAL_ERROR` | `errors.internal` | Toast |

实现：`lib/errors/action-error.ts` 统一构造 `{ code, message }`；`message` 为英文兜底，UI 以 `code` 为准。

---

## 4. 错误码一览

| code | HTTP | 说明 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 未登录 |
| `VALIDATION_ERROR` | 400 | 参数校验失败 |
| `PROJECT_NOT_FOUND` | 404 | 作品不存在或无权 |
| `INVALID_PROJECT_STATE` | 409 | 状态机不允许 |
| `PLANNING_NOT_READY` | 409 | L4 时规划未就绪；应跳转规划轮询页 |
| `PLANNING_JOB_FAILED` | 409 | 规划任务失败；展示重试 |
| `CHAPTER_ORDER_VIOLATION` | 409 | 手动模式跳章 |
| `CHAPTER_NOT_GENERATABLE` | 409 | 目标章非 pending/failed 或非正常当前章 |
| `JOB_NOT_FOUND` | 404 | 任务不存在 |
| `JOB_NOT_RUNNING` | 409 | 任务已结束仍操作 |
| `STORAGE_CONFIG_INVALID` | 500 | R2 配置缺失或无效（缺 `R2_*`） |
| `STORAGE_IO_ERROR` | 502 | R2 读写失败 |
| `STORAGE_OBJECT_NOT_FOUND` | 404 | R2 对象键不存在 |
| `WRITING_PLAN_CORRUPTED` | 500 | 写作计划 JSON 损坏 |
| `RATE_LIMIT_EXCEEDED` | 429 | 超限 |
| `LLM_PROVIDER_ERROR` | 502 | 上游模型失败 |
| `INTERNAL_ERROR` | 500 | 未分类；不返回堆栈 |
| `KNOWLEDGE_DOC_NOT_FOUND` | 404 | 参考文档不存在 |
| `KNOWLEDGE_PARSE_FAILED` | 422 | 文档解析失败 |
| `EXPORT_FAILED` | 500 | 导出生成失败 |
| `LLM_CONFIG_INVALID` | 400 | 模型配置无效 |
| `LLM_TEST_FAILED` | 502 | 连接测试失败 |
| `REGENERATE_NOT_ALLOWED` | 409 | 当前状态不允许重生 |

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
| 副作用 | 插入 `projects`（`status: draft`），分配 R2 对象键前缀 `storage_prefix` |

#### `projects.deleteProject`

| 输入 | `{ projectId }` |
| 成功 | `{ ok: true }` |
| 副作用 | 软删 DB（`deleted_at`）+ `storage_delete_pending=true`；Worker 执行 `deletePrefix` |

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
| 成功 | `{ ok: true, planningJobId: string }` |
| 副作用 | `projects.status → planning`；入队 `planning_jobs`；Worker 完成后 `planning_ready=true` 并写入 00/01/02 |

#### `planning.confirmPlan`（L4）

| 输入 | 见下表 |
| 成功 | `{ ok: true, redirect: '/projects/{id}/write' }` |

```typescript
type ConfirmPlanInput = {
  projectId: string;
  writingMode: 'serial' | 'parallel';
  creationPace: 'auto' | 'manual';
  knowledgeDocumentIds?: string[]; // L4 可选绑定参考
};
```

| 规则 | |
|------|--|
| `creationPace === 'manual'` | 强制 `writingMode: serial` |
| `writingMode === 'parallel'` | 要求 `creationPace === 'auto'` |

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

#### `writing.startValidation`

| 输入 | `{ projectId }` |
| 触发 | 全章 `completed` 后自动或用户手动触发 |
| 副作用 | `projects.status → validating`；Worker 执行 Phase 4 |

---

### 5.6 偏好 `preferences`

#### `preferences.update`

| 输入 | `{ preferences: Partial<UserPreferences> }` |

#### `preferences.reset`

| 输入 | 无 |

---

### 5.7 编辑 `editor`

#### `editor.saveChapter`

| 输入 | `{ projectId, chapterNumber, content: string, confirmWordCountWarning?: boolean }` |
| 成功 | `{ ok: true, wordCount, wordCountPass }` |
| 规则 | 字数越界 → 返回警告；用户 `confirmWordCountWarning=true` 后写回 MD 并设 `wordCountPass: false` |

#### `editor.runConsistencyCheck`

| 输入 | `{ projectId, scope: 'book' | 'chapter', chapterNumber?: number }` |
| 成功 | `{ issues: ConsistencyIssue[] }` |

#### `editor.polishChapter` / `editor.polishSelection`

| 输入 | `{ projectId, chapterNumber, selection?: { start, end } }` |
| 成功 | `{ diff: string, polishedContent: string }`（不落盘，待用户确认） |

#### `editor.acceptPolish`

| 输入 | `{ projectId, chapterNumber, content: string, confirmWordCountWarning?: boolean }` |
| 副作用 | 同 `saveChapter` |

---

### 5.8 导出 `export`

#### `export.createExport`

| 输入 | `{ projectId, format: 'md' | 'txt' | 'pdf' | 'epub', metadata: ExportMetadata }` |
| 成功 | `{ exportId, downloadUrl }` |
| 副作用 | 生成文件至 StorageDriver；写入 `export_records` |

#### `export.listExports`

| 输入 | `{ projectId }` |
| 成功 | `{ exports: ExportRecord[] }` |

---

### 5.9 自定义模型 `llm`

#### `llm.saveConfig`

| 输入 | `{ name?, baseUrl, apiKey, modelName, isDefault?: boolean }` |
| 成功 | `{ configId }` |

#### `llm.testConfig`

| 输入 | `{ configId? }` 或内联配置 |
| 成功 | `{ ok: true }` / 失败 `LLM_TEST_FAILED` |

#### `llm.deleteConfig` / `llm.setDefault`

| 说明 | 管理 `user_llm_configs` |

#### `llm.setProjectOverride`

| 输入 | `{ projectId, configId: string | null }` |

---

### 5.10 知识库 `knowledge`

#### `knowledge.uploadDocument`

| 输入 | FormData：`file` + 可选 `title` |
| 成功 | `{ documentId, status: 'processing' }` |

#### `knowledge.addUrl`

| 输入 | `{ url: string }` |
| 成功 | `{ documentId, previewText }`（待用户确认入库） |

#### `knowledge.confirmUrl` / `knowledge.deleteDocument`

| 说明 | 确认抓取文本入库 / 删除文档及 chunks |

#### `knowledge.bindToProject` / `knowledge.unbindFromProject`

| 输入 | `{ projectId, documentIds: string[] }` |
| 规则 | 规划确认前绑定影响 Phase 2+；创作中新增仅影响未开始章节 |

---

### 5.11 章节重生 `regenerate`

#### `regenerate.chapterOutline`

| 输入 | `{ projectId, chapterNumber, instruction?: string }` |
| 成功 | `{ preview: OutlineRowDiff }`（待确认） |

#### `regenerate.confirmOutline`

| 输入 | `{ projectId, chapterNumber, outlineRow }` |
| 副作用 | 写回 `01-大纲.md`；若已有正文提示过时 |

#### `regenerate.chapterContent`

| 输入 | `{ projectId, chapterNumber, instruction?: string, confirmOverwrite?: boolean }` |
| 规则 | 已有正文须 `confirmOverwrite=true`；执行 REQ-010 单章子流程 |

---

## 6. REST Route Handlers

### 6.1 健康检查

#### `GET /api/health`

| 响应 200 | `{ "status": "ok" }` |
| 鉴权 | 无 |

---

### 6.2 规划任务进度

#### `GET /api/projects/[projectId]/planning-jobs/[jobId]`

| 项 | 内容 |
|----|------|
| 鉴权 | 必须登录；归属校验 |
| 用途 | Phase 2 生成中 UI 轮询 |

**响应 200：**

```json
{
  "job": {
    "id": "uuid",
    "status": "pending | running | completed | failed | cancelled",
    "startedAt": "2026-05-20T10:00:00.000Z",
    "completedAt": null,
    "lastError": null
  },
  "planningReady": false
}
```

| 行为 | 说明 |
|------|------|
| `planningReady: false` 且 `job.status` ∈ `pending`/`running` | 停留 `/projects/{id}/planning` 轮询 |
| `planningReady: true` | 自动跳转 `/projects/{id}/plan`（L4） |
| `job.status === 'failed'` | 展示 `lastError`（英文）+ 重试 `planning.startPlanning` |

---

### 6.3 创作任务进度（自动模式轮询）

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

### 6.4 章节正文（按需加载）

> 默认阅读器通过 RSC 直读 `R2StorageDriver`；客户端按需加载时使用：

#### `GET /api/projects/[projectId]/chapters/[chapterNumber]/content`

| 查询 | `?format=markdown`（默认） |
| 响应 200 | `{ "chapterNumber", "title", "filePath", "content": "..." }` — `filePath` 为 R2 对象键；`content` 来自 R2 `readText` |
| 限制 | 仅作品所有者；**不**用于列表批量拉取 |

---

### 6.5 导出文件下载

#### `GET /api/projects/[projectId]/exports/[exportId]/download`

| 响应 | 文件流 + `Content-Disposition: attachment` |
| 鉴权 | 作品所有者 |

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
  progressLabel?: string; // 写作："12/20 章"；校验："校验中 8/20 章"
  resumeLabel: string;    // 卡片 CTA：继续向导 / 规划生成中 / 继续确认规划 / 续写 / 继续校验
  resumeHref: string;
};
```

| status | 条件 | `resumeHref` | `resumeLabel` | `progressLabel` |
|--------|------|--------------|---------------|-----------------|
| `draft` | — | `/projects/{id}/wizard` | 继续向导 | — |
| `planning` | `planningReady=false` | `/projects/{id}/planning` | 规划生成中 | 可选 Job 百分比 |
| `planning` | `planningReady=true` | `/projects/{id}/plan` | 继续确认规划 | — |
| `writing` | — | `/projects/{id}/write` | 续写 | `{completed}/{total} 章` |
| `validating` | — | `/projects/{id}/write` | 继续校验 | `校验中 {done}/{total} 章` |
| `completed` | — | `/projects/{id}/complete` | 查看作品 | 总章数/总字数摘要 |

`resumeHref` 由 `getResumeHref(project)` 集中生成（见 design.md §7.1）。

---

### 7.1.1 校验进度 `getValidationProgress(projectId)`（RSC）

| 返回 | `totalChapters`、`checkedChapters`、`failedChapters`、`chapters[]`（章号、字数、`wordCountPass`） |
| 用途 | `status=validating` 时 `WriteProgress` 校验模式；**不**暴露 Phase 3「生成本章」 |
| 数据源 | `02-写作计划.json` + 各章 `.md` 字数统计 |

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

## 8. 状态与 Action 可用矩阵

| projects.status | 允许的主要 Action |
|-----------------|-------------------|
| `draft` | `wizard.*`, `quickStart.*`, `planning.startPlanning`, `knowledge.bindToProject` |
| `planning` | `planning.startPlanning`（重试）；`planning.confirmPlan`（仅 `planningReady`）；禁止 L4 当 `planningReady=false` |
| `writing` | `writing.*`, `regenerate.*`, `knowledge.bindToProject`（增删规则见 REQ-015） |
| `validating` | 只读进度 RSC；禁止 `writing.generateChapter`；校验失败时 Worker 内部重写 |
| `completed` | 阅读 RSC；`editor.*`；`export.*`；`regenerate.*`；默认入口 `/complete` |

---

## 9. Webhook / 外部

无对外 Webhook。LLM 与网址抓取均为服务端出站 HTTP。

---

## 10. 实现检查清单

| # | 项 |
|---|-----|
| 1 | 所有 Action 入口 `requireUser()` |
| 2 | `projectId` 路径均校验 `user_id` |
| 3 | 错误 `message` 英文，无 stack leak |
| 4 | `/api/*` 与 Server Actions 全局限流 100/h/IP；UI Toast（REQ-018-AC-006） |
| 5 | Job 轮询响应不含章节全文 |
| 6 | `confirmPlan` 仅在 `planning` + `planning_ready` 可调用 |
| 7 | `getProjectsForDashboard` 的 `resumeHref` 符合 §7.1 表 |
| 8 | `validating` 项目列表/首页不得出现「生成本章」类 CTA |
| 9 | `planning` 未完成时访问 `/plan` 返回 409 或重定向 `/planning` |
| 10 | `completed` 默认跳转 `/projects/{id}/complete` |
| 8 | `confirmPlan` 支持 `parallel` 且校验 manual→serial |
| 9 | 知识库上传/绑定/解析失败返回英文 message |
| 11 | `deletePrefix` 删除 R2 前缀下全部对象 |
| 12 | 导出下载从 R2 `readBytes(storage_key)` 流式输出 |

---

## 11. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-05-20 | 初稿定稿；对齐 D4=C、data.md v1.0.0 |
| 1.1.0 | 2026-05-23 | 全量 Action/API |
| 1.2.0 | 2026-05-23 | 存储相关错误码；R2 与 local 契约一致 |
| 1.3.0 | 2026-05-23 | **R2 唯一存储**；API 返回 R2 对象键路径 |
| 1.4.0 | 2026-05-23 | UI/访问 P0：`resumeHref` 全状态表、`PLANNING_JOB_FAILED`、`errors.*` 映射、校验进度 RSC、限流 UI |

---

*实现顺序建议：Auth → `projects.createProject` → 向导 Actions → `planning.*` → Job 轮询 API → Worker → 完成页/校验模式 UI。*
