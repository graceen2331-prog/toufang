import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { config as loadDotenv } from "dotenv";
import {
  assertSafeE2ETargets,
  createE2ERunId,
  createIsolatedTestSecurityEnv,
  createRuntimeLayout,
  resolveE2EMode,
} from "./lib/e2e-environment.mjs";

loadDotenv({ quiet: true });

const projectRoot = process.cwd();
const runId = createE2ERunId();
const runtime = createRuntimeLayout(projectRoot, runId);
const execFileAsync = promisify(execFile);
const integrationTests = [
  "src/server/modules/analytics/analytics-report.integration.test.ts",
  "src/server/modules/contract/payment-integrity.integration.test.ts",
  "src/server/modules/content/content-approval.integration.test.ts",
  "src/server/modules/brand-lead/brand-lead-conversion.integration.test.ts",
  "src/server/workflows/engine.integration.test.ts",
];

let activeChild;
let composeOwned = false;
let shuttingDown = false;

function signalChild(child, signal) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (!(error instanceof Error) || !Reflect.has(error, "code") || error.code !== "ESRCH") {
      throw error;
    }
  }
}

async function runCommand(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
    shell: false,
    detached: process.platform !== "win32",
  });
  activeChild = child;
  const result = await new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
    child.once("error", (error) => resolve({ code: 1, error }));
  });
  if (activeChild === child) activeChild = undefined;
  if (result.code !== 0) {
    const detail =
      result.error instanceof Error ? result.error.message : (result.signal ?? result.code);
    throw new Error(`${name} 执行失败：${detail}`);
  }
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
  await runCommand(
    "集成测试基础设施",
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

async function stopActiveChild() {
  const child = activeChild;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
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
      `[integration] 清理 Compose project 失败：${error instanceof Error ? error.message : error}`,
    );
  }
}

async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopActiveChild();
  await removeOwnedInfrastructure();
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
    `[integration] 隔离模式=${mode} run=${runId} database=${safeTargets.database.hostname}:${safeTargets.database.port}/${safeTargets.database.database} redis=${safeTargets.redis.hostname}:${safeTargets.redis.port}/${safeTargets.redis.database}`,
  );

  const env = {
    ...process.env,
    ...createIsolatedTestSecurityEnv(mode),
    DATABASE_URL: target.databaseUrl,
    REDIS_URL: target.redisUrl,
    QUEUE_PREFIX: runtime.queuePrefix,
    MODEL_PROVIDER: "fake",
    E2E_FORCE_FAKE_PROVIDER: "1",
    RUN_INTEGRATION_TESTS: "1",
  };
  await runCommand("迁移集成测试数据库", "pnpm", ["exec", "prisma", "migrate", "deploy"], env);
  await runCommand("数据库集成测试", "pnpm", ["exec", "vitest", "run", ...integrationTests], env);
}

process.on("SIGINT", () => void shutdown(130));
process.on("SIGTERM", () => void shutdown(143));

main()
  .then(() => shutdown(0))
  .catch((error) => {
    console.error(
      `[integration] 启动失败：${error instanceof Error ? error.message : String(error)}`,
    );
    void shutdown(1);
  });
