# Campaign 内联工作台交互设计

## 背景

当前 Campaign 详情页承担了完整投放链路的入口，但多个关键动作会把用户带到全局页面：

- 工作流暂停后，`WorkflowProgress` 引导用户去 `/approvals` 处理审批。
- Campaign 的 Outreach、内容、合同付款、数据、报告 Tab 目前只是入口卡片，再跳到全局工作台。
- 用户处理一个 Campaign 时，需要在 Campaign 详情页、审批中心、各全局工作台之间来回切换，容易丢失上下文。

本次设计目标是让用户在 Campaign 详情页内完成当前 Campaign 的关键待办，减少跨页面跳转。

## 目标

- 在 Campaign 详情页内展示当前 Campaign 相关的待处理审批、工作流暂停项和下一步动作。
- 支持在 Campaign 详情页内直接批准或驳回相关审批。
- 保留全局审批中心，用于跨 Campaign 批量处理和历史筛选。
- 保留现有后端审批门与审计链路，不绕过 `human_checkpoints`。
- 保持 `page.tsx` 瘦身：新增能力放进 `features/campaigns/components/` 或复用 `features/approvals/components/`。

## 非目标

- 不在第一期重构所有全局工作台页面。
- 不改变审批状态机、工作流引擎或权限模型。
- 不新增数据库表。
- 不把所有 Tab 内容一次性改成复杂内嵌工作台。

## 推荐方案：Campaign 内联待办侧栏

在 Campaign 详情页主体布局中增加一个右侧工作栏。桌面端为右侧固定列，移动端折叠为页面顶部的“待办”区块。

右侧工作栏包含三类信息：

1. **待审批**
   - 显示当前 Campaign 相关的 pending checkpoints。
   - 每个审批项复用审批中心的摘要渲染与批准/驳回动作。
   - 用户处理后刷新 Campaign、审批列表、工作流详情。

2. **当前 AI / 工作流状态**
   - 当当前页面中有等待人工审批的工作流时，显示“在此处理”而不是跳转审批中心。
   - 保留工作流步骤进度，但把审批动作内联到同一上下文。

3. **下一步建议**
   - 基于当前 Campaign status 展示阶段建议。
   - 不新增业务规则，复用 `CampaignOverviewTab` / `campaign-stage-decisions` 中已有的阶段文案。

## 信息架构

Campaign 详情页调整为：

- 顶部：Campaign 标题、状态、阶段流。
- 主体：左侧为现有 Tab 内容，右侧为 Campaign 待办侧栏。
- Tab 内容：
  - `概览`、`策略`、`达人 Pipeline`、`Brief` 保持现有能力。
  - `Outreach`、`内容`、`合同付款`、`数据`、`报告` 第一阶段仍可保留全局入口，但要在侧栏中承接审批闭环。
  - 第二阶段再把这些全局页抽成可按 `campaign_id` 内嵌的工作区组件。

## 组件设计

新增或调整以下组件：

- `CampaignActionRail`
  - 位置：`src/features/campaigns/components/campaign-action-rail.tsx`
  - 输入：`campaignId`、`campaignStatus`
  - 职责：拉取当前 Campaign 相关审批、展示待办、处理空态。

- `ApprovalCard` 抽出复用
  - 现状：审批卡片定义在 `src/app/(app)/approvals/page.tsx` 内部。
  - 调整：移动到 `src/features/approvals/components/approval-card.tsx`。
  - `ApprovalsPage` 和 `CampaignActionRail` 共用同一个卡片，避免审批行为分叉。

- `WorkflowProgress`
  - 新增可选 prop：`inlineApproval?: boolean` 或 `pendingCheckpointRenderer?: (...) => ReactNode`。
  - 当开启内联模式时，不显示“前往审批中心”，而提示用户在当前 Campaign 待办栏处理。

## 数据流

第一期优先复用现有 API：

- `GET /api/v1/approvals?status=pending`
- 前端根据 checkpoint 的 `payload` / `entity_type` / `entity_id` 识别是否属于当前 Campaign。

如果前端过滤不稳定，再补一个小后端增强：

- `GET /api/v1/approvals?status=pending&campaign_id=<id>`
- repository 查询仍然保持 tenant 过滤。
- service 层只扩展 list params，不改变 DTO。

优先判断规则：

- checkpoint payload 中存在 `campaign_id` 时直接匹配。
- payload 中存在 `campaign` 对象且有 id 时匹配。
- 与 campaign 关系较深的审批项，必要时第二期在服务端 hydrate campaign id。

## 交互细节

- 待办栏空态文案：`当前 Campaign 暂无待处理事项`。
- 审批项处理成功后留在当前页面，toast 显示 `已批准` / `已驳回`。
- 驳回仍要求填写原因，保留审计记录。
- 已处理项默认不展示，用户可通过全局审批中心查看历史。
- 权限不足时展示只读审批摘要，不显示处理按钮。

## 错误与边界

- 审批处理失败：复用 `useDecideApproval` 的错误 toast。
- 审批项被其他人处理：刷新列表后消失；当前操作返回冲突时提示后重新拉取。
- Campaign 没有任何待办：侧栏显示下一步建议，不占用过多视觉权重。
- 移动端：侧栏在 Tab 上方显示为折叠区，避免挤压主内容。

## 测试计划

- Vitest：
  - 如果新增 `campaign_id` 查询参数，测试 checkpoint service/repository 过滤逻辑。
  - 若只做前端过滤，测试纯函数 `belongsToCampaign(checkpoint, campaignId)`。

- Playwright：
  - 在 Campaign 详情页触发一个 Brief 或内容审批。
  - 不离开 Campaign 页面，直接批准审批。
  - 断言审批项消失，工作流或对应内容刷新。

- 手动验证：
  - `admin@demo.com` 可处理审批。
  - `viewer@demo.com` 只读，不显示批准/驳回。
  - 桌面与移动宽度下侧栏不遮挡主 Tab。

## 分期

### Phase 1：内联审批闭环

- 抽出可复用 `ApprovalCard`。
- 新增 `CampaignActionRail`。
- Campaign 详情页改为主内容 + 右侧待办栏布局。
- 工作流等待审批时不再强制跳转审批中心。
- 增加 e2e 覆盖 Campaign 内审批。

### Phase 2：内嵌业务工作区

- 从全局 Outreach / 内容 / 合同 / 数据 / 报告页面抽出可复用工作区组件。
- Campaign Tab 直接传入 `campaignId` 渲染工作区。
- 全局页继续作为跨 Campaign 列表和筛选入口。

### Phase 3：任务级聚合

- 统一生成“下一步行动”列表。
- 将风险、审批、工作流暂停、数据缺口统一为 Campaign task inbox。
- 仅当真实使用场景证明需要时再做。

