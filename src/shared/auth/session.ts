export const LEGACY_SESSION_COOKIE = "tf_session";

export function sessionCookieName(env: NodeJS.ProcessEnv = process.env): string {
  return env.NODE_ENV === "production" ? "__Host-tf_session" : LEGACY_SESSION_COOKIE;
}

export const SESSION_COOKIE = sessionCookieName();
