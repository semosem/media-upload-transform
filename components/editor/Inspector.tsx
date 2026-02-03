import type {
  GradeSettings,
  InspectorSetting,
  QuickLook,
} from "@/components/types/types";

type InspectorProps = {
  inspectorSettings: InspectorSetting[];
  showEnhance: boolean;
  onToggleEnhance: () => void;
  onResetEnhance: () => void;
  quickLooks: QuickLook[];
  activeLook: QuickLook;
  onSelectLook: (look: QuickLook) => void;
  onInspectorChange: (id: InspectorSetting["id"], value: number) => void;
  showColorGrade: boolean;
  onToggleColorGrade: () => void;
  grade: GradeSettings;
  onGradeChange: (next: GradeSettings) => void;
  onResetGrade: () => void;
  overlayText: string;
  overlayOpacity: number;
  showOverlay: boolean;
  onOverlayTextChange: (value: string) => void;
  onOverlayOpacityChange: (value: number) => void;
  onShowOverlayChange: (value: boolean) => void;
};

export const Inspector = ({
  inspectorSettings,
  showEnhance,
  onToggleEnhance,
  onResetEnhance,
  quickLooks,
  activeLook,
  onSelectLook,
  onInspectorChange,
  showColorGrade,
  onToggleColorGrade,
  grade,
  onGradeChange,
  onResetGrade,
  overlayText,
  overlayOpacity,
  showOverlay,
  onOverlayTextChange,
  onOverlayOpacityChange,
  onShowOverlayChange,
}: InspectorProps) => {
  const sliderBackground = (value: number, min: number, max: number) => {
    const clamped = Math.min(Math.max(value, min), max);
    const percent = ((clamped - min) / (max - min)) * 100;
    return {
      background: `linear-gradient(90deg, rgba(56, 189, 248, 0.95) 0%, rgba(99, 102, 241, 0.95) ${percent}%, rgba(255, 255, 255, 0.12) ${percent}%, rgba(255, 255, 255, 0.12) 100%)`,
    };
  };

  const tierLabel = (value: number) => {
    if (value < 34) return "Low";
    if (value < 67) return "Medium";
    return "High";
  };

  const exposureLabel = (value: number) => {
    if (value < 0.92) return "Low";
    if (value > 1.08) return "High";
    return "Neutral";
  };

  const contrastLabel = (value: number) => {
    if (value < 0.92) return "Soft";
    if (value > 1.12) return "Hard";
    return "Neutral";
  };

  const saturationLabel = (value: number) => {
    if (value < 0.9) return "Muted";
    if (value > 1.25) return "Vivid";
    return "Neutral";
  };

  const hueLabel = (value: number) => {
    if (value < -10) return "Cool";
    if (value > 10) return "Warm";
    return "Neutral";
  };

  return (
    <aside className="fade-up stagger-3 flex min-h-0 flex-col rounded-3xl border border-white/10 bg-white/5 p-0 lg:overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-white/5 px-4 pb-3 pt-4 backdrop-blur">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
          Inspector
        </p>
        <h2 className="text-base font-semibold text-white">Color & Motion</h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 pt-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] text-white/60">
            <span className="uppercase tracking-[0.2em] text-white/50">
              Enhance
            </span>
            <button
              type="button"
              aria-expanded={showEnhance}
              onClick={onToggleEnhance}
              className="flex h-7 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:border-cyan-400/60 hover:text-white">
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className={`h-3.5 w-3.5 transition ${showEnhance ? "rotate-180" : "rotate-0"}`}
                fill="none">
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {showEnhance ? (
            <div className="flex flex-col gap-3 pt-1 text-[10px] text-white/70">
              {inspectorSettings.map((setting) => {
                const min = setting.min ?? 0;
                const max = setting.max ?? 100;
                return (
                  <div key={setting.label} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-white/60">
                      <span className="uppercase tracking-[0.2em] text-white/50">
                        {setting.label}
                      </span>
                      <span className="text-white/40">
                        {tierLabel(setting.value)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={1}
                      value={setting.value}
                      onChange={(event) =>
                        onInspectorChange(
                          setting.id,
                          Number(event.target.value),
                        )
                      }
                      className="h-1 w-full cursor-pointer appearance-none rounded-full"
                      style={sliderBackground(setting.value, min, max)}
                    />
                  </div>
                );
              })}
              <button
                type="button"
                onClick={onResetEnhance}
                className="self-start rounded-full border border-white/10 px-3 py-1 uppercase tracking-[0.2em] text-white/40 transition hover:border-cyan-400/40 hover:text-white/70">
                Reset Enhance
              </button>
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
              Quick Looks
            </p>
            <div className="grid grid-cols-2 gap-3 pb-1 text-[10px]">
              {quickLooks.map((look) => {
                const isActive = activeLook.label === look.label;
                return (
                  <button
                    key={look.label}
                    type="button"
                    onClick={() => onSelectLook(look)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      isActive
                        ? "border-cyan-400/70 bg-cyan-400/20 text-white"
                        : "border-white/10 bg-white/10 text-white/80 hover:border-cyan-400/40"
                    }`}>
                    <span className="block font-medium">{look.label}</span>
                    <span className="text-[10px] text-white/60">
                      {look.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] text-white/60">
            <span className="uppercase tracking-[0.2em] text-white/50">
              Color Grade
            </span>
            <button
              type="button"
              aria-expanded={showColorGrade}
              onClick={onToggleColorGrade}
              className="flex h-7 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:border-cyan-400/60 hover:text-white">
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className={`h-3.5 w-3.5 transition ${showColorGrade ? "rotate-180" : "rotate-0"}`}
                fill="none">
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {showColorGrade ? (
            <div className="flex flex-col gap-3 pt-1 text-[10px] text-white/70">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span className="uppercase tracking-[0.2em] text-white/50">
                    Exposure
                  </span>
                  <span className="text-white/40">
                    {exposureLabel(grade.brightness)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.01}
                  value={grade.brightness}
                  onChange={(event) =>
                    onGradeChange({
                      ...grade,
                      brightness: Number(event.target.value),
                    })
                  }
                  className="h-1 w-full cursor-pointer appearance-none rounded-full"
                  style={sliderBackground(grade.brightness, 0.7, 1.3)}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span className="uppercase tracking-[0.2em] text-white/50">
                    Contrast
                  </span>
                  <span className="text-white/40">
                    {contrastLabel(grade.contrast)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.4}
                  step={0.01}
                  value={grade.contrast}
                  onChange={(event) =>
                    onGradeChange({
                      ...grade,
                      contrast: Number(event.target.value),
                    })
                  }
                  className="h-1 w-full cursor-pointer appearance-none rounded-full"
                  style={sliderBackground(grade.contrast, 0.7, 1.4)}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span className="uppercase tracking-[0.2em] text-white/50">
                    Saturation
                  </span>
                  <span className="text-white/40">
                    {saturationLabel(grade.saturation)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.8}
                  step={0.01}
                  value={grade.saturation}
                  onChange={(event) =>
                    onGradeChange({
                      ...grade,
                      saturation: Number(event.target.value),
                    })
                  }
                  className="h-1 w-full cursor-pointer appearance-none rounded-full"
                  style={sliderBackground(grade.saturation, 0.5, 1.8)}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span className="uppercase tracking-[0.2em] text-white/50">
                    Hue
                  </span>
                  <span className="text-white/40">{hueLabel(grade.hue)}</span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={1}
                  value={grade.hue}
                  onChange={(event) =>
                    onGradeChange({
                      ...grade,
                      hue: Number(event.target.value),
                    })
                  }
                  className="h-1 w-full cursor-pointer appearance-none rounded-full"
                  style={sliderBackground(grade.hue, -30, 30)}
                />
              </div>
              <button
                type="button"
                onClick={onResetGrade}
                className="self-start rounded-full border border-white/10 px-3 py-1 uppercase tracking-[0.2em] text-white/40 transition hover:border-cyan-400/40 hover:text-white/70">
                Reset Grade
              </button>
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
            Overlay
          </p>
          <div className="mt-3 flex flex-col gap-3 text-[10px] text-white/70">
            <label className="flex items-center justify-between gap-3">
              <span>Show title</span>
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={(event) => onShowOverlayChange(event.target.checked)}
                className="h-4 w-4 rounded border border-white/20 bg-transparent"
              />
            </label>
            <input
              type="text"
              value={overlayText}
              onChange={(event) => onOverlayTextChange(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] text-white"
              placeholder="Overlay title"
            />
            <label className="flex items-center justify-between gap-3">
              <span>Opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={overlayOpacity}
                onChange={(event) =>
                  onOverlayOpacityChange(Number(event.target.value))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
              />
            </label>
          </div>
        </div>
        <div className="mt-auto rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/70 to-slate-900/20 p-4 text-[10px] text-white/70">
          Canvas pipeline synced. Preview renders locally.
        </div>
      </div>
    </aside>
  );
};
