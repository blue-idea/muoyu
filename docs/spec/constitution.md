# 项目宪章

## 文档信息

| 项 | 内容 |
|----|------|
| 版本 | **1.2.0** |
| 状态 | 已定稿 |
| 定稿日期 | 2026-05-23 |
| 上游 | [requirements.md](./requirements.md)、[project.md](../project.md) |
| 下游 | [design.md](./design.md)、[tasks.md](./tasks.md) |

---

## 1. 项目使命

**摸鱼小说**（muoyu）是面向中文网文创作场景的 AI 小说生成网站：通过渐进式问答收集创作意图，自动生成人物、大纲与写作计划，在用户确认后逐章创作、校验并交付可读可导出的完整作品。

**交付策略：** 项目采用**全量功能实现**，不按产品分期裁剪需求；REQ-001 ~ REQ-018 均为当前版本验收范围。

---

## 2. 不可违背的原则

### 2.1 内容持久化铁律（REQ-007）

| 规则 | 说明 |
|------|------|
| R2 为真源 | 人物档案、大纲、章节 MD、写作计划 JSON、知识库全文、导出文件等**全部**存 **Cloudflare R2**；禁止本地文件系统落盘 |
| 库仅存 R2 路径 | PostgreSQL 仅存 R2 对象键（`storage_prefix`、`relative_path`、`text_storage_key`、`storage_key` 等）与状态、字数等元数据 |
| 禁止正文入库 | 不得将长篇正文写入 BLOB/TEXT 列 |
| 写入顺序 | 先写 R2（`R2StorageDriver`）→ 再更新 `content_files` 与项目时间戳 |

### 2.2 创作三法则（`tpl/SKILL.md`）

1. **展示而非讲述** — 用动作和对话表现  
2. **冲突驱动剧情** — 每章须有冲突或转折  
3. **悬念承上启下** — 每章结尾须留钩子  

### 2.3 安全与归属

| 规则 | 说明 |
|------|------|
| 必须登录 | 创作、作品、知识库、模型设置等能力须已登录 |
| 行级隔离 | 所有业务查询带 `user_id = session.user.id` |
| 密钥外置 | API Key、数据库 URL 等仅通过 `.env`，禁止硬编码 |
| 对外错误 | 用户可见文案**英文**；不暴露堆栈 |

### 2.4 工程规范（摘自 AGENTS.md）

- TypeScript 严格模式；避免 `any`；禁止 `as any` 与不安全断言  
- 配置集中管理于 `config/`  
- 严禁重复逻辑；先查现有实现再扩展  
- 测试驱动：红 → 绿 → 重构  
- 任务完成后运行 `npx tsc --noEmit`  
- 禁止使用 beta 依赖  

---

## 3. 技术约束摘要

| 领域 | 约束 |
|------|------|
| 框架 | Next.js 16 App Router + TypeScript |
| 数据库 | PostgreSQL + Drizzle ORM |
| 认证 | Auth.js v5；Credentials + OAuth（GitHub、Google） |
| 存储 | **Cloudflare R2 唯一**；`R2StorageDriver`（S3 兼容 API）；开发/生产均使用 R2（推荐 dev 独立 Bucket） |
| 后台任务 | 独立 Worker（`npm run worker`）；`planning_jobs` + `generation_jobs` |
| 读/写 | RSC 读；Server Actions 写；Job 进度 REST 轮询 |
| 国际化 | 默认 locale `zh`；错误 key 走 `messages/en.json` `errors.*` |
| 限流 | 全 `/api/*`：100 次/小时/IP |

详细设计见 [design.md](./design.md)。

---

## 4. 状态与流程约束

### 4.1 项目五态

`draft` → `planning` → `writing` → `validating` → `completed`

- 「规划中」合并生成中与待 L4 确认，均用 `planning` + `planning_ready` 区分  
- L4 确认前不得进入 `writing`  

### 4.2 创作节奏

| 模式 | 约束 |
|------|------|
| `creationPace: auto` | Worker 连续逐章；用户离开页面可后台续写 |
| `creationPace: manual` | **强制串行**；仅当前最小序号 `pending`/`failed` 章可生成 |
| `writingMode: parallel` | 仅与 `auto` 组合；分批并行，大纲连贯 |

### 4.3 字数策略

| 场景 | 3000–5000 未达标 |
|------|------------------|
| Phase 3 AI 创作 | 扩充/重写，最多 3 轮，不得以 `completed` 结束 |
| M8 人工编辑/接受润色 | **警告可保存**；`wordCountPass: false` |

---

## 5. 文档层级与变更流程

```text
docs/project.md          # 产品 PRD（业务语言）
docs/spec/
├── constitution.md      # 本文：不可违背原则
├── requirements.md      # EARS 需求与验收标准
├── design.md            # 技术架构
├── data.md              # 数据库与 JSON 结构
├── api.md               # 接口与 Action 契约
├── tasks.md             # 实施任务拆分
└── info.md              # 环境与运行信息
```

**变更规则：**

1. 需求变更 → 先改 `requirements.md` 并递增版本  
2. 表结构变更 → 同步 `data.md` + Drizzle 迁移  
3. 接口变更 → 同步 `api.md`  
4. 任务完成 → 在 `tasks.md` 标记 `[x]`  

---

## 6. 质量门禁

| 检查项 | 命令/方式 |
|--------|-----------|
| 类型检查 | `npx tsc --noEmit` |
| Lint | `pnpm lint` |
| 单元测试 | `pnpm vitest run` |
| E2E | `pnpm test:e2e` |
| 构建 | `pnpm build` |
| 提交前 | Husky + lint-staged |
| CI | GitHub Actions（ci.yml + security-audit.yml） |

---

## 7. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-05-23 | 初稿；明确全量交付策略 |
| 1.1.0 | 2026-05-23 | R2 与 local 均为完整 StorageDriver 实现 |
| 1.2.0 | 2026-05-23 | **R2 唯一存储**；库仅存 R2 对象键；移除本地文件系统驱动 |

---

*违反本宪章的实现不得合并主分支；歧义以 [requirements.md](./requirements.md) EARS 验收标准为准。*
