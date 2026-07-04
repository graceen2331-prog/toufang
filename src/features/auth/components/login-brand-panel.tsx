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

const footerNotes = ["演示工作区", "审批留痕", "多组织权限"];

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
      </div>

      <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-emerald-100/38 lg:mt-0">
        {footerNotes.map((note) => (
          <span key={note}>{note}</span>
        ))}
      </div>
    </section>
  );
}
