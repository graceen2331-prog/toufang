# E2E 环境隔离

`pnpm e2e` 默认不会连接 `.env` 中的开发数据库和 Redis。Runner 会为每次执行创建唯一的 Docker Compose project，并使用以下隔离资源：

- tmpfs PostgreSQL：运行开始时执行真实迁移并写入演示数据，结束后随 Compose project 销毁；
- tmpfs Redis：关闭 RDB/AOF，并为 BullMQ 设置本次运行唯一的 `QUEUE_PREFIX`；
- 独立 Next.js `distDir`：位于 `.next-e2e/<run-id>`，不会占用当前开发服务的 `.next/dev/lock`；
- 强制 fake 模型：自动验收不会调用真实模型，也不会进入开发环境的用量统计。

因此可以在 `pnpm dev` 和 `pnpm dev:worker` 仍运行时执行：

```bash
pnpm e2e e2e/dashboard-role-workspaces.spec.ts
```

测试成功、失败或收到 `SIGINT` / `SIGTERM` 后，Runner 只会停止自己启动的进程组、销毁精确的随机 Compose project，并删除本次 run-id 对应的构建目录。它不会扫描或停止其他 Next.js、Worker 或容器进程。

## CI 外部隔离模式

CI 可以提供每个 job 独享的连接：

```bash
E2E_DATABASE_URL='postgresql://user:password@db/app_e2e' \
E2E_REDIS_URL='redis://cache:6379/2' \
pnpm e2e
```

两个变量必须同时提供。数据库名必须包含独立的 `e2e` 或 `test` 标记，并且数据库、Redis 均不能与 `DATABASE_URL` / `REDIS_URL` 指向同一目标。Runner 比较目标时会忽略用户名、密码和查询参数，避免通过改写连接字符串绕过保护。

外部模式默认只执行 `prisma migrate deploy` 和幂等 seed，不销毁外部资源。CI 应为每个 job 分配全新数据库和 Redis。只有外部资源明确可销毁时，才允许显式设置：

```bash
E2E_RESET_DATABASE=1 pnpm e2e
```

该开关仍需通过全部目标校验。禁止将任何生产或开发连接伪装成测试库后启用 reset。

## 异常遗留处理

宿主机断电或 `SIGKILL` 无法执行退出清理。日志会打印不含凭证的 `run` 标识；只允许针对该标识执行精确清理：

```bash
docker compose -p toufang-e2e-<run-id> --profile e2e down --volumes
```

不要使用模糊容器匹配、`--remove-orphans` 或批量删除所有 `toufang-e2e-*` project。
