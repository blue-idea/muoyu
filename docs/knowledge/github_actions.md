针对 Next.js + TypeScript 项目，给你一套完整的代码审计方案：

---

## 一、完整流水线配置

```yaml
# .github/workflows/security-audit.yml
name: Security Audit

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # ─────────────────────────────────────
  # 1. TypeScript 类型检查 + ESLint 安全规则
  # ─────────────────────────────────────
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: TypeScript Type Check
        run: npx tsc --noEmit

      - name: ESLint Security Audit
        run: npx eslint . --ext .ts,.tsx --max-warnings 0

  # ─────────────────────────────────────
  # 2. 依赖漏洞扫描
  # ─────────────────────────────────────
  dependency-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: npm audit
        run: npm audit --audit-level=high --omit=dev

      - name: Snyk Scan
        uses: snyk/actions/node@master
        continue-on-error: true   # 不阻断，仅上报
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  # ─────────────────────────────────────
  # 3. SAST 静态代码分析（CodeQL）
  # ─────────────────────────────────────
  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      actions: read
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript  # TS 归属于 javascript
          queries: security-and-quality

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3

  # ─────────────────────────────────────
  # 4. Semgrep（Next.js 专项规则）
  # ─────────────────────────────────────
  semgrep:
    name: Semgrep Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Semgrep
        uses: semgrep/semgrep-action@v1
        with:
          config: >
            p/typescript
            p/react
            p/nextjs
            p/owasp-top-ten
            p/jwt
            p/secrets

  # ─────────────────────────────────────
  # 5. Secret 泄露检测
  # ─────────────────────────────────────
  secret-scan:
    name: Secret Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # ─────────────────────────────────────
  # 6. 合并门禁（所有检查必须通过）
  # ─────────────────────────────────────
  security-gate:
    name: Security Gate
    needs: [lint-and-typecheck, dependency-audit, codeql, semgrep, secret-scan]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Check all jobs
        run: |
          if [[ "${{ needs.lint-and-typecheck.result }}" != "success" || \
                "${{ needs.codeql.result }}" != "success" || \
                "${{ needs.semgrep.result }}" != "success" || \
                "${{ needs.secret-scan.result }}" != "success" ]]; then
            echo "❌ Security checks failed!"
            exit 1
          fi
          echo "✅ All security checks passed!"
```

---

## 二、ESLint 安全规则配置

安装依赖：

```bash
npm install -D \
  eslint-plugin-security \
  eslint-plugin-no-secrets \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser
```

配置 `.eslintrc.json`：

```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "plugins": [
    "@typescript-eslint",
    "security",
    "no-secrets"
  ],
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:security/recommended"
  ],
  "rules": {
    // 防止 XSS
    "react/no-danger": "error",
    "react/no-danger-with-children": "error",

    // 防止硬编码密钥
    "no-secrets/no-secrets": ["error", { "tolerance": 4.2 }],

    // TypeScript 安全规则
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",

    // 安全相关
    "security/detect-object-injection": "warn",
    "security/detect-non-literal-regexp": "warn",
    "security/detect-possible-timing-attacks": "error",
    "security/detect-sql-injection": "error"
  }
}
```

---

## 三、Next.js 专项安全检查

针对 Next.js 特有的安全风险，新增一个检查 job：

```yaml
# 追加到 security-audit.yml
  nextjs-security:
    name: Next.js Security Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      # 检查 next.config.js 安全配置
      - name: Check Next.js Security Headers
        run: |
          node -e "
          const config = require('./next.config.js');
          const headers = JSON.stringify(config);

          const required = [
            'X-Frame-Options',
            'X-Content-Type-Options',
            'Content-Security-Policy',
            'Strict-Transport-Security'
          ];

          const missing = required.filter(h => !headers.includes(h));
          if (missing.length > 0) {
            console.error('❌ Missing security headers:', missing);
            process.exit(1);
          }
          console.log('✅ Security headers OK');
          "

      # 检查 .env 文件未被提交
      - name: Check .env not committed
        run: |
          if git ls-files | grep -E '^\.env$|^\.env\.local$|^\.env\.production$'; then
            echo "❌ .env files should not be committed!"
            exit 1
          fi
          echo "✅ No .env files committed"
```

---

## 四、工具选择总结

| 工具                   | 检查内容              | 是否阻断 PR        |
| ---------------------- | --------------------- | ------------------ |
| `tsc --noEmit`       | 类型安全              | ✅ 是              |
| ESLint + security 插件 | XSS / 注入 / any 滥用 | ✅ 是              |
| CodeQL                 | 深度漏洞分析          | ✅ 是              |
| Semgrep (nextjs规则)   | Next.js 特有风险      | ✅ 是              |
| Gitleaks               | 密钥泄露              | ✅ 是              |
| npm audit              | 依赖 CVE              | ⚠️ High 以上阻断 |
| Snyk                   | 依赖漏洞 + 修复建议   | ⚠️ 仅上报        |

---

需要我补充某个环节的详细说明，比如  **Semgrep 自定义规则** 、 **API 路由安全检查** 、或者 **PR 审查报告自动评论**吗？

|阶段|环节|典型工具/Action|
|---|---|---|
|代码|Lint 检查|`eslint`, `prettier`|
||类型检查|`tsc --noEmit`|
||安全扫描|`CodeQL`, `Semgrep`, `Gitleaks`|
||依赖审计|`npm audit`, `Snyk`|
||提交规范|`commitlint`, `Husky`|
|构建|依赖安装|`actions/setup-node`, `npm ci`|
||编译打包|`webpack`, `vite`, `tsc`|
||容器构建|`docker/build-push-action`|
||版本管理|`semver`, `release-please`|
|测试|单元测试|`Vitest`, `Jest`|
||集成测试|`Testing Library`|
||E2E 测试|`Playwright`, `Cypress`|
||覆盖率|`Codecov`, `Coveralls`|
||性能测试|`Lighthouse`, `k6`|
|部署|静态托管|`Vercel`, `Netlify`, `Pages`|
||容器部署|`K8s`, `ECS`, `ACR`|
||云服务|`AWS`, `Azure`, `GCP`|
||发布通知|`Slack`, `Discord`, 邮件|
|运维|定时任务|`cron` 触发器|
||手动触发|`workflow_dispatch`|
||环境管理|`Environments`, `Secrets`|
||回滚机制|版本标签 + 重部署|
