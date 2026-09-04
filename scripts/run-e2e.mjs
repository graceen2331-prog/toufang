import { execFile, spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { promisify } from "node:util";
import { config as loadDotenv } from "dotenv";
import {
  assertOwnedRuntimeDirectory,
  assertOwnedRuntimeTsconfig,
  assertSafeE2ETargets,
  createE2ERunId,
  createRuntimeLayout,
  resolveE2EMode,
} from "./lib/e2e-environment.mjs";

loadDotenv({ quiet: true });

const projectRoot = process.cwd();
const requestedPort = Number(process.env.E2E_PORT ?? 3000);
const args = process.argv.slice(2);
const runId = createE2ERunId();
const runtime = createRuntimeLayout(projectRoot, runId);
const children = new Set();
const execFileAsync = promisify(execFile);
let composeOwned = false;
let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortListening(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    let settled = false;
    const finish = (listening) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(300);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function isPortAvailable(port) {
  const listeners = await Promise.all([
    isPortListening(port, "127.0.0.1"),
    isPortListening(port, "::1"),
  ]);
  return listeners.every((listening) => !listening);
}

async function pickPort() {
  if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
    throw new Error("E2E_PORT 必须是合法端口");
  }
  if (process.env.E2E_PORT) {
    if (!(await isPortAvailable(requestedPort))) {
      throw new Error(`E2E_PORT=${requestedPort} 已被占用`);
    }
    return requestedPort;
  }
  for (let port = requestedPort; port < requestedPort + 30; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`找不到可用端口（从 ${requestedPort} 起扫描 30 个端口）`);
}

function signalChild(child, signal) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (!(error instanceof Error) || !Reflect.has(error, "code") || error.code !== "ESRCH")
      throw error;
  }
}

function spawnChild(name, command, commandArgs, env, { allowExit = false } = {}) {
  const child = spawn(command, commandArgs, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
    shell: false,
    detached: process.platform !== "win32",
  });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (allowExit || shuttingDown) return;
    console.error(`[e2e] ${name} 提前退出：${signal ?? code ?? "unknown"}`);
    void shutdown(code ?? 1);
  });
  return child;
}

async function runForeground(name, command, commandArgs, env) {
  const child = spawnChild(name, command, commandArgs, env, { allowExit: true });
  const result = await new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
    child.once("error", (error) => resolve({ code: 1, error }));
  });
  if (result.code !== 0) {
    const detail =
      result.error instanceof Error ? result.error.message : (result.signal ?? result.code);
    throw new Error(`${name} 执行失败：${detail}`);
  }
}

async function waitForServer(baseURL) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseURL, { redirect: "manual" });
      if (response.status < 500 && response.headers.get("x-e2e-run-id") === runId) return;
    } catch {
      // E2E Next 尚未就绪。
    }
    await sleep(500);
  }
  throw new Error(`等待 E2E Next 服务超时：${baseURL}`);
}

async function warmLoginPage(baseURL) {
  const response = await fetch(`${baseURL}/login`);
  if (response.status >= 500 || response.headers.get("x-e2e-run-id") !== runId) {
    throw new Error("E2E 登录页预热失败或连接到了错误服务");
  }
  await response.text();
  await sleep(300);
}

async function publishedPort(service, containerPort) {
  const { stdout } = await execFileAsync(
    "docker",
    [
      "compose",
      "-p",
      runtime.composeProject,
      "--profile",
      "e2e",
      "port",
      service,
      String(containerPort),
    ],
    { cwd: projectRoot, maxBuffer: 1024 * 1024 },
  );
  const match = stdout.trim().match(/:(\d+)$/);
  if (!match) throw new Error(`无法读取 ${service} 的随机发布端口`);
  return Number(match[1]);
}

async function createLocalInfrastructure() {
  composeOwned = true;
  await runForeground(
    "E2E 基础设施",
    "docker",
    [
      "compose",
      "-p",
      runtime.composeProject,
      "--profile",
      "e2e",
      "up",
      "-d",
      "--wait",
      "postgres-e2e",
      "redis-e2e",
    ],
    process.env,
  );
  const [postgresPort, redisPort] = await Promise.all([
    publishedPort("postgres-e2e", 5432),
    publishedPort("redis-e2e", 6379),
  ]);
  return {
    databaseUrl: `postgresql://toufang_e2e:toufang_e2e@127.0.0.1:${postgresPort}/toufang_e2e`,
    redisUrl: `redis://127.0.0.1:${redisPort}/0`,
  };
}

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      signalChild(child, "SIGKILL");
      resolve();
    }, 5000);
    timeout.unref();
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    signalChild(child, "SIGTERM");
  });
}

async function removeOwnedInfrastructure() {
  if (!composeOwned) return;
  try {
    await execFileAsync(
      "docker",
      ["compose", "-p", runtime.composeProject, "--profile", "e2e", "down", "--volumes"],
      { cwd: projectRoot, timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
  } catch (error) {
    console.error(
      `[e2e] 清理 Compose project 失败：${error instanceof Error ? error.message : error}`,
    );
  }
}

async function removeOwnedDistDir() {
  try {
    const ownedPath = assertOwnedRuntimeDirectory(projectRoot, runId, runtime.absoluteDistDir);
    await rm(ownedPath, { recursive: true, force: true });
    const ownedTsconfig = assertOwnedRuntimeTsconfig(
      projectRoot,
      runId,
      runtime.absoluteTsconfigPath,
    );
    await rm(ownedTsconfig, { force: true });
  } catch (error) {
    console.error(
      `[e2e] 清理 Next 运行目录失败：${error instanceof Error ? error.message : error}`,
    );
  }
}

async function createRuntimeTsconfig() {
  const tsconfig = {
    extends: "./tsconfig.json",
    include: [
      "next-env.d.ts",
      "**/*.ts",
      "**/*.tsx",
      "**/*.mts",
      `${runtime.relativeDistDir}/types/**/*.ts`,
      `${runtime.relativeDistDir}/dev/types/**/*.ts`,
    ],
  };
  await writeFile(runtime.absoluteTsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.all([...children].map(stopChild));
  await removeOwnedInfrastructure();
  await removeOwnedDistDir();
  process.exit(code);
}

async function main() {
  const mode = resolveE2EMode(process.env);
  const target =
    mode === "local-compose"
      ? await createLocalInfrastructure()
      : {
          databaseUrl: process.env.E2E_DATABASE_URL.trim(),
          redisUrl: process.env.E2E_REDIS_URL.trim(),
        };

  const safeTargets = assertSafeE2ETargets({
    ...target,
    mainDatabaseUrl: process.env.DATABASE_URL,
    mainRedisUrl: process.env.REDIS_URL,
  });
  console.log(
    `[e2e] 隔离模式=${mode} run=${runId} database=${safeTargets.database.hostname}:${safeTargets.database.port}/${safeTargets.database.database} redis=${safeTargets.redis.hostname}:${safeTargets.redis.port}/${safeTargets.redis.database}`,
  );

  const port = await pickPort();
  const baseURL = `http://localhost:${port}`;
  const env = {
    ...process.env,
    DATABASE_URL: target.databaseUrl,
    REDIS_URL: target.redisUrl,
    QUEUE_PREFIX: runtime.queuePrefix,
    NEXT_DIST_DIR: runtime.relativeDistDir,
    NEXT_TSCONFIG_PATH: runtime.relativeTsconfigPath,
    MODEL_PROVIDER: "fake",
    E2E_FORCE_FAKE_PROVIDER: "1",
    E2E_RUN_ID: runId,
    E2E_BASE_URL: baseURL,
    APP_ORIGIN: baseURL,
    E2E_MANAGED_SERVER: "1",
  };

  if (mode === "external" && process.env.E2E_RESET_DATABASE === "1") {
    console.log("[e2e] 已显式授权重建外部专用测试库");
    await runForeground(
      "重建 E2E 数据库",
      "pnpm",
      ["exec", "prisma", "migrate", "reset", "--force"],
      env,
    );
  } else {
    await runForeground("迁移 E2E 数据库", "pnpm", ["exec", "prisma", "migrate", "deploy"], env);
  }
  await runForeground("写入 E2E 演示数据", "pnpm", ["seed"], env);
  await createRuntimeTsconfig();

  spawnChild("next-dev", "pnpm", ["exec", "next", "dev", "-p", String(port)], env);
  spawnChild("worker", "pnpm", ["dev:worker"], env);
  await waitForServer(baseURL);
  await warmLoginPage(baseURL);

  const tests = spawnChild("playwright", "pnpm", ["exec", "playwright", "test", ...args], env, {
    allowExit: true,
  });
  tests.on("exit", (code, signal) => void shutdown(code ?? (signal ? 1 : 0)));
}

process.on("SIGINT", () => void shutdown(130));
process.on("SIGTERM", () => void shutdown(143));

main().catch((error) => {
  console.error(`[e2e] 启动失败：${error instanceof Error ? error.message : String(error)}`);
  void shutdown(1);
});
