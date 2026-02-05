import { useCallback, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { TimelineClip } from "@/components/types/types";
import { formatDuration } from "@/components/editor/format";

type TimelineProps = {
  clips: TimelineClip[];
  duration: number;
  currentTime: number;
  onScrub: (time: number) => void;
};

export const Timeline = ({
  clips,
  duration,
  currentTime,
  onScrub,
}: TimelineProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const normalizedClips = useMemo(() => {
    if (!clips.length) return [];
    const hasTiming = clips.every(
      (clip) =>
        typeof clip.start === "number" && typeof clip.duration === "number",
    );
    if (hasTiming) {
      return clips.map((clip) => ({
        ...clip,
        start: clip.start ?? 0,
        duration: clip.duration ?? 0,
      }));
    }
    const fallbackDuration = duration || clips.length * 5;
    const segment = fallbackDuration / clips.length;
    return clips.map((clip, index) => ({
      ...clip,
      start: index * segment,
      duration: segment,
    }));
  }, [clips, duration]);

  const playheadPercent = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const scrubToClientX = useCallback(
    (clientX: number) => {
      if (!duration) return;
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const clamped = Math.min(1, Math.max(0, ratio));
      onScrub(clamped * duration);
    },
    [duration, onScrub],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsScrubbing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubToClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    scrubToClientX(event.clientX);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    setIsScrubbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 lg:h-40 lg:shrink-0">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Timeline</h2>
        <div className="flex gap-2 text-[10px] text-white/60">
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            {formatDuration(currentTime)}
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            {formatDuration(duration)}
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[10px] text-white/50">
          <span className="w-16">Video</span>
          <div
            ref={trackRef}
            className="relative h-14 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-2 py-2"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <div
              className="absolute inset-x-2 top-3 h-1 rounded-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(148,163,184,0.25) 0, rgba(148,163,184,0.25) 1px, transparent 1px, transparent 18px)",
              }}
            />
            {normalizedClips.map((clip, index) => {
              const safeDuration = duration || 1;
              const start = clip.start ?? 0;
              const length = clip.duration ?? 0;
              const left = (start / safeDuration) * 100;
              const width = (length / safeDuration) * 100;
              return (
                <button
                  key={`${clip.label}-${index}`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onScrub(start);
                  }}
                  className={`absolute bottom-2 top-6 rounded-2xl px-3 text-[11px] font-semibold text-slate-900 shadow-lg shadow-black/30 ${clip.color}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  {clip.label}
                </button>
              );
            })}
            <div
              className="absolute inset-y-2 w-px bg-cyan-300/80 shadow-[0_0_12px_rgba(56,189,248,0.7)]"
              style={{ left: `${playheadPercent}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/50">
          <span className="w-16">Audio</span>
          <div className="relative h-8 flex-1 rounded-2xl border border-white/10 bg-white/5">
            <div className="absolute inset-0 flex items-center px-2">
              <div className="h-1 flex-1 rounded-full bg-white/10" />
            </div>
            <div
              className="absolute inset-y-1 w-px bg-cyan-300/60"
              style={{ left: `${playheadPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
