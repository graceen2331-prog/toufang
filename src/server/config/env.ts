import "server-only";

const PLACEHOLDER_MARKERS = ["change-me", "example", "placeholder", "dev-"];

function secretIssue(name: string, value: string | undefined): string | null {
  if (!value) return `${name} 未配置`;
  if (Buffer.byteLength(value, "utf8") < 32) return `${name} 必须至少 32 字节`;
  if (PLACEHOLDER_MARKERS.some((marker) => value.toLowerCase().includes(marker))) {
    return `${name} 不能使用示例或开发默认值`;
  }
  return null;
}

function urlIssue(
  name: string,
  value: string | undefined,
  protocols: string[],
): string | null {
  if (!value) return `${name} 未配置`;
  try {
    const parsed = new URL(value);
    if (!protocols.includes(parsed.protocol)) return `${name} 协议不受支持`;
    if (
      name === "APP_ORIGIN" &&
      (parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password)
    ) {
      return "APP_ORIGIN 必须只包含 HTTPS 协议、主机和可选端口";
    }
    return null;
  } catch {
    return `${name} 不是合法 URL`;
  }
}

export function productionEnvironmentIssues(env: NodeJS.ProcessEnv): string[] {
  const issues = [
    urlIssue("DATABASE_URL", env.DATABASE_URL, ["postgres:", "postgresql:"]),
    urlIssue("REDIS_URL", env.REDIS_URL, ["redis:", "rediss:"]),
    urlIssue("APP_ORIGIN", env.APP_ORIGIN, ["https:"]),
    secretIssue("DATA_ENCRYPTION_KEY", env.DATA_ENCRYPTION_KEY),
    secretIssue("PAYMENT_FINGERPRINT_KEY", env.PAYMENT_FINGERPRINT_KEY),
    secretIssue("AUTH_RATE_LIMIT_HMAC_KEY", env.AUTH_RATE_LIMIT_HMAC_KEY),
  ].filter((issue): issue is string => Boolean(issue));

  const securitySecrets = [
    env.DATA_ENCRYPTION_KEY,
    env.PAYMENT_FINGERPRINT_KEY,
    env.AUTH_RATE_LIMIT_HMAC_KEY,
  ].filter((value): value is string => Boolean(value));
  if (new Set(securitySecrets).size !== securitySecrets.length) {
    issues.push("数据加密、付款指纹与登录限流密钥不得复用");
  }

  const ipHeader = env.AUTH_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (!ipHeader) issues.push("AUTH_CLIENT_IP_HEADER 未配置");
  else if (
    !/^[a-z0-9-]+$/.test(ipHeader) ||
    ["authorization", "cookie", "host", "x-forwarded-for"].includes(ipHeader)
  ) {
    issues.push("AUTH_CLIENT_IP_HEADER 必须是可信入口覆盖的单值请求头，不能直接使用 x-forwarded-for");
  }
  if (env.ENABLE_DEMO_LOGIN === "true") issues.push("生产环境不能启用 ENABLE_DEMO_LOGIN");

  const absoluteHours = Number(env.SESSION_ABSOLUTE_TTL_HOURS ?? "12");
  const idleHours = Number(env.SESSION_IDLE_TTL_HOURS ?? "2");
  if (!Number.isFinite(absoluteHours) || absoluteHours <= 0 || absoluteHours > 24) {
    issues.push("SESSION_ABSOLUTE_TTL_HOURS 必须在 0 到 24 之间");
  }
  if (!Number.isFinite(idleHours) || idleHours <= 0 || idleHours > absoluteHours) {
    issues.push("SESSION_IDLE_TTL_HOURS 必须大于 0 且不超过绝对会话期限");
  }
  return issues;
}

export function assertProductionEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;
  const issues = productionEnvironmentIssues(env);
  if (issues.length > 0) {
    throw new Error(`生产环境配置校验失败：\n- ${issues.join("\n- ")}`);
  }
}

export function sessionSecurityConfig(env: NodeJS.ProcessEnv = process.env) {
  const rawAbsoluteHours = Number(env.SESSION_ABSOLUTE_TTL_HOURS ?? "12");
  const absoluteHours = Number.isFinite(rawAbsoluteHours) && rawAbsoluteHours > 0
    ? Math.min(rawAbsoluteHours, 24)
    : 12;
  const rawIdleHours = Number(env.SESSION_IDLE_TTL_HOURS ?? "2");
  const idleHours = Number.isFinite(rawIdleHours) && rawIdleHours > 0
    ? Math.min(rawIdleHours, absoluteHours)
    : Math.min(2, absoluteHours);
  return {
    absoluteTtlMs: absoluteHours * 60 * 60 * 1000,
    idleTtlMs: idleHours * 60 * 60 * 1000,
    touchIntervalMs: 5 * 60 * 1000,
    maxActiveSessions: 5,
  };
}
