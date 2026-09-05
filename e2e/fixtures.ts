import {
  expect,
  test as base,
  type BrowserContext,
  type ConsoleMessage,
  type Page,
} from "@playwright/test";

type BrowserRuntimeIssue = {
  kind: "pageerror" | "hydration";
  url: string;
  message: string;
  location?: string;
  stack?: string;
};

export type BrowserRuntimeGuard = {
  watchContext: (context: BrowserContext) => void;
  watchPage: (page: Page) => void;
};

function isHydrationError(message: ConsoleMessage): boolean {
  return message.type() === "error" && /hydrat(?:ion|ed|ing)/i.test(message.text());
}

function formatIssues(issues: BrowserRuntimeIssue[]): string {
  return issues
    .map((issue, index) => {
      const details = [
        `${index + 1}. [${issue.kind}] ${issue.message}`,
        `   页面：${issue.url || "about:blank"}`,
      ];
      if (issue.location) details.push(`   位置：${issue.location}`);
      if (issue.stack && issue.stack !== issue.message) details.push(`   堆栈：${issue.stack}`);
      return details.join("\n");
    })
    .join("\n\n");
}

export const test = base.extend<{ browserRuntimeGuard: BrowserRuntimeGuard }>({
  browserRuntimeGuard: [
    async ({ page }, use, testInfo) => {
      const issues: BrowserRuntimeIssue[] = [];
      const signatures = new Set<string>();
      const watchedPages = new Set<Page>();
      const watchedContexts = new Set<BrowserContext>();

      const record = (issue: BrowserRuntimeIssue) => {
        const signature = `${issue.kind}\u0000${issue.url}\u0000${issue.message}`;
        if (signatures.has(signature)) return;
        signatures.add(signature);
        issues.push(issue);
      };

      const watchPage = (target: Page) => {
        if (watchedPages.has(target)) return;
        watchedPages.add(target);
        target.on("pageerror", (error) => {
          record({
            kind: "pageerror",
            url: target.url(),
            message: error.message,
            stack: error.stack,
          });
        });
        target.on("console", (message) => {
          if (!isHydrationError(message)) return;
          const location = message.location();
          record({
            kind: "hydration",
            url: target.url(),
            message: message.text(),
            location: location.url
              ? `${location.url}:${location.lineNumber}:${location.columnNumber}`
              : undefined,
          });
        });
      };

      const watchContext = (context: BrowserContext) => {
        if (watchedContexts.has(context)) return;
        watchedContexts.add(context);
        context.pages().forEach(watchPage);
        context.on("page", watchPage);
      };

      const guard = { watchContext, watchPage };
      watchContext(page.context());
      await use(guard);

      if (issues.length === 0) return;
      const report = formatIssues(issues);
      await testInfo.attach("browser-runtime-errors", {
        body: report,
        contentType: "text/plain",
      });
      if (testInfo.errors.length === 0) {
        throw new Error(`检测到浏览器运行时错误：\n\n${report}`);
      }
    },
    { auto: true },
  ],
});

export { expect };
export type { Browser, BrowserContext, Page } from "@playwright/test";
