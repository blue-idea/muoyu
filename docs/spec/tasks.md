# 实施计划

执行时需严格遵循 `docs/spec/requirements.md`（v1.4.0）中对应需求的验收标准。技术细节以 `docs/spec/design.md`（v1.4.0）、`docs/spec/data.md`、`docs/spec/api.md`（v1.4.0）为准。每项任务通过 `_需求:` 引用需求编号。

**交付策略：** 项目**不分期裁剪**，REQ-001 ~ REQ-018 均为当前版本验收范围。下列任务按依赖顺序排列，可并行处标注。

**已纳入的实施澄清：**

| 编号 | 决议 |
| ---- | ---- |
| Q1 | `storage_prefix`（R2 对象键前缀）；`{userId}/{projectId}-{slug}/` |
| Q2 | `writingMode`：`serial` / `parallel`（JSON 与 DB 枚举 snake_case） |
| Q3 | 全量功能一次交付，含快捷开写、Phase 4、阅读、导出、知识库、章节重生 |
| Q4 | Phase 2 异步 `planning_jobs` + Worker + 轮询 API |
| Q5 | 偏好 PostgreSQL 为主；可选双写 R2 `{userId}/preferences/user-preferences.json` |
| Q6 | 删作品：先软删 DB → 再删 R2 对象 → `storage_delete_pending` 补偿 |
| Q7 | **R2 唯一存储**；所有 MD/JSON 正文在 R2；库仅存 R2 对象键 |

---

## 阶段 0：工程与规范基线

- [x] **TASK-000. 工程脚本与质量门禁**（完成于 2026-05-20）

  - [x] `package.json` 脚本：`worker`、`test`、`test:e2e`、`db:generate`、`db:migrate`、`typecheck`
  - [x] Vitest、Playwright、Husky + lint-staged
  - _需求：REQ-018_

- [x] **TASK-000b. GitHub Actions CI/CD 与安全审计**（完成于 2026-05-20）

  - [x] `.github/workflows/ci.yml`、`.github/workflows/security-audit.yml`
  - _需求：REQ-018；AGENTS.md 质量基线_

- [x] **TASK-001. 集中配置与环境变量**（完成于 2026-05-20）

  - [x] `config/app.ts`、`config/novel.ts`、`config/paths.ts`、`config/storage.ts`、`config/env.ts`
  - [x] `.env.example`
  - _需求：REQ-007、REQ-018、REQ-014_

---

## 阶段 1：数据层与存储

- [x] **TASK-002. Drizzle Schema 与迁移（全量表）**

  - [x] `drizzle/schema/enums.ts`（`project_status`、`content_file_type`、`job_status`、`creation_pace`、`writing_mode` 等）
  - [x] Auth 四表（Auth.js Drizzle Adapter）
  - [x] `user_preferences`、`projects`（含 `storage_prefix`、`deleted_at`、`storage_delete_pending`、`planning_ready`）
  - [x] `content_files`、`planning_jobs`、`generation_jobs`
  - [x] `user_llm_configs`、`knowledge_*`、`export_records`
  - [x] `pnpm db:migrate` 成功
  - _需求：REQ-002、REQ-007、REQ-017、REQ-008、REQ-010、REQ-014、REQ-015、REQ-012_

- [x] **TASK-003. R2StorageDriver（唯一对象存储）**

  - [x] `lib/storage/types.ts`：`readText`/`writeText`/`readBytes`/`writeBytes`/`exists`/`list`/`deletePrefix`
  - [x] `lib/storage/r2-storage-driver.ts`：`@aws-sdk/client-s3`；Put/Get/Head/List/DeleteObjects；分页 `deletePrefix`
  - [x] `lib/storage/index.ts` → `createStorageDriver()` **仅**返回 `R2StorageDriver`；`config/storage.ts` 校验全部 `R2_*` 必填 env
  - [x] 单元测试：mock S3Client（含 `deletePrefix` 批量删除）；**不**实现本地文件系统驱动
  - [x] 集成测试（可选）：对 dev R2 Bucket 冒烟读写（`.env.test`，CI 可 skip）
  - _需求：REQ-007（AC-005、AC-006）_

- [x] **TASK-004. 领域基础：归属校验与状态机**

  - [x] `lib/db/index.ts`、`require-user.ts`、`get-project-for-user.ts`
  - [x] `project-state-machine.ts` 五态转换
  - [x] 单元测试：非法转换、越权
  - _需求：REQ-017、REQ-002、REQ-018_

---

## 阶段 2：认证与会话

- [x] **TASK-005. NextAuth（Credentials + GitHub + Google）**（完成于 2026-05-23，PR #1 已合并）

  - [x] `lib/auth/auth.ts`、Drizzle Adapter、Database Session
  - [x] 注册/登录页、`app/api/auth/[...nextauth]/route.ts`
  - _需求：REQ-001、REQ-018_

- [x] **TASK-006. 中间件：Auth + i18n + 限流**（完成于 2026-05-23，PR #2 已合并）

  - [x] `middleware.ts`：未登录跳转 + `callbackUrl`
  - [x] next-intl（默认 `zh`，错误 `errors.*` 英文）
  - [x] `/api/*` IP 限流 100/h；Server Actions 共享限流
  - [x] 限流/401 等 `errorKey` 在页面以 Toast 或 Banner 展示（REQ-018-AC-006）
  - _需求：REQ-018、REQ-002、REQ-003_

---

## 阶段 3：偏好与作品工作台

- [x] **TASK-007. 用户偏好（DB + 双写 JSON）**（完成于 2026-05-23，PR #3 已合并）

  - [x] `preference-service.ts`；L1/L2 静默合并
  - [x] 双写 `user-preferences.json`
  - [x] `preferences.update`、`preferences.reset` + 设置页
  - [x] `app/[locale]/(app)/settings` 统一导航：偏好 + AI 模型子页（REQ-001-AC-005）
  - _需求：REQ-001_

- [x] **TASK-008. 作品 CRUD 与仪表盘**（完成于 2026-05-23，PR #4 已合并）

  - [x] `projects.createProject`、`projects.deleteProject`（Q6 软删流程）
  - [x] `getProjectsForDashboard()`：五态入口映射（`draft`→向导、`planning` 生成中/待确认、`writing`/`validating`→进度、`completed`→完成页）
  - [x] `getProjectDetail()`：元数据不含正文
  - [x] `app/[locale]/(app)/dashboard`：列表卡片按状态跳转正确路由
  - _需求：REQ-002、REQ-017_

---

## 阶段 4：向导与快捷开写

- [x] **TASK-009. Phase 1 向导 L1–L3**（完成于 2026-05-23，PR #5 已合并）

  - [x] `wizardStore.ts`、`wizard.saveLayer1/2/3`
  - [x] 分步 UI（一屏一事、🎲 随机、L3 LLM 标题）
  - _需求：REQ-004、REQ-005、REQ-006_

- [ ] **TASK-010. Phase 0 快捷开写**

  - [ ] `app/[locale]/(marketing)` 访客营销首页：价值说明 + 登录/注册 CTA（REQ-003-AC-011）
  - [ ] 已登录首页 L0：新建、续写、快捷输入
  - [ ] `quickStart.extract`、`quickStart.choosePath`
  - [ ] 提取结果页二选一；全空仅向导
  - [ ] E2E `tests/e2e/quick-start.spec.ts`；`tests/e2e/marketing-guest.spec.ts`（访客不可见创作控件）
  - _需求：REQ-003_

---

## 阶段 5：Phase 2 规划（异步）

- [ ] **TASK-011. 规划任务与 Worker**

  - [ ] `planning-service.ts` → `planning_jobs`
  - [ ] Worker 消费规划任务：生成 00/01/02 + `content_files` 索引
  - [ ] `planning_ready=true`
  - _需求：REQ-008、REQ-007_

- [ ] **TASK-012. 规划进度轮询 API**

  - [ ] `GET /api/projects/[projectId]/planning-jobs/[jobId]`
  - [ ] `app/.../projects/[projectId]/planning`：规划生成中轮询 UI；失败重试；`planning_ready` 后跳转 L4（REQ-008-AC-007/008）
  - _需求：REQ-008、REQ-002_

- [ ] **TASK-013. L4 规划确认与模式选择**

  - [ ] `app/.../plan` 规划预览页（前 5 章摘要 + 折叠全文 + 知识库勾选）
  - [ ] `planning.confirmPlan`：`serial`/`parallel` + `auto`/`manual`
  - [ ] `creationPace=auto` → 创建 `generation_jobs`
  - _需求：REQ-009、REQ-008、REQ-017、REQ-015_

---

## 阶段 6：Phase 3 创作

- [ ] **TASK-014. 单章创作子流程**

  - [ ] `chapter-writer.ts`（含知识库 RAG 注入点）
  - [ ] 字数 3000–5000、`MAX_RETRY=3`、`wordCountPass`
  - [ ] 单元测试 mock LLM + 临时目录
  - _需求：REQ-010、REQ-007、REQ-015_

- [ ] **TASK-015. 自动创作 Worker 与进度 API**

  - [ ] Worker 消费 `generation_jobs`；串行/并行模式
  - [ ] `GET .../generation-jobs/[jobId]` + `writeProgressStore`
  - [ ] `app/.../write` L5：自动模式进度条 + 并行批次进度（若 `writingMode=parallel`）
  - _需求：REQ-010、REQ-009、REQ-018_

- [ ] **TASK-016. 手动创作模式**

  - [ ] `writing.generateChapter` + 序章校验
  - [ ] UI：仅当前章可「生成本章」
  - [ ] E2E 跳章拒绝
  - _需求：REQ-010、REQ-009_

---

## 阶段 7：Phase 4 校验与阅读

- [ ] **TASK-017. Phase 4 全书校验**

  - [ ] `validation-service.ts`；`validating` ↔ 重写
  - [ ] L5 共用路由：`status=validating` 时展示 Phase 4 校验进度（REQ-011-AC-005）
  - [ ] `app/.../complete` 完成页：统计 + 阅读/编辑/导出入口（REQ-011-AC-006、REQ-012-AC-002）
  - [ ] 完成报告（⚠️ 失败章）
  - _需求：REQ-011、REQ-017、REQ-012_

- [ ] **TASK-018. 在线阅读器**

  - [ ] `app/.../read`：目录 + MD 正文；章首引子样式
  - _需求：REQ-012_

---

## 阶段 8：编辑与润色

- [ ] **TASK-019. 章节编辑器（M8）**

  - [ ] `editor.saveChapter`（警告可保存 + `wordCountPass`）
  - [ ] 侧栏大纲/人物只读参照
  - [ ] `app/.../edit`
  - _需求：REQ-013、REQ-007_

- [ ] **TASK-020. 一致性检查与 AI 润色**

  - [ ] `editor.runConsistencyCheck`（全书/单章）
  - [ ] `editor.polishChapter` / `polishSelection` + diff + `acceptPolish`
  - _需求：REQ-013、REQ-010_

---

## 阶段 9：成书导出

- [ ] **TASK-021. 四格式导出管道**

  - [ ] `export-service.ts`：MD / TXT / PDF / EPUB
  - [ ] `export.createExport`、`export.listExports`
  - [ ] `GET .../exports/[exportId]/download`
  - [ ] 成书导出页（元数据、格式选择、预览）
  - _需求：REQ-012_

---

## 阶段 10：自定义 AI 模型

- [ ] **TASK-022. 用户 LLM 配置**

  - [ ] `llm-router.ts`：用户配置优先，平台默认降级
  - [ ] API Key AES 加密存储
  - [ ] `llm.saveConfig`、`llm.testConfig`、设置页 UI
  - [ ] 作品级 `llm.setProjectOverride`
  - _需求：REQ-014_

---

## 阶段 11：外接知识库

- [ ] **TASK-023. 知识库管理**

  - [ ] 上传 txt/md/docx/doc/pdf/epub；解析状态
  - [ ] 网址抓取 + 预览确认入库
  - [ ] `app/[locale]/(app)/knowledge`
  - _需求：REQ-015_

- [ ] **TASK-024. RAG 注入与作品绑定**

  - [ ] `knowledge.bindToProject` / `unbindFromProject`
  - [ ] Phase 2/3/润色前检索片段；冲突警告（L4）
  - [ ] 可追溯：章节引用来源（UI）
  - _需求：REQ-015、REQ-008、REQ-010_

---

## 阶段 12：指定章节重生

- [ ] **TASK-025. 大纲/正文重生（M11）**

  - [ ] `regenerate.chapterOutline` + diff 确认
  - [ ] `regenerate.chapterContent` + 覆盖确认
  - [ ] 创作进行中暂停队列、完成后恢复
  - [ ] 入口：规划页、进度页、编辑页、阅读器
  - _需求：REQ-016、REQ-010_

---

## 阶段 13：横切与补偿

- [ ] **TASK-026. 存储删除补偿 Job**

  - [ ] Worker 扫描 `storage_delete_pending` → R2 `deletePrefix` 重试
  - _需求：REQ-002、REQ-007_

---

## 阶段 14：测试与交付验收

- [ ] **TASK-027. 单元与集成测试**

  - [ ] 状态机、手动序章、写作计划 JSON、R2StorageDriver mock
  - [ ] `pnpm vitest run` 通过
  - _需求：REQ-017、REQ-010、REQ-007_

- [ ] **TASK-028. E2E 核心旅程（Playwright）**

  - [ ] 完整向导 → 规划（含生成中轮询）→ L4 确认 → 自动创作 → 校验进度 → 完成页 → 阅读 → 导出
  - [ ] 快捷开写、手动模式、知识库绑定、章节重生
  - [ ] 访客营销首页：无创作控件；受保护路由未登录跳转登录 + `callbackUrl`
  - [ ] 仪表盘：`draft` 恢复向导；`planning` 生成中 vs 待确认分流
  - [ ] `validating` 续写展示校验进度（无「生成本章」）
  - [ ] `pnpm test:e2e` 通过
  - _需求：REQ-001~018 主路径与 UI/访问 P0_

- [ ] **TASK-029. 构建与类型检查（DoD）**

  - [ ] `npx tsc --noEmit`、`pnpm lint`、`pnpm build`
  - _需求：REQ-018；AGENTS.md_

---

## 修订记录

| 版本 | 日期 | 说明 |
| ---- | ---- | ---- |
| 1.0.0 | 2026-05-20 | 初稿；含澄清 Q1~Q6 |
| 1.0.1 | 2026-05-20 | 阶段 0 增加 TASK-000b |
| 1.1.0 | 2026-05-23 | **全量交付**；TASK-019~026 |
| 1.2.0 | 2026-05-23 | R2 完整实现并入 TASK-003；移除独立 TASK-027；任务 renumber 27~29 |
| 1.3.0 | 2026-05-23 | **R2 唯一存储**；TASK-003 移除 local 驱动；dev 亦需 R2 |
| 1.4.0 | 2026-05-23 | 对齐 requirements v1.4.0：UI/访问 P0（营销页、状态入口、规划/校验进度、完成页、设置导航、E2E） |
