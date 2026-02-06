"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { formatDuration } from "@/components/editor/format";
import { useCanvasPlayer } from "@/hooks/useCanvasPlayer";

type CanvasPreviewProps = {
  title: string;
  videoSource: string;
  filter: string;
  vignette?: boolean;
  aspectRatio: "none" | "landscape" | "square" | "vertical";
  onAspectRatioChange: (
    value: "none" | "landscape" | "square" | "vertical"
  ) => void;
  cropMode: "local" | "cloudinary";
  onCropModeChange: (value: "local" | "cloudinary") => void;
  cropFocus: "auto" | "center" | "faces";
  onCropFocusChange: (value: "auto" | "center" | "faces") => void;
  onVideoError?: () => void;
  cloudinaryError?: string | null;
  onExportReady?: (handler: () => void) => void;
  onExportStateChange?: (state: ExportState) => void;
  exportFolder?: string;
  onExportComplete?: () => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onScrubReady?: (handler: (time: number) => void) => void;
  onStopReady?: (handler: () => void) => void;
  sharpenAmount: number;
  noiseAmount: number;
  stabilizeAmount: number;
  grainAmount: number;
  overlayText: string;
  overlayOpacity: number;
  showOverlay: boolean;
  showColorGrade: boolean;
  onToggleColorGrade: () => void;
};

type ExportState = {
  status: "idle" | "exporting" | "done" | "error";
  progress: number;
  message?: string;
};

export const CanvasPreview = memo(function CanvasPreview({
  title,
  videoSource,
  filter,
  vignette,
  aspectRatio,
  onAspectRatioChange,
  cropMode,
  onCropModeChange,
  cropFocus,
  onCropFocusChange,
  onVideoError,
  cloudinaryError,
  onExportReady,
  onExportStateChange,
  exportFolder,
  onExportComplete,
  onTimeUpdate,
  onDurationChange,
  onScrubReady,
  onStopReady,
  sharpenAmount,
  noiseAmount,
  stabilizeAmount,
  grainAmount,
  overlayText,
  overlayOpacity,
  showOverlay,
  showColorGrade,
  onToggleColorGrade,
}: CanvasPreviewProps) {
  const [exportState, setExportState] = useState<ExportState>({
    status: "idle",
    progress: 0,
  });
  const exportTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const endCueTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const lastCueRef = useRef(0);
  const trimDragRef = useRef<"start" | "end" | null>(null);
  const trimPointerRef = useRef<{
    id: number;
    el: HTMLDivElement | null;
  } | null>(null);
  const trimBoundsRef = useRef({ start: 0, end: 0, duration: 0 });
  const scrubberRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const endFlashRef = useRef<HTMLDivElement>(null);
  const playheadRafRef = useRef<number | null>(null);
  const lastPlayheadRef = useRef(0);
  const stopLockRef = useRef(false);
  const timelineUpdateRef = useRef(0);

  const aspectValue = useMemo(() => {
    if (aspectRatio === "none") return undefined;
    if (aspectRatio === "square") return 1;
    if (aspectRatio === "vertical") return 9 / 16;
    return 16 / 9;
  }, [aspectRatio]);

  const {
    canvasRef,
    videoRef,
    previewRef,
    isPlaying,
    duration,
    currentTime,
    canvasSize,
    previewSize,
    togglePlayback,
    pausePlayback,
    pauseAt,
    scrub,
  } = useCanvasPlayer({
    videoSource,
    filter,
    targetAspectRatio: cropMode === "local" ? aspectValue : undefined,
    sharpenAmount,
    noiseAmount,
    stabilizeAmount,
    grainAmount,
    overlayText,
    overlayOpacity,
    showOverlay,
    vignette,
  });

  const previewResolution = `${canvasSize.width}x${canvasSize.height}`;
  const previewStyle = useMemo(
    () => ({
      width: previewSize.width ? `${previewSize.width}px` : "100%",
      height: previewSize.height ? `${previewSize.height}px` : "100%",
    }),
    [previewSize]
  );

  useEffect(() => {
    if (!onTimeUpdate) return;
    if (!isPlaying) {
      onTimeUpdate(currentTime);
      return;
    }
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - timelineUpdateRef.current >= 80) {
      timelineUpdateRef.current = now;
      onTimeUpdate(currentTime);
    }
  }, [currentTime, isPlaying, onTimeUpdate]);

  useEffect(() => {
    onDurationChange?.(duration);
  }, [duration, onDurationChange]);

  useEffect(() => {
    onScrubReady?.(scrub);
  }, [onScrubReady, scrub]);

  const stopAll = useCallback(() => {
    pausePlayback();
    if (playheadRafRef.current) {
      cancelAnimationFrame(playheadRafRef.current);
      playheadRafRef.current = null;
    }
    stopLockRef.current = false;
  }, [pausePlayback]);

  useEffect(() => {
    onStopReady?.(stopAll);
  }, [onStopReady, stopAll]);
  const trimStartPercent = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (trimStart / duration) * 100));
  }, [duration, trimStart]);
  const trimEndPercent = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (trimEnd / duration) * 100));
  }, [duration, trimEnd]);

  const updateExportState = useCallback(
    (next: ExportState) => {
      setExportState(next);
      onExportStateChange?.(next);
    },
    [onExportStateChange]
  );

  const exportCut = useCallback(async () => {
    if (exportState.status === "exporting") return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    if (typeof MediaRecorder === "undefined") {
      updateExportState({
        status: "error",
        progress: 0,
        message: "Export not supported in this browser.",
      });
      return;
    }

    const supportedTypes = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType =
      supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    const chunks: BlobPart[] = [];

    const wasPlaying = !video.paused && !video.ended;
    const resumeTime = video.currentTime;
    const duration = video.duration || 0;

    const handleTimeUpdate = () => {
      if (!duration) return;
      const progress = Math.min(
        70,
        Math.round((video.currentTime / duration) * 70)
      );
      updateExportState({
        status: "exporting",
        progress,
        message: "Rendering",
      });
    };

    const cleanup = () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
        exportTimeoutRef.current = null;
      }
    };

    const handleStop = async () => {
      cleanup();
      const blob = new Blob(chunks, {
        type: recorder.mimeType || "video/webm",
      });
      const safeTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const exportName = safeTitle
        ? `${safeTitle}-${Date.now()}`
        : `cloudcut-export-${Date.now()}`;

      try {
        updateExportState({
          status: "exporting",
          progress: 70,
          message: "Uploading",
        });

        const signatureResponse = await fetch("/api/cloudinary/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folder: exportFolder ?? "cloudcut/exports",
            format: "mp4",
            publicId: exportName,
          }),
        });
        const signatureData = await signatureResponse.json();
        if (!signatureResponse.ok) {
          throw new Error(signatureData?.error ?? "Failed to sign export");
        }

        const formData = new FormData();
        formData.append("file", blob, `${exportName}.webm`);
        formData.append("api_key", signatureData.apiKey);
        formData.append("timestamp", signatureData.timestamp);
        formData.append("signature", signatureData.signature);
        if (signatureData.folder) {
          formData.append("folder", signatureData.folder);
        }
        if (signatureData.format) {
          formData.append("format", signatureData.format);
        }
        if (signatureData.publicId) {
          formData.append("public_id", signatureData.publicId);
        }
        if (signatureData.uploadPreset) {
          formData.append("upload_preset", signatureData.uploadPreset);
        }

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(
            "POST",
            `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/video/upload`
          );

          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const percent = Math.round((event.loaded / event.total) * 30);
            updateExportState({
              status: "exporting",
              progress: 70 + percent,
              message: "Uploading",
            });
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(null);
            } else {
              reject(
                new Error(
                  `Upload failed (${xhr.status}): ${xhr.responseText ?? "Unknown error"}`
                )
              );
            }
          };

          xhr.onerror = () => {
            reject(new Error("Network error while uploading export."));
          };

          xhr.send(formData);
        });

        updateExportState({ status: "done", progress: 100 });
        exportTimeoutRef.current = setTimeout(() => {
          updateExportState({ status: "idle", progress: 0 });
        }, 1500);

        onExportComplete?.();
      } catch (error) {
        updateExportState({
          status: "error",
          progress: 0,
          message:
            error instanceof Error ? error.message : "Export upload failed.",
        });
      } finally {
        scrub(resumeTime);
        if (wasPlaying) {
          void togglePlayback();
        }
      }
    };

    const handleEnded = () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = () => {
      cleanup();
      updateExportState({
        status: "error",
        progress: 0,
        message: "Export failed. Please try again.",
      });
    };

    recorder.onstop = handleStop;

    updateExportState({ status: "exporting", progress: 0, message: "Rendering" });
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    scrub(0);
    recorder.start(200);
    if (video.paused) {
      await togglePlayback();
    }
  }, [
    canvasRef,
    exportState.status,
    exportFolder,
    onExportComplete,
    scrub,
    title,
    togglePlayback,
    updateExportState,
  ]);

  useEffect(() => {
    onExportReady?.(exportCut);
  }, [exportCut, onExportReady]);

  useEffect(() => {
    if (!duration) return;
    setTrimStart(0);
    setTrimEnd(duration);
  }, [duration, videoSource]);

  useEffect(() => {
    trimBoundsRef.current = {
      start: trimStart,
      end: trimEnd,
      duration,
    };
  }, [trimStart, trimEnd, duration]);

  const applyPlayheadStyles = useCallback(
    (time: number) => {
      const safeDuration = duration || 0;
      const clampedTime = Math.min(Math.max(time, 0), safeDuration);
      const percent = safeDuration ? (clampedTime / safeDuration) * 100 : 0;
      const startPercent = safeDuration
        ? (trimStart / safeDuration) * 100
        : 0;
      const endPercent = safeDuration ? (trimEnd / safeDuration) * 100 : 0;
      const fillWidth = Math.max(
        0,
        Math.min(percent, endPercent) - startPercent,
      );

      if (playheadRef.current) {
        const scrubberWidth = scrubberRef.current?.clientWidth ?? 0;
        const x = scrubberWidth * (percent / 100);
        playheadRef.current.style.left = "0px";
        playheadRef.current.style.transform = `translate3d(${x}px, -50%, 0) translateX(-50%)`;
      }
      if (progressFillRef.current) {
        progressFillRef.current.style.left = `${startPercent}%`;
        progressFillRef.current.style.width = `${fillWidth}%`;
      }
    },
    [duration, trimEnd, trimStart],
  );

  const triggerEndCue = useCallback(() => {
    const now = Date.now();
    if (now - lastCueRef.current <= 250) return;
    lastCueRef.current = now;
    if (endFlashRef.current) {
      endFlashRef.current.classList.add("ring-1", "ring-cyan-400/60");
      if (endCueTimeoutRef.current) {
        clearTimeout(endCueTimeoutRef.current);
      }
      endCueTimeoutRef.current = setTimeout(() => {
        endFlashRef.current?.classList.remove("ring-1", "ring-cyan-400/60");
      }, 220);
    }

    if (typeof window !== "undefined") {
      try {
        const AudioContextCtor =
          (window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }).AudioContext ||
          (window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }).webkitAudioContext;
        if (AudioContextCtor) {
          const audioContext = new AudioContextCtor();
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const now = audioContext.currentTime;
          oscillator.type = "triangle";
          oscillator.frequency.setValueAtTime(660, now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.start(now);
          oscillator.stop(now + 0.13);
          oscillator.onended = () => {
            audioContext.close().catch(() => undefined);
          };
        }
      } catch {
        // Ignore audio cue failures.
      }
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !duration) {
      applyPlayheadStyles(0);
      return;
    }

    if (!isPlaying) {
      stopLockRef.current = false;
      return;
    }

    let isActive = true;
    const epsilon = 0.01;

    const tick = () => {
      if (!isActive) return;
      const activeVideo = videoRef.current;
      if (!activeVideo) return;

      const actualTime = activeVideo.currentTime || 0;
      const lastTime = lastPlayheadRef.current;
      const delta = actualTime - lastTime;

      if (Math.abs(delta) > 0.25) {
        lastPlayheadRef.current = actualTime;
      } else if (delta < -0.02) {
        // Ignore tiny backward sync drift.
      } else {
        lastPlayheadRef.current = actualTime;
      }

      const displayTime = lastPlayheadRef.current;

      if (trimEnd > 0 && displayTime >= trimEnd - epsilon) {
        if (isLooping) {
          scrub(trimStart);
          lastPlayheadRef.current = trimStart;
          applyPlayheadStyles(trimStart);
          playheadRafRef.current = requestAnimationFrame(tick);
          return;
        }

        if (!stopLockRef.current) {
          stopLockRef.current = true;
          pauseAt(trimEnd);
          lastPlayheadRef.current = trimEnd;
          applyPlayheadStyles(trimEnd);
          requestAnimationFrame(() => triggerEndCue());
        }
        return;
      }

      applyPlayheadStyles(displayTime);
      playheadRafRef.current = requestAnimationFrame(tick);
    };

    stopLockRef.current = false;
    lastPlayheadRef.current = video.currentTime || 0;
    applyPlayheadStyles(lastPlayheadRef.current);
    playheadRafRef.current = requestAnimationFrame(tick);

    return () => {
      isActive = false;
      if (playheadRafRef.current) {
        cancelAnimationFrame(playheadRafRef.current);
      }
      playheadRafRef.current = null;
    };
  }, [
    applyPlayheadStyles,
    duration,
    isLooping,
    isPlaying,
    pauseAt,
    scrub,
    trimEnd,
    trimStart,
    triggerEndCue,
    videoRef,
  ]);

  useEffect(() => {
    if (isPlaying) return;
    applyPlayheadStyles(currentTime);
    lastPlayheadRef.current = currentTime;
  }, [applyPlayheadStyles, currentTime, isPlaying]);

  useEffect(() => {
    stopLockRef.current = false;
    lastPlayheadRef.current = 0;
    timelineUpdateRef.current = 0;
    applyPlayheadStyles(0);
    if (playheadRafRef.current) {
      cancelAnimationFrame(playheadRafRef.current);
      playheadRafRef.current = null;
    }
  }, [applyPlayheadStyles, videoSource]);

  const updateTrimFromClient = useCallback(
    (type: "start" | "end", clientX: number) => {
      const scrubber = scrubberRef.current;
      if (!scrubber || !duration) return;
      const rect = scrubber.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const clampedRatio = Math.min(1, Math.max(0, ratio));
      const time = clampedRatio * duration;
      const minGap = Math.min(0.5, duration * 0.02);
      const bounds = trimBoundsRef.current;
      if (type === "start") {
        const next = Math.min(time, bounds.end - minGap);
        setTrimStart(Math.max(0, next));
        if (currentTime < next) {
          scrub(next);
        }
      } else {
        const next = Math.max(time, bounds.start + minGap);
        setTrimEnd(Math.min(duration, next));
        if (currentTime > next) {
          scrub(next);
        }
      }
    },
    [currentTime, duration, scrub],
  );

  const handleTrimPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!trimDragRef.current) return;
      updateTrimFromClient(trimDragRef.current, event.clientX);
    },
    [updateTrimFromClient],
  );

  const stopTrimDrag = useCallback(() => {
    trimDragRef.current = null;
    if (trimPointerRef.current?.el) {
      const { el, id } = trimPointerRef.current;
      if (el.hasPointerCapture(id)) {
        el.releasePointerCapture(id);
      }
    }
    trimPointerRef.current = null;
    window.removeEventListener("pointermove", handleTrimPointerMove);
    window.removeEventListener("pointerup", stopTrimDrag);
    window.removeEventListener("pointercancel", stopTrimDrag);
  }, [handleTrimPointerMove]);

  const beginTrimDrag = useCallback(
    (type: "start" | "end") => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      trimDragRef.current = type;
      trimPointerRef.current = {
        id: event.pointerId,
        el: event.currentTarget,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      updateTrimFromClient(type, event.clientX);
      window.addEventListener("pointermove", handleTrimPointerMove);
      window.addEventListener("pointerup", stopTrimDrag);
      window.addEventListener("pointercancel", stopTrimDrag);
    },
    [handleTrimPointerMove, stopTrimDrag, updateTrimFromClient],
  );

  useEffect(() => {
    return () => {
      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
      }
      if (endCueTimeoutRef.current) {
        clearTimeout(endCueTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-col rounded-3xl border border-white/10 bg-white/5 p-4 lg:flex-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">
            Canvas Preview
          </p>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] text-white/60">
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-[0.2em] text-white/40">
              Aspect
            </span>
            <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
              {(
                [
                  { id: "none", label: "None" },
                  { id: "landscape", label: "16:9" },
                  { id: "square", label: "1:1" },
                  { id: "vertical", label: "9:16" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onAspectRatioChange(option.id)}
                  className={`rounded-full px-2 py-1 text-[10px] transition ${
                    aspectRatio === option.id
                      ? "bg-cyan-400/30 text-white"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-[0.2em] text-white/40">
              Crop
            </span>
            <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
              {(
                [
                  { id: "local", label: "Center" },
                  { id: "cloudinary", label: "Smart" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onCropModeChange(option.id)}
                  className={`rounded-full px-2 py-1 text-[10px] transition ${
                    cropMode === option.id
                      ? "bg-cyan-400/30 text-white"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {cropMode === "cloudinary" ? (
              <label className="sr-only" htmlFor="crop-focus">
                Smart crop focus
              </label>
            ) : null}
            {cropMode === "cloudinary" ? (
              <select
                id="crop-focus"
                value={cropFocus}
                onChange={(event) =>
                  onCropFocusChange(
                    event.target.value as "auto" | "center" | "faces"
                  )
                }
                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70"
              >
                <option value="auto">Auto</option>
                <option value="faces">Faces</option>
                <option value="center">Center</option>
              </select>
            ) : null}
            {cloudinaryError ? (
              <div className="relative group">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10 text-[10px] font-semibold text-amber-200">
                  !
                </span>
                <div className="pointer-events-none absolute right-0 top-7 w-56 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-[10px] text-white/70 opacity-0 shadow-lg shadow-black/40 transition group-hover:opacity-100">
                  {cloudinaryError}
                </div>
              </div>
            ) : null}
          </div>
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            {previewResolution}
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            {formatDuration(duration)}
          </span>
        </div>
      </div>
      <div
        ref={previewRef}
        className="mt-4 flex flex-1 min-h-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30"
      >
        <div style={previewStyle} className="max-h-full max-w-full">
          <canvas ref={canvasRef} className="h-full w-full" />
        </div>
        <video
          key={videoSource}
          ref={videoRef}
          src={videoSource}
          className="hidden"
          playsInline
          crossOrigin="anonymous"
          onError={onVideoError}
          preload="metadata"
        />
      </div>
      <div
        ref={endFlashRef}
        className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 transition"
      >
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold tabular-nums text-cyan-300">
            {formatDuration(currentTime)}
          </span>
          <span className="text-xs tabular-nums text-white/60">
            {formatDuration(duration)}
          </span>
        </div>
        <div ref={scrubberRef} className="relative mt-2 h-7">
          <div className="absolute inset-x-0 top-1/2 z-0 h-1 -translate-y-1/2 rounded-full bg-white/10" />
          <div
            className="absolute inset-x-0 top-1/2 z-0 h-1 -translate-y-1/2 rounded-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(56,189,248,0.35) 0, rgba(56,189,248,0.35) 1px, transparent 1px, transparent 18px)",
            }}
          />
          <div
            className="absolute top-1/2 z-0 h-1 -translate-y-1/2 rounded-full bg-cyan-400/20"
            style={{
              left: `${trimStartPercent}%`,
              width: `${Math.max(0, trimEndPercent - trimStartPercent)}%`,
            }}
          />
          <div
            ref={progressFillRef}
            className="absolute top-1/2 z-10 h-1 -translate-y-1/2 rounded-full bg-cyan-400/70"
          />
          <div
            className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
            style={{ left: `${trimStartPercent}%` }}
            onPointerDown={beginTrimDrag("start")}
          >
            <div className="h-0 w-0 border-b-[6px] border-l-[5px] border-r-[5px] border-b-sky-400/90 border-l-transparent border-r-transparent" />
          </div>
          <div
            className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
            style={{ left: `${trimEndPercent}%` }}
            onPointerDown={beginTrimDrag("end")}
          >
            <div className="h-0 w-0 border-b-[6px] border-l-[5px] border-r-[5px] border-b-sky-400/90 border-l-transparent border-r-transparent" />
          </div>
          <div
            ref={playheadRef}
            className="absolute top-1/2 z-10"
            style={{ willChange: "transform" }}
          >
            <div className="h-3 w-2.5 rounded-sm border border-cyan-100/60 bg-cyan-300 shadow-lg shadow-cyan-400/40" />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => scrub(Number(event.target.value))}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause" : "Play"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-cyan-100 transition hover:border-cyan-400/60 hover:bg-cyan-400/20"
            onClick={() => {
              if (!isPlaying && duration) {
                scrub(trimStart);
              }
              void togglePlayback();
            }}
          >
            {isPlaying ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-current"
              >
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-current"
              >
                <path d="M8 5l11 7-11 7V5z" />
              </svg>
            )}
          </button>
          <button
            aria-label={isLooping ? "Disable loop" : "Enable loop"}
            title={isLooping ? "Disable loop" : "Enable loop"}
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-cyan-100 transition ${
              isLooping
                ? "border-cyan-400/70 bg-cyan-400/20"
                : "border-white/10 bg-white/5 hover:border-cyan-400/60 hover:bg-cyan-400/10"
            }`}
            onClick={() => setIsLooping((prev) => !prev)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-current"
            >
              <path d="M7 7h7a4 4 0 0 1 4 4v1h-2v-1a2 2 0 0 0-2-2H7v3L3 8l4-4v3zm10 10H10a4 4 0 0 1-4-4v-1h2v1a2 2 0 0 0 2 2h7v-3l4 4-4 4v-3z" />
            </svg>
          </button>
          <button
            className={`rounded-full border px-2.5 py-1 text-[10px] transition ${
              showColorGrade
                ? "border-cyan-400/70 bg-cyan-400/20 text-white"
                : "border-white/10 bg-white/5 text-white/70"
            }`}
            onClick={onToggleColorGrade}
          >
            Color Grade
          </button>
          <button className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/70">
            AI Clean Audio
          </button>
          <button className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/70">
            Smart Reframe
          </button>
        </div>
      </div>
    </div>
  );
});
