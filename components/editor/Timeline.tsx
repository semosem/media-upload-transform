import type { TimelineClip } from "@/components/types/types";

type TimelineProps = {
  clips: TimelineClip[];
};

export const Timeline = ({ clips }: TimelineProps) => {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 lg:h-40 lg:shrink-0">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Timeline</h2>
        <div className="flex gap-2 text-[10px] text-white/60">
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            00:00
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            02:10
          </span>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <div className="flex items-center gap-2 text-[10px] text-white/50">
          <span className="w-20">Video</span>
          <div className="h-2 flex-1 rounded-full bg-white/10" />
        </div>
        <div className="flex flex-wrap gap-3">
          {clips.map((clip) => (
            <div
              key={clip.label}
              className={`flex-1 min-w-[120px] rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 ${clip.color}`}>
              {clip.label}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/50">
          <span className="w-20">Audio</span>
          <div className="h-2 flex-1 rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
};
