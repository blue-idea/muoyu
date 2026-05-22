# 实施计划

执行时需严格遵循 `docs/spec/requirements.md` 中对应需求的验收标准。技术细节以 `docs/spec/design.md`、`docs/spec/data.md`、`docs/spec/api.md` 为准。每项任务通过 `_需求:` 引用需求编号。

**一期 MVP 范围（澄清 Q3-A）：** REQ-001~011 + REQ-012 阅读 + 快捷开写；含 Phase 4 校验；`writingMode` 一期仅 `serial`。

**已纳入的实施澄清（写入任务，批准 spec 修订时同步文档）：**


| 编号 | 决议                                                                     |
| ---- | ------------------------------------------------------------------------ |
| Q1   | `storage_prefix`；路径 `{userId}/{projectId}-{slug}/`                    |
| Q2   | `writingMode` kebab-case：`serial` / `subagent-parallel` / `agent-teams` |
| Q3   | 一期含快捷开写 + Phase 4 + 阅读                                          |
| Q4   | Phase 2 异步`planning_jobs` + Worker + 轮询 API                          |
| Q5   | 偏好 PostgreSQL 为主 + 双写`user-preferences.json`                       |
| Q6   | 删作品：先软删 DB → 再删存储 →`storage_delete_pending` 补偿            |

---

## 阶段 0：工程与规范基线

- [X]  **TASK-000. 工程脚本与质量门禁**（完成于 2026-05-20，PR #1 合并）

  - [X]  在 `package.json` 增加脚本：`worker`、`test`（vitest）、`test:e2e`（playwright）、`db:generate`、`db:migrate`、`typecheck`（`tsc --noEmit`）
  - [X]  配置 Vitest（`vitest.config.ts`）、Playwright（`playwright.config.ts`）
  - [X]  确认 Husky + lint-staged 对 `*.{ts,tsx}` 运行 eslint + tsc
  - [X]  验证：`pnpm typecheck` 零错误；`pnpm lint` 零 error
  - [X]  验收证据：终端输出截图或 CI 日志

  - _需求：REQ-018。验收标准：REQ-018-AC-004（工程基线，为后续 API 错误与限流铺路）。_
- [ ]  **TASK-000b. GitHub Actions CI/CD 与安全审计**（完成于 2026-05-20，PR #2 合并）

  - [ ]  **质量流水线** `.github/workflows/ci.yml`
  - [ ]  **安全审计流水线** `.github/workflows/security-audit.yml`
  - [ ]  **ESLint 安全规则**（`eslint-plugin-security`、`eslint-plugin-no-secrets`）
  - [ ]  **仓库与密钥**（`.gitignore` 已忽略 `.env*`，`!.env.example`）

  - _需求：REQ-018；AGENTS.md 质量基线（Git Hooks + GitHub Actions 代码审计）。验收标准：REQ-018-AC-004；DoD：tsc/eslint/build/测试可 CI 复现。_
- [ ]  **TASK-001. 集中配置与环境变量**（完成于 2026-05-20，PR #3 合并）

  - [ ]  实现 `config/app.ts`（`defaultLocale: zh`、`locales`）
  - [ ]  实现 `config/novel.ts`（`MIN_WORDS`、`MAX_WORDS`、`MAX_RETRY`、`QUICK_START_MIN_CHARS`）
  - [ ]  实现 `config/paths.ts`（`00-人物档案.md` 等常量）
  - [ ]  实现 `config/storage.ts`（`STORAGE_DRIVER`、`getStorageDriver()`）
  - [ ]  提供 `.env.example`（`DATABASE_URL`、`AUTH_*`、`WORKSPACE_ROOT`、`RATE_LIMIT_*` 等，无真实密钥）
  - [X]  验证：`rg "process\.env" config/ lib/` 无硬编码密钥；`pnpm typecheck` 通过

  - _需求：REQ-007、REQ-018、REQ-014（预留）。验收标准：REQ-018-AC-004。_

---

## 阶段 1：数据层与存储

- [ ]  **TASK-002. Drizzle Schema 与迁移（一期表）**

  - [ ]  实现 `drizzle/schema/enums.ts`（`project_status`、`content_file_type`、`job_status`、`creation_pace`、`writing_mode` 等）
  - [ ]  实现 Auth 表：`users`、`accounts`、`sessions`、`verification_tokens`（对齐 Auth.js Drizzle Adapter）
  - [ ]  实现 `user_preferences`、`projects`（含 `storage_prefix`、`deleted_at`、`storage_delete_pending`、`planning_ready`）
  - [ ]  实现 `content_files`、`generation_jobs`、**`planning_jobs`**
  - [ ]  生成并执行迁移：`pnpm db:migrate`
  - [ ]  验证：`rg "storage_prefix" drizzle/` 有列定义；`tree drizzle/schema` 含上述文件；PostgreSQL 客户端表结构与 `data.md` §5 一致
  - [ ]  验收证据：`drizzle-kit` 迁移成功日志 + `\dt` 或 `SELECT tablename FROM pg_tables WHERE schemaname = 'public';` 结果

  - _需求：REQ-002、REQ-007、REQ-017、REQ-008、REQ-010。验收标准：REQ-002-AC-003、REQ-007-AC-001、REQ-017-AC-001~004。_
- [X]  **TASK-003. StorageDriver（local 一期）**

  - [ ]  实现 `lib/storage/types.ts`（`StorageDriver` 接口）
  - [ ]  实现 `lib/storage/local-storage-driver.ts`（键 = `{storage_prefix}{relativePath}`）
  - [ ]  实现路径规范化，禁止 `..` 路径穿越
  - [ ]  预留 `lib/storage/r2-storage-driver.ts` 空壳或 `throw new Error('Not implemented')` + 工厂分支
  - [ ]  单元测试：读写、`deletePrefix`、`exists`
  - [ ]  验证：`pnpm vitest run tests/unit/storage`；`rg "class LocalStorageDriver" lib/storage/`

  - _需求：REQ-007。验收标准：REQ-007-AC-001、REQ-007-AC-002、REQ-007-AC-003。_
- [X]  **TASK-004. 领域基础：归属校验与状态机**

  - [ ]  实现 `lib/db/index.ts`（Drizzle client）
  - [ ]  实现 `lib/novel/require-user.ts`、`get-project-for-user.ts`（跨用户返回 null → 404）
  - [ ]  实现 `lib/novel/project-state-machine.ts`（五态转换）
  - [ ]  单元测试：非法状态转换拒绝；越权访问拒绝
  - [ ]  验证：`pnpm vitest run tests/unit/project-state-machine`；`rg "assertTransition" lib/novel/`

  - _需求：REQ-017、REQ-002、REQ-018。验收标准：REQ-017-AC-001~002、REQ-002-AC-004、REQ-018-AC-005。_

---

## 阶段 2：认证与会话

- [ ]  **TASK-005. NextAuth（Credentials + GitHub + Google）**

  - [ ]  实现 `lib/auth/auth.ts`（Database Session、Drizzle Adapter）
  - [ ]  实现 Credentials：`password_hash` bcrypt；注册流程写 `users`
  - [ ]  配置 GitHub、Google Provider（环境变量）
  - [ ]  实现 `app/api/auth/[...nextauth]/route.ts`
  - [ ]  实现 `app/[locale]/(auth)/login`、`register` 页面（shadcn）
  - [ ]  验证：`pnpm build` 通过；手动/E2E：OAuth 回调与邮箱登录均可建立 session

  - _需求：REQ-001、REQ-018。验收标准：REQ-001-AC-004、REQ-018-AC-005。_
- [ ]  **TASK-006. 中间件：Auth + i18n + 限流**

  - [ ]  实现 `middleware.ts`：未登录访问 `(app)` 与创作 API → 跳转登录（`callbackUrl`）
  - [ ]  集成 `next-intl`（默认 `zh`，错误文案走 `messages/en.json` 的 `errors.*`）
  - [ ]  实现 `/api/*` IP 限流 100/h（`RATE_LIMIT_*`）；Server Actions 限流策略在 TASK-006b 前默认与 api 草案一致时可先仅 API
  - [ ]  验证：`rg "auth\(" middleware.ts`；超限返回 429 + 英文 body；`pnpm build`

  - _需求：REQ-018、REQ-002。验收标准：REQ-018-AC-004、REQ-002-AC-006、REQ-003-AC-010。_

---

## 阶段 3：偏好与作品工作台

- [ ]  **TASK-007. 用户偏好（DB + 双写 JSON）**

  - [ ]  实现 `lib/novel/preference-service.ts`（读/写 `user_preferences`）
  - [ ]  L1/L2 提交时静默合并偏好（结构对齐 `tpl/user-preferences.example.json`）
  - [ ]  双写：更新 DB 后同步 `user-preferences.json`（路径在 `config/` 或用户主目录，实现时固定一处并写进 `config/app.ts`）
  - [ ]  实现 `preferences.update`、`preferences.reset` Server Actions
  - [ ]  设置页 UI（查看/重置）
  - [ ]  验证：`pnpm vitest run tests/unit/preference-service`；文件与 DB 内容一致（双写后 `diff` 或校验脚本）

  - _需求：REQ-001。验收标准：REQ-001-AC-001、REQ-001-AC-002、REQ-001-AC-003。_
- [ ]  **TASK-008. 作品 CRUD 与仪表盘**

  - [ ]  实现 `projects.createProject`、`projects.deleteProject` Actions（删除走 Q6-A 软删流程）
  - [ ]  实现 `getProjectsForDashboard()` RSC 数据函数（五态、`planning_ready`、续写/继续规划入口）
  - [ ]  实现 `app/[locale]/(app)/dashboard` 作品列表
  - [ ]  实现 `getProjectDetail()`：返回 `storagePrefix`、`files` 元数据，**不含**章节全文
  - [ ]  验证：`rg "storage_prefix" lib/ drizzle/`；`pnpm vitest run tests/unit/project-service`；列表不返回 `content` 字段（`rg "content:" app/ -g "*dashboard*"` 无正文泄漏）

  - _需求：REQ-002。验收标准：REQ-002-AC-001~006。_

---

## 阶段 4：向导与快捷开写

- [ ]  **TASK-009. Phase 1 向导 L1–L3**

  - [ ]  实现 `stores/wizardStore.ts`（Zustand，仅 UI 草稿）
  - [ ]  实现 `wizard.saveLayer1`、`saveLayer2`、`saveLayer3` Actions；写入 `projects.creation_config`
  - [ ]  实现 `app/.../projects/[projectId]/wizard` 分步 UI（一屏一事；可返回上一步）
  - [ ]  L3 标题生成（LLM，模版 `tpl/guides/title-guide.md`）；更新 `title`、`slug`
  - [ ]  验证：E2E 完成 L1→L3 后 DB 有 `creation_config`；`pnpm vitest run tests/unit/wizard`

  - _需求：REQ-004、REQ-005、REQ-006。验收标准：REQ-004-AC-001~004、REQ-005-AC-001~003、REQ-006-AC-001~003。_
- [X]  **TASK-010. Phase 0 快捷开写**

  - [ ]  首页 L0：新建、续写、快捷输入（已登录）
  - [ ]  实现 `quickStart.extract`、`quickStart.choosePath` Actions
  - [ ]  提取结果页：显式「进入完整向导」「跳过至规划」；全空仅向导（REQ-003-AC-007）
  - [ ]  跳规划前校验 `novelName`/L3 标题（REQ-003-AC-006）
  - [ ]  验证：E2E `tests/e2e/quick-start.spec.ts` 覆盖二选一与失败路径；`rg "canSkipToPlanning" app/`

  - _需求：REQ-003。验收标准：REQ-003-AC-001~010。_

---

## 阶段 5：Phase 2 规划（异步）

- [X]  **TASK-011. 规划任务入队与 Worker**

  - [ ]  实现 `lib/novel/planning-service.ts`：入队 `planning_jobs`，`projects.status → planning`
  - [ ]  实现 `planning.startPlanning` Action（返回 `planningJobId`）
  - [ ]  Worker：`scripts/worker.ts` 消费 `planning_jobs` + `generation_jobs`（`pnpm worker`）
  - [ ]  规划流水线：生成 `00-人物档案.md`、`01-大纲.md`、`02-写作计划.json`（`writingMode` 先 `serial`；章 `pending`）
  - [ ]  完成后 `projects.planning_ready = true`；`content_files` 索引三文件
  - [ ]  验证：`rg "planning_jobs" drizzle/ lib/`；Worker 日志显示规划完成；磁盘存在三文件且 JSON 可解析

  - _需求：REQ-008、REQ-007。验收标准：REQ-008-AC-001~006、REQ-007-AC-001。_
- [ ]  **TASK-012. 规划进度轮询 API**

  - [ ]  实现 `GET /api/projects/[projectId]/planning-jobs/[jobId]`（契约写入 `api.md` 修订）
  - [ ]  L4 前规划生成中 UI：轮询 + 加载态；`planning` 态展示「继续确认规划」
  - [ ]  验证：`pnpm vitest run tests/integration/planning-job-api`；未登录 401；他人 project 404

  - _需求：REQ-008、REQ-002。验收标准：REQ-008-AC-004、REQ-002-AC-005。_
- [X]  **TASK-013. L4 规划确认与模式选择**

  - [ ]  实现 `app/.../plan` 规划预览（前 5 章摘要 + 折叠全文）
  - [ ]  实现 `planning.confirmPlan`：`writingMode: serial`、`creationPace: auto|manual`；`planning → writing`
  - [ ]  更新 `02-写作计划.json`：`creationPace`、`writingMode`、根 `status: in_progress`
  - [ ]  `creationPace=auto` 时创建 `generation_jobs`（`pending`）
  - [ ]  验证：E2E 确认前无法进入写作（REQ-008-AC-006）；确认后 status=writing

  - _需求：REQ-009、REQ-008、REQ-017。验收标准：REQ-009-AC-001~006、REQ-008-AC-006、REQ-017-AC-002。_

---

## 阶段 6：Phase 3 创作（自动 + 手动）

- [X]  **TASK-014. 单章创作子流程（领域核心）**

  - [ ]  实现 `lib/novel/chapter-writer.ts`（写前分析→撰写→润色→字数检查→摘要→更新 JSON）
  - [ ]  集成 `config/novel.ts` 字数 3000–5000、`MAX_RETRY=3`
  - [ ]  更新 `content_files` 与 `02-写作计划.json`（`wordCount`、`wordCountPass`）
  - [ ]  单元测试：mock LLM + 临时目录；字数不达标重试逻辑
  - [ ]  验证：`pnpm vitest run tests/unit/chapter-writer`；`rg "wordCountPass" lib/`

  - _需求：REQ-010、REQ-007。验收标准：REQ-010-AC-001~006、REQ-007-AC-001~003。_
- [X]  **TASK-015. 自动创作 Worker 与进度 API**

  - [ ]  Worker 循环：`creationPace=auto` 项目消费 `generation_jobs`，串行逐章
  - [ ]  章间互斥：`locked_at` / 项目级锁；断点续写 `current_chapter_number`
  - [ ]  实现 `GET /api/projects/[projectId]/generation-jobs/[jobId]`（`api.md` §6.2）
  - [ ]  实现 `stores/writeProgressStore.ts` + 轮询
  - [ ]  实现 `app/.../write` 自动模式进度 UI
  - [ ]  验证：`pnpm worker` + 测试项目自动连写；E2E 离开页面后续写（REQ-010-AC-008）；`rg "generation-jobs" app/api`

  - _需求：REQ-010、REQ-018。验收标准：REQ-010-AC-007~009、REQ-018-AC-001。_
- [ ]  **TASK-016. 手动创作模式**

  - [ ]  实现 `writing.generateChapter` Action；校验 `creationPace=manual` 与当前最小序号章
  - [ ]  非当前章返回 `CHAPTER_ORDER_VIOLATION`（`ok: false`）
  - [ ]  UI：章节列表仅当前章可点「生成本章」；完成后预览，不自动下一章
  - [ ]  验证：E2E 手动模式跳章被拒绝；连续两章手动生成成功

  - _需求：REQ-010、REQ-009。验收标准：REQ-010-AC-010~013、REQ-009-AC-006。_

---

## 阶段 7：Phase 4 校验与阅读

- [ ]  **TASK-017. Phase 4 全书校验**

  - [ ]  全章 `completed` 时 `projects.status → validating`
  - [ ]  实现 `lib/novel/validation-service.ts`：批量字数检查；不合格→`failed` 并触发重写（≤3 次）
  - [ ]  通过后 `status → completed`；完成报告 UI（总章数、总字数、⚠️ 失败章）
  - [ ]  验证：`pnpm vitest run tests/unit/validation-service`；E2E 校验失败章回写作

  - _需求：REQ-011、REQ-017。验收标准：REQ-011-AC-001~004、REQ-017-AC-002。_
- [ ]  **TASK-018. 在线阅读器**

  - [ ]  实现 `app/.../read`：章节目录 + 从 MD 加载正文（章首引子样式区分）
  - [ ]  RSC 读 `StorageDriver`；可选 `GET .../chapters/[n]/content` 仅用于客户端按需加载
  - [ ]  完成页：统计 + 阅读入口（导出入口三期）
  - [ ]  验证：E2E 完稿作品可阅读全章；响应无 DB 正文列（通过 schema 审查确认无章节正文列）

  - _需求：REQ-012。验收标准：REQ-012-AC-001~002。_

---

## 阶段 8：LLM 与安全横切（一期最小）

- [ ]  **TASK-019. LLM 路由（平台默认）**

  - [ ]  实现 `lib/ai/llm-router.ts`（用户配置未启用时走 `PLATFORM_LLM_*`）
  - [ ]  规划/创作/标题提取调用统一入口；错误映射英文 `message`
  - [ ]  验证：`pnpm vitest run tests/unit/llm-router`（mock fetch）；日志无 API Key

  - _需求：REQ-014（一期仅平台默认）、REQ-010。验收标准：REQ-014-AC-004、REQ-010-AC-005。_
- [ ]  **TASK-020. 存储删除补偿 Job**

  - [ ]  实现 `storage_delete_pending` 扫描与 `deletePrefix` 重试
  - [ ]  Worker 或 cron 片段合并进 `scripts/worker.ts`
  - [ ]  验证：单测模拟 DB 已删、存储失败 → 重试成功

  - _需求：REQ-002、REQ-007。验收标准：REQ-002-AC-003（删除一致性）。_

---

## 阶段 9：测试与交付验收

- [ ]  **TASK-021. 单元与集成测试套件**

  - [ ]  覆盖：状态机、手动序章校验、写作计划 JSON 解析、`StorageDriver`
  - [ ]  验证：`pnpm vitest run` 通过率 100%

  - _需求：REQ-017、REQ-010、REQ-007。_
- [ ]  **TASK-022. E2E 核心旅程（Playwright）**

  - [ ]  场景 1：注册/登录 → 完整向导 → 规划确认 → 自动创作 → 校验 → 阅读
  - [ ]  场景 2：快捷开写 → 跳过至规划（有标题）
  - [ ]  场景 3：手动模式按章创作
  - [ ]  场景 4：未登录访问 dashboard → 跳转登录
  - [ ]  验证：`pnpm test:e2e` 通过（Chromium）

  - _需求：REQ-001~012 主路径。_
- [ ]  **TASK-023. 构建与类型检查（DoD）**

  - [ ]  `npx tsc --noEmit` 零错误
  - [ ]  `pnpm lint` 零 error
  - [ ]  `pnpm build` 成功
  - [ ]  验证：三条命令本地/CI 输出

  - _需求：REQ-018；项目 AGENTS.md DoD。_

---

## 阶段 10：文档与 spec 修订（依赖澄清批准确认）

- [ ]  **TASK-024. 同步 spec 文档（需用户批准后再改）**

  - [ ]  按 Q1~Q6 修订 `requirements.md`（`workspacePath`→`storage_prefix`、附录 C 与 design gantt 对齐）
  - [ ]  修订 `data.md`：`planning_jobs` 表、§6.2 `planStatus` 笔误、`storage_delete_pending`
  - [ ]  修订 `api.md`：`planning-jobs` 轮询、删除与限流/Actions 最终约定（若 Q7 未答，先标 TBD）
  - [ ]  验证：`rg "workspacePath" docs/spec/` 无残留（或仅「已废弃」说明）；`rg "planning_jobs" docs/spec/data.md`

  - _需求：全量一致性，非功能需求。_

---

## 二期及以后（ backlog，一期不验收）


| 任务概要                            | 需求      |
| ----------------------------------- | --------- |
| 导出 MD/TXT/PDF/EPUB                | REQ-012   |
| M8 编辑、润色、一致性检查           | REQ-013   |
| 用户自定义 LLM 配置 UI              | REQ-014   |
| 知识库 RAG                          | REQ-015   |
| 章节重生                            | REQ-016   |
| `subagent-parallel` / `agent-teams` | REQ-009   |
| R2 StorageDriver                    | design D3 |

---

## 修订记录


| 版本  | 日期       | 说明                                                                      |
| ----- | ---------- | ------------------------------------------------------------------------- |
| 1.0.0 | 2026-05-20 | 初稿；含澄清 Q1~Q6；一期 MVP Q3-A                                         |
| 1.0.1 | 2026-05-20 | 阶段 0 增加 TASK-000b（GitHub Actions，参照 knowledge/github_actions.md） |
