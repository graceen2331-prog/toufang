import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";
import { promisify } from "node:util";

const requestedPort = Number(process.env.E2E_PORT ?? 3000);
const args = process.argv.slice(2);
const children = new Set();
let shuttingDown = false;
const execFileAsync = promisify(execFile);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

async function pickPort() {
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

async function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stopExistingNextDev() {
  let raw;
  try {
    raw = await readFile(".next/dev/lock", "utf8");
  } catch {
    return;
  }

  let lock;
  try {
    lock = JSON.parse(raw);
  } catch {
    return;
  }

  const pid = Number(lock.pid);
  if (!Number.isInteger(pid) || pid <= 0 || !(await processExists(pid))) return;

  console.log(`[e2e] 停止当前项目已有 Next dev server：pid=${pid}`);
  process.kill(pid, "SIGTERM");
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!(await processExists(pid))) return;
    await sleep(200);
  }
  if (await processExists(pid)) {
    process.kill(pid, "SIGKILL");
  }
}

async function stopExistingProjectWorkers() {
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync("ps", ["-axo", "pid=,command="], {
      maxBuffer: 1024 * 1024,
    }));
  } catch {
    return;
  }

  const cwd = process.cwd();
  const pids = stdout
    .split("\n")
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (!match) return null;
      const pid = Number(match[1]);
      const command = match[2];
      if (pid === process.pid) return null;
      if (!command.includes(cwd) || !command.includes("src/worker/index.ts")) return null;
      return pid;
    })
    .filter((pid) => Number.isInteger(pid));

  for (const pid of pids) {
    console.log(`[e2e] 停止当前项目已有 worker：pid=${pid}`);
    process.kill(pid, "SIGTERM");
  }

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const stillRunning = [];
    for (const pid of pids) {
      if (await processExists(pid)) stillRunning.push(pid);
    }
    if (stillRunning.length === 0) return;
    await sleep(200);
  }

  for (const pid of pids) {
    if (await processExists(pid)) process.kill(pid, "SIGKILL");
  }
}

function spawnChild(name, command, commandArgs, env, options = {}) {
  const child = spawn(command, commandArgs, {
    env,
    stdio: "inherit",
    shell: false,
  });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (options.allowExit) return;
    if (shuttingDown) return;
    console.error(`[e2e] ${name} 提前退出：${signal ?? code ?? "unknown"}`);
    void shutdown(code ?? 1);
  });
  return child;
}

async function waitForServer(baseURL) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseURL, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // dev server 还没起来，继续等
    }
    await sleep(500);
  }
  throw new Error(`等待 Next dev server 超时：${baseURL}`);
}

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null || child.killed) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      resolve();
    }, 3000);
    timeout.unref();
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.all([...children].map(stopChild));
  process.exit(code);
}

try {
  await stopExistingNextDev();
  await stopExistingProjectWorkers();
  const port = await pickPort();
  const baseURL = `http://localhost:${port}`;
  const env = {
    ...process.env,
    MODEL_PROVIDER: process.env.MODEL_PROVIDER ?? "fake",
    E2E_BASE_URL: baseURL,
    E2E_MANAGED_SERVER: "1",
  };

  spawnChild("next-dev", "pnpm", ["exec", "next", "dev", "-p", String(port)], env);
  spawnChild("worker", "pnpm", ["dev:worker"], env);
  await waitForServer(baseURL);

  const tests = spawnChild("playwright", "pnpm", ["exec", "playwright", "test", ...args], env, {
    allowExit: true,
  });
  tests.on("exit", (code, signal) => {
    void shutdown(code ?? (signal ? 1 : 0));
  });
} catch (err) {
  console.error(`[e2e] 启动失败：${err instanceof Error ? err.message : String(err)}`);
  await shutdown(1);
}

process.on("SIGINT", () => void shutdown(130));
process.on("SIGTERM", () => void shutdown(143));
