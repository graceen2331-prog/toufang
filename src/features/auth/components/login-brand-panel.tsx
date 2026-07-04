const workflowSteps = [
  "研究",
  "达人发现",
  "Shortlist",
  "Outreach",
  "谈判",
  "签约",
  "内容审核",
  "发布",
  "复盘",
];

const overviewItems = [
  { label: "验收链路", value: "8 步", detail: "从策略到报告全程可追踪" },
  { label: "审批门", value: "12", detail: "外发、合同、付款、报告留痕" },
  { label: "组织隔离", value: "2 个", detail: "星澜传媒 / 北辰品牌部" },
];

const reviewRows = [
  { title: "焕亮维C精华", status: "进行中", meta: "内容审核 + 数据复盘" },
  { title: "达人 shortlist", status: "待审批", meta: "AI 评分已完成" },
  { title: "知识问答", status: "可引用", meta: "SOP / 复盘知识卡" },
];

export function LoginBrandPanel() {
  return (
    <section className="relative isolate overflow-hidden bg-[#071a13] px-6 py-7 text-white sm:px-8 sm:py-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-16 lg:py-14">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(150deg,rgba(18,66,48,0.72),rgba(7,26,19,0.82)_45%,rgba(4,18,13,0.98))]" />
      <div className="absolute inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(rgba(235,255,247,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(235,255,247,0.14)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-[10px] bg-[#0c8b68] text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
          K
        </div>
        <div>
          <p className="text-lg font-semibold tracking-[0.01em] text-white sm:text-xl">
            KOL Marketing OS
          </p>
          <p className="mt-0.5 text-xs text-emerald-100/55">AI 原生 KOL 营销操作系统</p>
        </div>
      </div>

      <div className="mt-16 max-w-3xl lg:mt-0">
        <p className="text-xs font-medium text-emerald-200/70">GlowLab 演示工作区</p>
        <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.08] text-balance text-white sm:text-5xl lg:text-6xl">
          把 KOL 营销从表格协作升级为
          <span className="text-[#72ddb6]"> 可运营的系统</span>
        </h1>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-emerald-50/62 sm:text-base">
          市场研究、达人发现、Outreach、Brief、内容审核、合同付款到复盘报告，都沉淀在同一套可审计工作流里。
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {workflowSteps.map((step) => (
            <span
              key={step}
              className="border border-white/14 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-emerald-50/70 backdrop-blur-sm"
            >
              {step}
            </span>
          ))}
        </div>

        <div className="mt-9 hidden max-w-3xl gap-3 sm:grid sm:grid-cols-3">
          {overviewItems.map((item) => (
            <div
              key={item.label}
              className="border border-white/10 bg-white/[0.045] p-4 shadow-[0_16px_46px_rgba(0,0,0,0.16)]"
            >
              <p className="text-xs text-emerald-100/50">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{item.value}</p>
              <p className="mt-2 text-xs leading-5 text-emerald-50/55">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 hidden gap-4 lg:mt-0 lg:grid lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-xl border border-white/10 bg-[#0b231a]/70 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
            <div>
              <p className="text-xs text-emerald-100/50">工作台快照</p>
              <p className="mt-1 text-sm font-medium text-white">今日需要关注的业务对象</p>
            </div>
            <span className="bg-[#f6c761]/15 px-2 py-1 text-xs font-medium whitespace-nowrap text-[#f7d992]">
              演示数据
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {reviewRows.map((row) => (
              <div
                key={row.title}
                className="grid grid-cols-[1fr_auto] gap-3 border border-white/8 bg-white/[0.025] px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-emerald-50">{row.title}</p>
                  <p className="mt-1 text-xs text-emerald-100/48">{row.meta}</p>
                </div>
                <span className="self-start border border-emerald-200/14 px-2 py-1 text-xs text-emerald-100/72">
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="font-mono text-xs leading-6 text-emerald-100/35 lg:text-right">
          Seed v3 · PostgreSQL · MODEL_PROVIDER=fake/local
        </p>
      </div>
    </section>
  );
}
