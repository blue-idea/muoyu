---
name: imp
description: 执行tasks.md中的任务
trigger: /imp
---
执行 `docs/spec/tasks.md` 中的任务。
参数：
- 将 `/imp` 后面的内容视为任务定位信息，优先匹配任务编号、标题或需求编号。
- 若未提供参数，先读取 `docs/spec/tasks.md`，列出未完成任务并请求我确认要执行哪一项，不要直接开始改动。
执行要求：
1. 执行前必须加载并遵守以下上下文：
- `docs/spec/constitution.md`
- `docs/spec/requirements.md`
- `docs/spec/design.md`
- `docs/spec/data.md`（仅在数据库或数据结构相关时重点使用）
- `docs/spec/api.md`（仅在接口相关时重点使用）

2. 执行任务时：
- 在 `docs/spec/tasks.md` 中定位目标任务。
- 读取任务中的 `_需求:` 标记。
- 去 `docs/spec/requirements.md` 查找对应需求编号和原始内容，并严格按需求实现。
- 同时检查实现是否违反 `docs/spec/constitution.md` 和 `docs/spec/design.md`。
- 默认直接实施，不只做分析；除非任务信息冲突、需求缺失或存在高风险歧义。

3. 执行完成后必须做验证：
- 检查本次改动是否存在语法错误、类型错误、编译错误。
- 检查是否引入现有功能回归。
- 检查是否违反 `docs/spec/constitution.md`。
- 进行功能验收，优先运行与改动最相关的单元测试、集成测试、E2E；若无法运行，明确说明原因和未验证项。

4. 文档更新规则：
- 将已完成任务在 `docs/spec/tasks.md` 中更新为 `[x]`。
- 如果涉及数据库结构变更，更新 `docs/spec/data.md`。
- 如果涉及接口变更，更新 `docs/spec/api.md`。
- 除非我明确要求，不要新增任何文档。

5. 输出要求：
- 先完成实现和验证，再汇报结果。
- 结果中说明：完成了什么、验证了什么、是否更新了 `tasks.md` / `data.md` / `api.md`、仍存在哪些风险或阻塞。

当前命令输入：
- 任务定位信息：`$ARGUMENTS`