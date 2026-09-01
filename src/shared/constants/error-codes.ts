// 错误码单一事实源：服务端抛出 / 前端映射中文提示

export const ERROR_CODES = {
  // 通用
  VALIDATION_FAILED: { status: 422, message: "请求参数校验失败" },
  RESOURCE_NOT_FOUND: { status: 404, message: "资源不存在" },
  PERMISSION_DENIED: { status: 403, message: "没有权限执行该操作" },
  TENANT_REQUIRED: { status: 400, message: "缺少组织上下文" },
  RATE_LIMIT_EXCEEDED: { status: 429, message: "请求过于频繁，请稍后再试" },
  IDEMPOTENCY_CONFLICT: { status: 409, message: "幂等键冲突：相同的键提交了不同内容" },
  CONFLICT: { status: 409, message: "资源状态冲突" },
  INTERNAL_ERROR: { status: 500, message: "服务器内部错误" },

  // 认证
  AUTH_REQUIRED: { status: 401, message: "请先登录" },
  AUTH_INVALID_CREDENTIALS: { status: 401, message: "邮箱或密码错误" },
  AUTH_SESSION_EXPIRED: { status: 401, message: "登录已过期，请重新登录" },
  AUTH_ACCOUNT_DISABLED: { status: 403, message: "账号已被禁用" },
  AUTH_EMAIL_EXISTS: { status: 409, message: "该邮箱已注册" },

  // 业务
  INVALID_STATUS_TRANSITION: { status: 409, message: "非法的状态变更" },
  CAMPAIGN_BUDGET_EXCEEDED: { status: 409, message: "超出 Campaign 预算" },
  CREATOR_BLACKLISTED: { status: 409, message: "该达人在黑名单中" },
  APPROVAL_REQUIRED: { status: 409, message: "该操作需要审批" },
  APPROVAL_ALREADY_DECIDED: { status: 409, message: "该审批已被处理" },
  CONTENT_BLOCKING_FINDINGS: { status: 409, message: "内容命中必须修改的确定性规则" },
  CONTENT_OVERRIDE_REQUIRED: { status: 422, message: "批准高风险内容必须填写覆盖说明" },
  CONTENT_APPROVAL_EVIDENCE_INVALID: { status: 409, message: "内容审批证据无效" },

  // AI
  AI_BUDGET_EXCEEDED: { status: 429, message: "本月 AI 预算已用尽" },
  AI_PROVIDER_ERROR: { status: 502, message: "AI 服务调用失败" },
  AI_PROVIDER_NOT_CONFIGURED: { status: 503, message: "AI Provider 未配置" },
  AI_OUTPUT_INVALID: { status: 502, message: "AI 输出格式不合法" },
  WORKFLOW_NOT_RESUMABLE: { status: 409, message: "工作流当前状态不可恢复" },

  // 知识库
  KNOWLEDGE_DOCUMENT_NOT_READY: { status: 409, message: "文档尚未索引完成" },
  KNOWLEDGE_NO_CONTEXT: { status: 200, message: "知识库中没有相关内容" },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function errorHttpStatus(code: ErrorCode): number {
  return ERROR_CODES[code].status;
}

export function errorMessage(code: ErrorCode): string {
  return ERROR_CODES[code].message;
}
