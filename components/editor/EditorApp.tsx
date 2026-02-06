"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { MediaLibrary } from "@/components/editor/MediaLibrary";
import { CanvasPreview } from "@/components/editor/CanvasPreview";
import { Timeline } from "@/components/editor/Timeline";
import { Inspector } from "@/components/editor/Inspector";
import type {
  GradeSettings,
  InspectorSetting,
  InspectorSettingId,
  QuickLook,
  TimelineClip,
} from "@/components/types/types";
import { useCloudinaryAssets } from "@/hooks/useCloudinaryAssets";

const quickLooks: QuickLook[] = [
  {
    label: "Lush",
    filter: "saturate(1.4) contrast(1.05)",
    description: "Richer colors",
  },
  {
    label: "Noir",
    filter: "grayscale(1) contrast(1.2)",
    description: "Classic mono",
  },
  {
    label: "Neon",
    filter: "saturate(1.8) hue-rotate(15deg)",
    description: "Electric pop",
  },
  {
    label: "Warm",
    filter: "sepia(0.45) saturate(1.3)",
    description: "Golden tone",
  },
  {
    label: "Cool",
    filter: "hue-rotate(200deg) saturate(1.15)",
    description: "Crisp shadows",
  },
  {
    label: "Crisp",
    filter: "contrast(1.25) brightness(1.05)",
    description: "Sharper focus",
  },
  {
    label: "Fade",
    filter: "saturate(0.85) brightness(1.08)",
    description: "Softened mids",
  },
  {
    label: "Dream",
    filter: "blur(0.7px) brightness(1.1)",
    description: "Soft glow",
  },
  {
    label: "Vignette",
    filter: "contrast(1.05) saturate(1.05)",
    description: "Edge focus",
    vignette: true,
  },
  {
    label: "Invert",
    filter: "invert(1)",
    description: "Negative",
  },
];

const initialInspectorSettings: InspectorSetting[] = [
  { id: "sharpness", label: "Sharpness", value: 35 },
  { id: "noise", label: "Noise", value: 12 },
  { id: "stabilize", label: "Stabilize", value: 18 },
  { id: "grain", label: "Grain", value: 24 },
];

const timelineClips: TimelineClip[] = [
  { label: "Intro", color: "bg-emerald-400/80" },
  { label: "Scene 1", color: "bg-indigo-400/80" },
  { label: "Cutaway", color: "bg-amber-400/80" },
  { label: "Title", color: "bg-rose-400/80" },
];

const initialGrade: GradeSettings = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
};

export const EditorApp = () => {
  const {
    assets,
    loadingAssets,
    uploading,
    uploadProgress,
    uploadError,
    activeVideo,
    setActiveVideo,
    uploadAsset,
    refreshAssets,
    renameAsset,
    deleteAsset,
  } = useCloudinaryAssets();

  const [activeLook, setActiveLook] = useState<QuickLook>(quickLooks[2]);
  const [inspectorSettings, setInspectorSettings] = useState<InspectorSetting[]>(
    initialInspectorSettings
  );
  const [aspectRatio, setAspectRatio] = useState<
    "none" | "landscape" | "square" | "vertical"
  >("none");
  const [cropMode, setCropMode] = useState<"local" | "cloudinary">("local");
  const [cropFocus, setCropFocus] = useState<"auto" | "center" | "faces">(
    "auto"
  );
  const [cloudinaryError, setCloudinaryError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<{
    status: "idle" | "exporting" | "done" | "error";
    progress: number;
    message?: string;
  }>({ status: "idle", progress: 0 });
  const exportHandlerRef = useRef<null | (() => void)>(null);
  const scrubHandlerRef = useRef<null | ((time: number) => void)>(null);
  const stopPreviewRef = useRef<null | (() => void)>(null);
  const [timelineTime, setTimelineTime] = useState(0);
  const [timelineDuration, setTimelineDuration] = useState(0);
  const [showEnhance, setShowEnhance] = useState(true);
  const [showColorGrade, setShowColorGrade] = useState(false);
  const [grade, setGrade] = useState<GradeSettings>(initialGrade);
  const [overlayText, setOverlayText] = useState("CloudCut");
  const [overlayOpacity, setOverlayOpacity] = useState(0.55);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showInspector, setShowInspector] = useState(true);

  const handleToggleInspector = useCallback(() => {
    setShowInspector((prev) => !prev);
  }, []);

  const baseVideoSource =
    activeVideo?.secure_url ??
    "https://res.cloudinary.com/videocrop/video/upload/female_ej5j44.mp4";

  const cloudinaryAspect = useMemo(() => {
    if (aspectRatio === "square") return "1:1";
    if (aspectRatio === "vertical") return "9:16";
    if (aspectRatio === "landscape") return "16:9";
    return null;
  }, [aspectRatio]);

  const cloudinaryGravity = useMemo(() => {
    if (cropFocus === "faces") return "g_faces";
    if (cropFocus === "center") return "g_center";
    return "g_auto";
  }, [cropFocus]);

  const videoSource = useMemo(() => {
    if (cropMode !== "cloudinary") return baseVideoSource;
    if (!cloudinaryAspect) return baseVideoSource;
    if (!baseVideoSource.includes("/upload/")) return baseVideoSource;
    const transform = `c_fill,ar_${cloudinaryAspect},${cloudinaryGravity},q_auto,f_mp4`;
    return baseVideoSource.replace("/upload/", `/upload/${transform}/`);
  }, [baseVideoSource, cloudinaryAspect, cloudinaryGravity, cropMode]);

  const handleCropModeChange = useCallback(
    (mode: "local" | "cloudinary") => {
      setCloudinaryError(null);
      setCropMode(mode);
    },
    [],
  );

  const handleCropFocusChange = useCallback(
    (value: "auto" | "center" | "faces") => {
      setCloudinaryError(null);
      setCropFocus(value);
    },
    [],
  );

  const handleAspectChange = useCallback(
    (value: "none" | "landscape" | "square" | "vertical") => {
      setCloudinaryError(null);
      setAspectRatio(value);
    },
    [],
  );

  useEffect(() => {
    const width = activeVideo?.width ?? null;
    const height = activeVideo?.height ?? null;
    if (!width || !height) {
      setAspectRatio("none");
      setCloudinaryError(null);
      return;
    }
    const ratio = width / height;
    const near = (value: number, target: number, tolerance = 0.04) =>
      Math.abs(value - target) <= tolerance;

    if (near(ratio, 1)) {
      setAspectRatio("square");
    } else if (near(ratio, 16 / 9)) {
      setAspectRatio("landscape");
    } else if (near(ratio, 9 / 16)) {
      setAspectRatio("vertical");
    } else {
      setAspectRatio("none");
    }
    setCloudinaryError(null);
  }, [activeVideo?.public_id, activeVideo?.height, activeVideo?.width]);

  const handleVideoError = useCallback(() => {
    if (cropMode !== "cloudinary") return;

    if (cropFocus !== "center") {
      setCloudinaryError(
        "Smart crop unavailable. Falling back to center crop."
      );
      setCropFocus("center");
      return;
    }

    setCloudinaryError("Cloudinary crop failed. Using local center crop.");
    setCropMode("local");
  }, [cropMode, cropFocus]);

  const gradeFilter = useMemo(() => {
    return `brightness(${grade.brightness}) contrast(${grade.contrast}) saturate(${grade.saturation}) hue-rotate(${grade.hue}deg)`;
  }, [grade]);

  const combinedFilter = useMemo(() => {
    return `${activeLook.filter} ${gradeFilter}`.trim();
  }, [activeLook.filter, gradeFilter]);

  const inspectorMap = useMemo(() => {
    return inspectorSettings.reduce<Record<InspectorSettingId, number>>(
      (acc, setting) => {
        acc[setting.id] = setting.value;
        return acc;
      },
      {
        sharpness: 0,
        noise: 0,
        stabilize: 0,
        grain: 0,
      }
    );
  }, [inspectorSettings]);

  const handleInspectorChange = useCallback(
    (id: InspectorSettingId, value: number) => {
      setInspectorSettings((prev) =>
        prev.map((setting) =>
          setting.id === id ? { ...setting, value } : setting
        )
      );
    },
    [],
  );

  const resetGrade = useCallback(() => {
    setGrade(initialGrade);
  }, []);

  const resetEnhance = useCallback(() => {
    setInspectorSettings(initialInspectorSettings);
  }, []);

  const handleToggleEnhance = useCallback(() => {
    setShowEnhance((prev) => !prev);
  }, []);

  const handleToggleColorGrade = useCallback(() => {
    setShowColorGrade((prev) => !prev);
  }, []);

  const handleSelectAsset = useCallback(
    (asset: typeof assets[number]) => {
      stopPreviewRef.current?.();
      setActiveVideo(asset);
    },
    [setActiveVideo],
  );

  const handleRefreshAssets = useCallback(() => {
    void refreshAssets();
  }, [refreshAssets]);

  const handleExportReady = useCallback((handler: () => void) => {
    exportHandlerRef.current = handler;
  }, []);

  const handleScrubReady = useCallback((handler: (time: number) => void) => {
    scrubHandlerRef.current = handler;
  }, []);

  const handleStopReady = useCallback((handler: () => void) => {
    stopPreviewRef.current = handler;
  }, []);

  const handleExportComplete = useCallback(() => {
    void refreshAssets(true);
  }, [refreshAssets]);

  const handleTimelineScrub = useCallback(
    (time: number) => {
      scrubHandlerRef.current?.(time);
    },
    [],
  );

  const timelineSegments = useMemo(() => {
    if (!timelineClips.length) return [];
    const fallbackDuration = timelineDuration || timelineClips.length * 5;
    const segment = fallbackDuration / timelineClips.length;
    return timelineClips.map((clip, index) => ({
      ...clip,
      start: clip.start ?? index * segment,
      duration: clip.duration ?? segment,
    }));
  }, [timelineDuration, timelineClips]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden text-slate-100">
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute -right-24 top-64 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />

      <EditorHeader
        showInspector={showInspector}
        onToggleInspector={handleToggleInspector}
        actions={
          <>
            <button className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-white/80 transition hover:bg-white/20">
              Auto Enhance
            </button>
            <button
              className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 px-4 py-1.5 font-semibold text-slate-900 shadow-lg shadow-cyan-400/30 transition disabled:cursor-not-allowed disabled:opacity-70"
              onClick={() => exportHandlerRef.current?.()}
              disabled={exportState.status === "exporting"}
            >
              {exportState.status === "exporting"
                ? `${exportState.message ?? "Exporting"} ${exportState.progress}%`
                : exportState.status === "done"
                ? "Exported"
                : exportState.status === "error"
                ? "Export Failed"
                : "Export Cut"}
            </button>
          </>
        }
      />

      <main className="relative z-10 flex flex-1 min-h-0 flex-col gap-4 overflow-hidden px-6 pb-5 pt-4 lg:px-10">
        <section
          className={`grid flex-1 min-h-0 gap-4 lg:items-stretch ${
            showInspector
              ? "lg:grid-cols-[0.9fr_2.8fr_1fr]"
              : "lg:grid-cols-[1fr_3.6fr]"
          }`}>
          <MediaLibrary
            assets={assets}
            loadingAssets={loadingAssets}
            uploading={uploading}
            uploadProgress={uploadProgress}
            uploadError={uploadError}
            activeVideoId={activeVideo?.public_id}
            onSelect={handleSelectAsset}
            onUpload={uploadAsset}
            onRefresh={handleRefreshAssets}
            onRename={renameAsset}
            onDelete={deleteAsset}
          />

          <section className="fade-up stagger-2 flex min-h-0 flex-col gap-4 lg:overflow-hidden">
            <CanvasPreview
              title={
                activeVideo?.public_id
                  ? activeVideo.public_id.split("/").slice(-1)[0]
                  : "Neon Portrait Cut"
              }
              videoSource={videoSource}
              filter={combinedFilter}
              vignette={activeLook.vignette}
              aspectRatio={aspectRatio}
              onAspectRatioChange={handleAspectChange}
              cropMode={cropMode}
              onCropModeChange={handleCropModeChange}
              cropFocus={cropFocus}
              onCropFocusChange={handleCropFocusChange}
              onVideoError={handleVideoError}
              cloudinaryError={cloudinaryError}
              onExportReady={handleExportReady}
              onExportStateChange={setExportState}
              exportFolder="cloudcut/exports"
              onExportComplete={handleExportComplete}
              onTimeUpdate={setTimelineTime}
              onDurationChange={setTimelineDuration}
              sharpenAmount={inspectorMap.sharpness / 100}
              noiseAmount={inspectorMap.noise / 100}
              stabilizeAmount={inspectorMap.stabilize / 100}
              grainAmount={inspectorMap.grain / 100}
              overlayText={overlayText}
              overlayOpacity={overlayOpacity}
              showOverlay={showOverlay}
              showColorGrade={showColorGrade}
              onToggleColorGrade={handleToggleColorGrade}
              onScrubReady={handleScrubReady}
              onStopReady={handleStopReady}
            />
            <Timeline
              clips={timelineSegments}
              currentTime={timelineTime}
              duration={timelineDuration}
              onScrub={handleTimelineScrub}
            />
          </section>

          {showInspector ? (
            <Inspector
              inspectorSettings={inspectorSettings}
              showEnhance={showEnhance}
              onToggleEnhance={handleToggleEnhance}
              onResetEnhance={resetEnhance}
              quickLooks={quickLooks}
              activeLook={activeLook}
              onSelectLook={setActiveLook}
              onInspectorChange={handleInspectorChange}
              showColorGrade={showColorGrade}
              onToggleColorGrade={handleToggleColorGrade}
              grade={grade}
              onGradeChange={setGrade}
              onResetGrade={resetGrade}
              overlayText={overlayText}
              overlayOpacity={overlayOpacity}
              showOverlay={showOverlay}
              onOverlayTextChange={setOverlayText}
              onOverlayOpacityChange={setOverlayOpacity}
              onShowOverlayChange={setShowOverlay}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
};
