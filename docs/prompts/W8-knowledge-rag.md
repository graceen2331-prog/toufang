# 提示词 · W8 — 知识 / RAG + 收尾模块

> 把下面整段贴给 codex。动手前先读 `docs/CODEX_PLAYBOOK.md`。

---

你在 `/Users/zhishi/project/toufang-2` 上开发 **W8：知识库 / RAG + 剩余收尾模块**。先读 `docs/CODEX_PLAYBOOK.md` 全文并严格遵守。规格在 `../toufang/docs/superpowers/specs/`。有不合理处可简化并说明。

先自查现状（照 §10 参考坐标的方式，动手前读真实文件）：
- `prisma/schema.prisma` 里 `knowledge_documents`、`knowledge_chunks`（含 `vector(1536)`）、`rag_queries`、`notifications`、`audit_logs`、`files`、`integration_connections` 的实际字段。
- `src/shared/constants/status.ts` 里 `KNOWLEDGE_DOCUMENT_STATUS`。
- 现有 AI 四层与工作流引擎（`ai/router/`、`ai/agents/run-agent.ts`、`workflows/engine.ts`）。
- `components/layout/nav-config.ts` 里还没解锁的路由。

## 要交付的东西

### A. RAG 管线
1. **Embedding 接入**：`ai/router` 的 `routerEmbed` + `embeddingModel`（`text-embedding-3-small`，fake provider 返回确定性向量）。
2. **摄取管线** `server/rag/`（或 `server/modules/knowledge/`）：上传 → 解析（pdf-parse / mammoth / md）→ 分块（~800 token，重叠 ~100）→ 批量 embed → 写 `knowledge_chunks`（pgvector）。分块器抽成纯函数并写 vitest。
3. **HNSW 索引**：`knowledge_chunks.embedding` 用原生 SQL 迁移建 HNSW 索引（`Unsupported("vector(1536)")` 列 Prisma 不管索引）。
4. **检索**：`$queryRaw` 做向量近邻检索，**SQL 内强制 `tenant_id` + 可见性过滤**；禁止跨租户泄漏。
5. **摄取入队**：走 BullMQ（队列如 `rag-ingest`），worker 里处理；文档状态 `KNOWLEDGE_DOCUMENT_STATUS` 随进度推进（uploading→processing→ready/failed）。注意 `jobId` 不含 `:`。
6. **Knowledge Agent** `prompts/knowledge.ts`（key `knowledge.answer`）：输入问题 + 检索到的 chunk；输出 `{answer, citations:[{chunk_id, quote}], confidence}`。**答案必须带 `[n]` 引用，无依据要明说"知识库中没有"**。fake fixture 配套。回答落 `rag_queries`。

### B. 知识库页
7. **模块 + 路由**：`server/modules/knowledge/`；路由 `api/v1/knowledge-documents`（上传/列表/删/状态）、`api/v1/knowledge/query`（问答，可 SSE 流式）。
8. **知识库页** `app/(app)/knowledge/` + `features/knowledge/`：文档列表（上传、处理状态）、问答界面（提问 → 流式回答 + 引用可点定位）。四态齐全（含"知识库为空""文档处理中"）。用 `FileUpload` 组件（没有就在 `components/shared` 建一个）。

### C. 收尾模块
9. **通知** `notifications`：`server/modules/notification/` + 路由 + 顶栏 `NotificationBell`（未读数、列表、标记已读）。审批门/工作流完成时产出通知（在相应 service 里发）。
10. **Admin 三页** `app/(app)/admin/`：
    - 组织成员（`/admin/users`）：成员列表、角色分配（RBAC 矩阵可视化，只 admin 可改）。
    - AI 监控增强 / 模型与预算配置（若 `/ai-runs` 已有则补预算配置）。
    - 组织设置。
11. **审计日志页** `app/(app)/audit-logs/`：`audit_logs` 只读列表 + 筛选（actor / entity / action / 时间），`admin:audit` 权限门。
12. **设置页** `app/(app)/settings/`：个人/组织基础设置。

### D. 收尾
13. `nav-config.ts`：解锁 `/knowledge`、`/notifications`、`/admin/users`、`/audit-logs`、`/settings`（及其它已实现），加进 `IMPLEMENTED_ROUTES`。**目标：27 个页面全部可达，无 404。**
14. **Seed** `prisma/seed-knowledge.ts`：造 1–2 篇中文知识文档（可内置一段文本直接分块 embed，用 fake embedding）、几条通知、几条审计日志。幂等，注意 UUIDv7 陷阱。挂进 `seed.ts`。
15. **vitest**：分块器、检索的租户隔离（跨租户查不到）、RAG 引用格式、通知已读逻辑。
16. **e2e** `e2e/w8-knowledge.spec.ts`：登录 → 知识库 → 上传/已有文档 → 提问 → 得到带引用的回答；`viewer` 访问 `/admin/users` 得权限拒绝态。

## 完成标准
对照 `docs/CODEX_PLAYBOOK.md` §5 DoD 和 §7 自检。RAG 检索的**租户隔离**要有测试证明。`pnpm check` + `pnpm seed` + `pnpm e2e`（RAG 摄取需 `pnpm dev:worker`）全绿后，提交 `feat(knowledge): W8 知识库/RAG + 通知/Admin/审计/设置`。
