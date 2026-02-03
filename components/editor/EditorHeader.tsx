import type { ReactNode } from "react";

type EditorHeaderProps = {
  showInspector: boolean;
  onToggleInspector: () => void;
  actions?: ReactNode;
};

export const EditorHeader = ({
  showInspector,
  onToggleInspector,
  actions,
}: EditorHeaderProps) => {
  return (
    <header className="fade-up sticky top-0 z-20 flex w-full flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-6 py-3 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.7)] backdrop-blur lg:px-10">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-900">
          <span className="text-lg font-semibold">CC</span>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/80">
            Cloudinary Studio
          </p>
          <h1 className="text-xl font-semibold text-white">CloudCut Editor</h1>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <button
          className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-white/80 transition hover:bg-white/20"
          onClick={onToggleInspector}
        >
          {showInspector ? "Hide Inspector" : "Show Inspector"}
        </button>
        {actions}
      </div>
    </header>
  );
};
