import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,color-mix(in_oklch,var(--primary),transparent_86%),transparent_34%),radial-gradient(circle_at_80%_75%,color-mix(in_oklch,var(--primary),transparent_92%),transparent_28%)]" />
      <section className="relative w-full max-w-2xl border border-foreground/10 bg-card/90 p-8 shadow-[0_28px_90px_rgba(8,28,20,0.12)] backdrop-blur sm:p-12">
        <p className="font-mono text-sm tracking-[0.22em] text-primary">ERROR / 404</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          这个页面不在当前工作区
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground text-pretty">
          链接可能已失效，或你没有访问该业务对象的入口。可以返回工作台继续处理待办。
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-px"
          >
            返回工作台
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center border border-border px-4 text-sm font-medium text-foreground transition hover:border-primary/35 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-px"
          >
            重新登录
          </Link>
        </div>
      </section>
    </main>
  );
}
