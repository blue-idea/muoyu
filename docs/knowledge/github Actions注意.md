## GitHub Actions 需要的特殊设置

### 1. Draft PR 触发 CI（最关键）

这是流程的核心前置检查（启动前准备第 7 条）。

流程在 Step 1 就创建 Draft PR，并在 Step 3 push 时依赖 CI 在 Draft PR 上自动触发。**默认情况下，某些 CI 配置会排除 Draft PR**，必须确认 `.github/workflows/` 中 PR 触发的 workflow 的 `types` 配置：

```yaml
# ✅ 正确：Draft PR 可触发 CI
on:
  pull_request:
    types: [opened, synchronize, reopened]

# ❌ 错误：只有转为正式 PR 才触发，需要修改
on:
  pull_request:
    types: [ready_for_review]
```

**关键点**：`opened / synchronize / reopened` 这三个 type 覆盖了 Draft PR 的 push 行为；而 `ready_for_review` 只在 Draft 转正式时才触发，Draft 阶段的 push 不会触发 CI。

如果你不想改 workflow 配置，流程也提供了备选方案：在 Step 3 push 之后立即执行 `gh pr ready` 把 Draft 转为正式 PR 来触发 CI。

------

### 2. 区分 PR CI 和 post-merge 部署 workflow

流程对 Actions 做了明确的**门禁划分**（Step 5 vs Step 7），你的 workflow 配置需要与此对应：

| Actions 类型                               | 触发条件                        | 流程处理位置                 |
| ------------------------------------------ | ------------------------------- | ---------------------------- |
| lint / typecheck / unit test / build / E2E | PR push                         | Step 5 门禁，CI 全绿才能合并 |
| deploy to staging/production               | `push: branches: [main]`        | Step 7 post-merge 处理       |
| release / tag / changelog                  | `push: branches: [main]` 或 tag | Step 7 post-merge 处理       |

这意味着**部署类 workflow 不应该在 PR 分支触发**，只应在 main 合并后触发，否则会干扰 Step 5 的 CI 门禁判断。

------

### 3. 支持手动重触发 workflow（配置类故障修复）

Step 7 的部署失败修复路径中，针对**配置/环境问题**使用：

```bash
gh workflow run <name> --ref main
```

这要求对应的 workflow 文件中有 `workflow_dispatch` 触发器，否则无法手动重触发：

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:   # ← 需要有这一行才能支持手动触发
```

------

### 总结优先级

| 优先级 | 设置项                                              | 影响                            |
| ------ | --------------------------------------------------- | ------------------------------- |
| 🔴 必须 | Draft PR 触发 CI（`types` 包含 `synchronize`）      | CI 无法在 Step 3 提前并行运行   |
| 🟡 建议 | 部署 workflow 只在 main push 触发，不在 PR 分支触发 | Step 5 门禁结果会被污染         |
| 🟡 建议 | 部署 workflow 添加 `workflow_dispatch`              | Step 7 配置类故障无法手动重触发 |
|        |                                                     |                                 |