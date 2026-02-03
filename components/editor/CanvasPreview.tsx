"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export const CanvasPreview = ({
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
  sharpenAmount,
  noiseAmount,
  stabilizeAmount,
  grainAmount,
  overlayText,
  overlayOpacity,
  showOverlay,
  showColorGrade,
  onToggleColorGrade,
}: CanvasPreviewProps) => {
  const [exportState, setExportState] = useState<ExportState>({
    status: "idle",
    progress: 0,
  });
  const exportTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    return () => {
      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
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
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80"
          onClick={togglePlayback}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          className={`rounded-full border px-3 py-1.5 text-xs transition ${
            showColorGrade
              ? "border-cyan-400/70 bg-cyan-400/20 text-white"
              : "border-white/10 bg-white/5 text-white/80"
          }`}
          onClick={onToggleColorGrade}
        >
          Color Grade
        </button>
        <button className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/80">
          AI Clean Audio
        </button>
        <button className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/80">
          Smart Reframe
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
        <div className="flex items-center justify-between text-[10px] text-white/60">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => scrub(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
        />
      </div>
    </div>
  );
};
