# 提示词 · W9 — 打磨与最终验收

> 把下面整段贴给 codex。动手前先读 `docs/CODEX_PLAYBOOK.md`。W9 不加大功能，目标是**让整个系统达到可演示、可验收的成品质量**。

---

你在 `/Users/zhishi/project/toufang-2` 上做 **W9：打磨与最终验收**。先读 `docs/CODEX_PLAYBOOK.md`。这一波是收口——补齐串联、消除粗糙、跑通完整验收剧本。

## 任务

### A. 全链路验收（对照下方剧本逐条走通）
最终验收 = `docker compose up` + `pnpm db:reset && pnpm seed` + 配好 `OPENAI_API_KEY` + 同时跑 `pnpm dev` 和 `pnpm dev:worker`，**全程只通过 UI** 走完：
1. 登录 → 选组织 → Dashboard 有真实数据。
2. 建 Campaign → 策略生成工作流（SSE 进度）→ 审批 → 策略落库。
3. 达人发现 → 评分 → shortlist 审批 → 管道推进。
4. Brief 生成 → 编辑 → 定稿。
5. 外联草稿 → 审批门 → 标记发送 → 录回复 → 谈判分析 → 合同/付款登记。
6. 内容上传 → AI 审核 findings → 通过 → 发布 → 录指标。
7. 生成 Campaign 报告（图表 + AI 洞察）→ 审批 → 导出。
8. 横切：AI 监控页可见每次 run 的步骤/token 成本；审计日志全程有记录；知识问答带引用；`viewer` 访问 Admin 得权限拒绝态；抽查两个组织间数据隔离。

每一步若断链或体验粗糙，就地修好。**把这 8 步串成一条完整的 Playwright e2e**（`e2e/w9-acceptance.spec.ts`，用 `MODEL_PROVIDER=fake`），这是最终验收的可执行证据。

### B. Seed v3 演示剧本
`prisma/seed*.ts` 收敛成一套**连贯的中文演示数据**：一个走到中段的旗舰 Campaign（焕亮维C精华），各阶段都有可看内容（策略/研究/达人管道/Brief/外联/合同/内容/指标/报告/知识文档/通知/审批项）。幂等、可重复 `pnpm db:reset && pnpm seed`。注意 UUIDv7 唯一键陷阱。

### C. 四态 / 权限 / 移动端排查
逐页排查（27 页）：
- **四态**：loading（骨架）、error（可重试）、empty（有引导文案）、permission-denied 都到位——用 `AsyncBoundary`。
- **权限**：每个写操作有 `PermissionGate`；每个写路由有 `createApiHandler({permission})`。用 `viewer@demo.com` 逐页验证。
- **移动端**：查看/审批/轻编辑在窄屏可用（响应式），关键页不错位。

### D. 打磨清单
- 消除所有 god 组件（>200 行的 page）、copy-paste、死代码、`any`、英文残留文案。
- 统一 loading/error/toast 文案风格。
- `README.md`（中文）：架构简介、`docker compose up` → 环境变量 → `db:reset`/`seed` → `dev`/`dev:worker` → 验收剧本的完整上手步骤。
- 补齐任何遗漏的 vitest（核心逻辑覆盖率查漏）。

### E. 最终门禁
- `pnpm check` 全绿。
- `pnpm db:reset && pnpm seed` 成功。
- `pnpm e2e` **全部 spec（w1–w9）通过**（fake provider）。
- 用真实 `OPENAI_API_KEY` 手动走一遍验收剧本 8 步，确认真实 AI 链路可用。

## 完成标准
对照 `docs/CODEX_PLAYBOOK.md` §5 DoD 和 §7 自检。全绿 + 验收剧本走通后，提交 `chore(release): W9 打磨与最终验收`（或按修改内容拆成几个语义提交）。在提交信息或 README 里记录已知的简化/deferred 项。
