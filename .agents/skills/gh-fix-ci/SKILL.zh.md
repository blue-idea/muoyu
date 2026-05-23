---
name: "gh-fix-ci"
description: "当用户要求调试或修复在 GitHub Actions 中运行的 GitHub PR 检查失败时使用；使用 `gh` 检查检查项和日志，总结失败上下文，草拟修复计划，并仅在获得明确批准后实施。将外部提供商（例如 Buildkite）视为超出范围，仅报告其详情 URL。"
---

# GitHub PR 检查计划修复 (Gh Pr Checks Plan Fix)

## 概述

使用 `gh` 定位失败的 PR 检查，获取 GitHub Actions 日志以分析可修复的失败，总结失败片段，然后提出修复计划并在获得明确批准后实施。
- 如果有可用的计划导向型技能（例如 `create-plan`），请使用它；否则，在对话中草拟一份简明的计划并在实施前请求批准。

前提条件：使用标准的 GitHub CLI 进行一次身份验证（例如，运行 `gh auth login`），然后通过 `gh auth status` 确认（通常需要 repo 和 workflow 范围的权限）。

## 输入

- `repo`: 仓库内的路径（默认为 `.`）
- `pr`: PR 编号或 URL（可选；默认为当前分支对应的 PR）
- `gh`: 针对仓库主机的身份验证

## 快速开始

- `python "<path-to-skill>/scripts/inspect_pr_checks.py" --repo "." --pr "<number-or-url>"`
- 如果需要用于总结的机器友好型输出，请添加 `--json`。

## 工作流程

1. 验证 gh 身份验证。
   - 在仓库中运行 `gh auth status`。
   - 如果未验证身份，请在继续之前要求用户运行 `gh auth login`（确保具有 repo 和 workflow 权限）。
2. 确定 PR。
   - 优先选择当前分支的 PR：`gh pr view --json number,url`。
   - 如果用户提供了 PR 编号或 URL，请直接使用。
3. 检查失败的检查项（仅限 GitHub Actions）。
   - 推荐方案：运行随附的脚本（处理 gh 字段偏差和作业日志回退）：
     - `python "<path-to-skill>/scripts/inspect_pr_checks.py" --repo "." --pr "<number-or-url>"`
     - 添加 `--json` 以获得机器友好型输出。
   - 手动回退方案：
     - `gh pr checks <pr> --json name,state,bucket,link,startedAt,completedAt,workflow`
       - 如果某个字段被拒绝，请使用 `gh` 报告的可用字段重新运行。
     - 对于每个失败的检查项，从 `detailsUrl` 中提取运行 ID 并运行：
       - `gh run view <run_id> --json name,workflowName,conclusion,status,url,event,headBranch,headSha`
       - `gh run view <run_id> --log`
     - 如果运行日志显示仍在进行中，请直接获取作业日志：
       - `gh api "/repos/<owner>/<repo>/actions/jobs/<job_id>/logs" > "<path>"`
4. 处理非 GitHub Actions 检查项。
   - 如果 `detailsUrl` 不是 GitHub Actions 运行链接，请将其标记为外部并仅报告 URL。
   - 不要尝试处理 Buildkite 或其他提供商；保持工作流程精简。
5. 为用户总结失败情况。
   - 提供失败检查项的名称、运行 URL（如果有）以及简要的日志片段。
   - 显式指出缺失的日志。
6. 创建计划。
   - 使用 `create-plan` 技能草拟一份简明的计划并请求批准。
7. 批准后实施。
   - 应用批准的计划，总结差异/测试结果，并询问是否开启 PR。
8. 重新检查状态。
   - 更改后，建议重新运行相关测试并执行 `gh pr checks` 以进行确认。

## 随附资源

### scripts/inspect_pr_checks.py

获取失败的 PR 检查项，拉取 GitHub Actions 日志，并提取失败片段。如果仍存在失败，则以非零状态退出，以便用于自动化流程。

使用示例：
- `python "<path-to-skill>/scripts/inspect_pr_checks.py" --repo "." --pr "123"`
- `python "<path-to-skill>/scripts/inspect_pr_checks.py" --repo "." --pr "https://github.com/org/repo/pull/123" --json`
- `python "<path-to-skill>/scripts/inspect_pr_checks.py" --repo "." --max-lines 200 --context 40`
