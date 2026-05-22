# 摸鱼小说 (Moyu Novel)

[![Next.js](https://img.shields.io/badge/Next.js-16.x-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-orange?style=flat-square)](https://orm.drizzle.team/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-blue?style=flat-square&logo=mysql)](https://www.mysql.com/)

**摸鱼小说** 是一款面向中文网文创作场景的 AI 小说生成系统。通过渐进式问答收集创作意图，自动生成大纲与人物设定，并支持全自动或手动逐章写作、质量校验与内容交付。

## 🌟 核心价值

- **渐进式披露 (L0–L5)**：从简单的想法到深度的设定，分步引导创作，降低决策负担。
- **文件真源架构**：人物档案、大纲、章节正文以 Markdown 文件持久化存储，数据库仅保存元数据索引，确保内容易于迁移与导出。
- **全自动/手动创作**：支持后台全自动连续写作，也支持手动逐章触发、预览。
- **偏好记忆与学习**：系统自动学习用户的创作风格与题材偏好，越写越懂你。
- **外接知识库 (RAG)**：支持上传文档或抓取网址作为参考资料，生成内容严格遵循设定约束。
- **自定义 AI 模型**：支持配置自有 OpenAI 兼容接口（如 GPT-4, DeepSeek 等）驱动创作。
- **多格式导出**：一键生成 MD、TXT、PDF、EPUB 等多种格式成品。

## 🛠️ 技术栈

- **前端框架**：Next.js 16 (App Router)
- **开发语言**：TypeScript
- **UI 组件库**：React + shadcn/ui + Tailwind CSS
- **身份认证**：NextAuth.js (Auth.js v5)
- **数据库**：MySQL + Drizzle ORM
- **持久化存储**：本地文件系统 (Local FS) / 预留 Cloudflare R2
- **异步任务**：独立进程 Worker 消费任务队列
- **国际化**：next-intl (中文 UI，英文错误信息)

## 📂 项目结构

```text
moyu/
├── app/                     # Next.js App Router (页面、布局、API)
├── components/              # React 组件 (UI 与 业务组件)
├── config/                  # 全局配置 (字数、路径、存储驱动等)
├── docs/                    # 项目规范与技术文档 (PRD, 设计, API, Data)
├── lib/                     # 领域层与基础设施 (novel 业务逻辑, db, ai, storage)
├── scripts/                 # 脚本 (包含后台创作 Worker)
├── stores/                  # Zustand 状态管理
├── tpl/                     # 写作模板与流程规范 (核心业务资产)
└── tests/                   # 单元测试与 E2E 测试
```

## 🚀 快速上手

### 1. 环境准备

- Node.js (>= 20)
- MySQL (8.x)
- pnpm

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

复制 `.env.example` 并重命名为 `.env.local`，填写必要的配置信息：

- `DATABASE_URL`: MySQL 连接地址
- `AUTH_SECRET`: NextAuth 密钥
- `WORKSPACE_ROOT`: 小说内容文件存储根目录
- `PLATFORM_LLM_*`: 平台默认 AI 模型配置

### 4. 数据库迁移

```bash
pnpm drizzle-kit push
```

### 5. 启动开发服务器

```bash
# 启动 Web 应用
pnpm dev

# 启动后台创作 Worker (如需自动写作功能)
pnpm worker
```

打开 [http://localhost:3000](http://localhost:3000) 即可开始创作。

## 📝 文档索引

- [产品需求文档 (PRD)](./docs/project.md)
- [功能需求详表](./docs/spec/requirements.md)
- [技术设计文档](./docs/spec/design.md)
- [数据库设计](./docs/spec/data.md)
- [API 接口设计](./docs/spec/api.md)

## 📄 许可

本项目遵循 [LICENSE](LICENSE) 协议。
