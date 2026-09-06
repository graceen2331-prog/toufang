import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// 敏感 JSONB 字段的应用层加密（AES-256-GCM）
// 存储格式：{ __enc: "v1", iv, tag, data }（base64）

function key(): Buffer {
  const secret = process.env.DATA_ENCRYPTION_KEY;
  if (!secret) throw new Error("缺少 DATA_ENCRYPTION_KEY 环境变量");
  return createHash("sha256").update(secret).digest();
}

interface EncryptedPayload {
  __enc: "v1";
  iv: string;
  tag: string;
  data: string;
}

export function encryptJson(value: unknown): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    __enc: "v1",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  };
}

export function isEncrypted(value: unknown): value is EncryptedPayload {
  return typeof value === "object" && value !== null && (value as EncryptedPayload).__enc === "v1";
}

export function decryptJson<T>(payload: unknown): T | null {
  if (!isEncrypted(payload)) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.data, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}
