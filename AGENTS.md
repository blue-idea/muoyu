
# 项目说明

## 技术栈

### TypeScript 规范

- 避免编写使用 `as any` 或其他 lint 抑制的不安全 TypeScript 代码。
- 避免使用 `any` 和 `unknown` 类型。
- 避免使用 `as` 断言。
- 任务完成后自动调用npx tsc -noEmit检查

## 包管理规范

1.使用稳定版的包版本，禁止使用任何beta版本。

2. ...

## 工程化规范

在编写代码时，请务必遵循以下原则：

1. 严禁重复: 任何重复的代码逻辑都必须被抽象成可复用的单元（函数、类等）。
2. 检查现有代码：先分析项目中是否已有类似实现
3. 模块化设计：将功能拆分为独立、可复用的模块
4. 统一接口：使用一致的参数格式和返回值结构
5. 配置集中管理：所有常量和配置项统一管理在 `config/` 目录
6. 优先封装: 将相关功能和数据封装在独立的、职责明确的模块中。
7. 环境变量使用 `.env` 文件，禁止硬编码

## 开发方式

严格遵守测试驱动开发（TDD）流程。请严格遵循红-绿-重构循环。

- 先分析需求并拆分测试点
- 先编写失败的单元测试（Red）
- 编写最小实现使测试通过（Green）
- 在测试保护下重构代码（Refactor）

## 沟通规范 

1. 所有内容必须使用中文交流（包括代码注释），但是文案与错误提示要使用英文。  
2. 遇到不清楚、歧义、缺失的内容应立即向用户提问。  
3. 表达清晰、简洁、技术准确。  
4. 在代码中应添加必要的注释解释关键逻辑。
5. 当前任务完成后，提出下一步执行的建议。

## 执行任务

1.执行复杂问题时使用 Sequential Thinking mcp 工具，拆分任务。
 2.涉及ui设计的任务时使用Playwright mcp或 工具进行视觉回归测试。
 3.当运行 `find` 或类似命令时，要注意 `node_modules` 并忽略它，
 ...

## 编码安全

### 1.Row-Level Security 行级安全（让数据库保护你的用户）

Implement Row-Level Security in my Supabase database.
 Tables: [list them]. Each row only accessible to the user who created it.
 Generate SQL policies to enable RLS on all tables.
 Restrict access based on auth.uid().
 Include policies for SELECT, INSERT, UPDATE, DELETE.

### 2. Rate Limiting

Add rate limiting to all my API routes. Limit each IP address to
 100 requests per hour. Apply globally to all API routes.
 Return a clear error message when the limit is exceeded. Show me
 where to add this and how it will work.

### 3.  将 API 密钥排除在你的代码之外

Move all my API keys to environment variables. Find every place
 in my code using API keys directly (Stripe, AWS, database URLs,
 third-party services). Show me: 1) how to create a .env.local file,

2) how to update code to use process.env, 3) what to add to .gitignore,
3) how to set these in Vercel/my hosting platform.

## 文档说明书

docs/spec/
 ├── requirements.md # 需求与 EARS 验收标准
 ├── constitution.md # 项目宪法
 ├── design.md # 技术设计
 ├── data.md # 数据库设计
 ├── api.md # API 设计
 ├── tasks.md # 任务拆分
 ├── info.md # 系统信息

## tasks.md任务执行步骤

### 1. 执行前加载上下文：

`docs/spec/constitution.md`(项目宪章)
 `docs/spec/requirements.md`（需求内容）
 `docs/spec/design.md`（架构约束）
 `docs/spec/data.md`和`docs/spec/api.md`（如相关）

### 2.执行中

_需求: 相关的需求点和验收标准的编号，要查阅需求文档docs/spec/requirements.md中的对应需求内容和验收标准内容去严格执行

### 3. 执行后：

#### 业务功能验收

#### 错误检查和功能验收

1. 检查本次变更是否语法错误、类型错误、编译错误等。
2. 破坏现有功能（回归问题）。
3. 违反 `constitution.md` 中的规范
4. 进行功能验收，使用单元测试、E2E等方式

#### 4.文档更新

1.更新 `docs/spec/tasks.md` 状态为 `[x]`

## 质量基线和功能测试

- 代码确保没有明显的 Lint 错误和编译错误。
- Git Hooks 在提交前强制检查( Husky 和 lint-staged)
- CI/CD 流程中集成GitHub Actions 通过多种方式实现CI/CD的自动化流程，尤其是代码审计和安全扫描。
- 落地 Vitest + Testing Library、Playwright（Chromium/Firefox/WebKit）
