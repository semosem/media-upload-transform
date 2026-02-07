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

const clipPalette = [
  "bg-emerald-400/80",
  "bg-indigo-400/80",
  "bg-amber-400/80",
  "bg-rose-400/80",
  "bg-sky-400/80",
  "bg-fuchsia-400/80",
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
  const playbackRef = useRef<
    | null
    | {
        play: () => void;
        pause: () => void;
        toggle: () => void;
      }
  >(null);
  const sequencePlayRef = useRef(false);
  const endAdvanceRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const pendingAutoPlayRef = useRef(false);
  const colorIndexRef = useRef(0);
  const [timelineTime, setTimelineTime] = useState(0);
  const previewDurationRef = useRef(0);
  const [showEnhance, setShowEnhance] = useState(true);
  const [showColorGrade, setShowColorGrade] = useState(false);
  const [grade, setGrade] = useState<GradeSettings>(initialGrade);
  const [overlayText, setOverlayText] = useState("CloudCut");
  const [overlayOpacity, setOverlayOpacity] = useState(0.55);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [sequence, setSequence] = useState<TimelineClip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [isSequencePlaying, setIsSequencePlaying] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const handleToggleInspector = useCallback(() => {
    setShowInspector((prev) => !prev);
  }, []);

  const assetsById = useMemo(
    () => new Map(assets.map((asset) => [asset.public_id, asset])),
    [assets],
  );

  const getNextClipColor = useCallback(() => {
    const next =
      clipPalette[colorIndexRef.current % clipPalette.length] ??
      clipPalette[0];
    colorIndexRef.current += 1;
    return next;
  }, []);

  const createClipId = useCallback(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

  const baseVideoSource = activeVideo?.secure_url ?? "";

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
    if (!baseVideoSource) return "";
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

  const sequenceWithTiming = useMemo(() => {
    let cursor = 0;
    return sequence.map((clip) => {
      const duration = Math.max(0, clip.outPoint - clip.inPoint);
      const start = cursor;
      cursor += duration;
      return { ...clip, start, duration };
    });
  }, [sequence]);

  const sequenceDuration = useMemo(() => {
    return sequenceWithTiming.reduce(
      (total, clip) => total + (clip.duration ?? 0),
      0,
    );
  }, [sequenceWithTiming]);

  const activeClip = useMemo(() => {
    if (!sequenceWithTiming.length) return null;
    if (activeClipId) {
      return (
        sequenceWithTiming.find((clip) => clip.id === activeClipId) ??
        sequenceWithTiming[0]
      );
    }
    return sequenceWithTiming[0];
  }, [activeClipId, sequenceWithTiming]);

  const activeTrimRange = useMemo(() => {
    if (!activeClip) return undefined;
    return { start: activeClip.inPoint, end: activeClip.outPoint };
  }, [activeClip]);

  useEffect(() => {
    if (!activeClipId && sequenceWithTiming.length) {
      setActiveClipId(sequenceWithTiming[0].id);
    }
  }, [activeClipId, sequenceWithTiming]);

  useEffect(() => {
    if (sequenceWithTiming.length) return;
    stopPreviewRef.current?.();
    sequencePlayRef.current = false;
    setIsSequencePlaying(false);
    setActiveClipId(null);
    setActiveVideo(null);
    setTimelineTime(0);
  }, [sequenceWithTiming.length, setActiveVideo]);

  useEffect(() => {
    if (!activeClip) return;
    const asset = assetsById.get(activeClip.assetId);
    if (asset && asset.public_id !== activeVideo?.public_id) {
      setActiveVideo(asset);
    }
  }, [activeClip, activeVideo?.public_id, assetsById, setActiveVideo]);

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

  const getAssetDuration = useCallback((asset: typeof assets[number]) => {
    const raw = asset.duration;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 10;
  }, []);

  const handleAddToTimeline = useCallback(
    (asset: typeof assets[number]) => {
      const duration = getAssetDuration(asset);
      const clipId = createClipId();
      const label = asset.public_id.split("/").slice(-1)[0] || "Clip";
      const nextClip: TimelineClip = {
        id: clipId,
        assetId: asset.public_id,
        label,
        color: getNextClipColor(),
        inPoint: 0,
        outPoint: duration,
      };
      setSequence((prev) => [...prev, nextClip]);
      setSelectedAssetId(asset.public_id);
      if (!activeClipId) {
        setActiveClipId(clipId);
        setActiveVideo(asset);
      }
    },
    [activeClipId, createClipId, getAssetDuration, getNextClipColor, setActiveVideo],
  );

  const getClipAtTime = useCallback(
    (time: number) => {
      if (!sequenceWithTiming.length) return null;
      const safeTime = Math.max(0, time);
      return (
        sequenceWithTiming.find(
          (clip) =>
            safeTime >= (clip.start ?? 0) &&
            safeTime < (clip.start ?? 0) + (clip.duration ?? 0),
        ) ?? sequenceWithTiming[sequenceWithTiming.length - 1]
      );
    },
    [sequenceWithTiming],
  );

  const requestSeek = useCallback((time: number) => {
    if (scrubHandlerRef.current) {
      scrubHandlerRef.current(time);
    } else {
      pendingSeekRef.current = time;
    }
  }, []);

  const selectClip = useCallback(
    (clip: TimelineClip) => {
      if (clip.id === activeClipId) {
        requestSeek(clip.inPoint);
        setTimelineTime(clip.start ?? 0);
        return;
      }
      const isSameAsset = activeVideo?.public_id === clip.assetId;
      if (isSameAsset) {
        sequencePlayRef.current = false;
        setIsSequencePlaying(false);
        setActiveClipId(clip.id);
        requestSeek(clip.inPoint);
        setTimelineTime(clip.start ?? 0);
        return;
      }
      stopPreviewRef.current?.();
      sequencePlayRef.current = false;
      setIsSequencePlaying(false);
      setActiveClipId(clip.id);
      const asset = assetsById.get(clip.assetId);
      if (asset) {
        setActiveVideo(asset);
      }
      requestSeek(clip.inPoint);
      setTimelineTime(clip.start ?? 0);
    },
    [
      activeClipId,
      activeVideo?.public_id,
      assetsById,
      requestSeek,
      setActiveVideo,
      setIsSequencePlaying,
    ],
  );

  const handleSelectAsset = useCallback(
    (asset: typeof assets[number]) => {
      setSelectedAssetId(asset.public_id);
    },
    [],
  );

  const handleRefreshAssets = useCallback(() => {
    void refreshAssets();
  }, [refreshAssets]);

  const handleExportReady = useCallback((handler: () => void) => {
    exportHandlerRef.current = handler;
  }, []);

  const handleScrubReady = useCallback((handler: (time: number) => void) => {
    scrubHandlerRef.current = handler;
    if (pendingSeekRef.current !== null) {
      handler(pendingSeekRef.current);
      pendingSeekRef.current = null;
    }
  }, []);

  const handleStopReady = useCallback((handler: () => void) => {
    stopPreviewRef.current = handler;
  }, []);

  const handleExportComplete = useCallback(() => {
    void refreshAssets(true);
  }, [refreshAssets]);

  const handlePlaybackReady = useCallback(
    (controls: { play: () => void; pause: () => void; toggle: () => void }) => {
      playbackRef.current = controls;
    },
    [],
  );

  const handlePlayStateChange = useCallback((playing: boolean) => {
    if (!activeClip || activeClip.assetId !== activeVideo?.public_id) {
      sequencePlayRef.current = false;
      setIsSequencePlaying(false);
      return;
    }
    if (playing) {
      sequencePlayRef.current = true;
      setIsSequencePlaying(true);
      return;
    }
    if (endAdvanceRef.current) {
      endAdvanceRef.current = false;
      return;
    }
    sequencePlayRef.current = false;
    setIsSequencePlaying(false);
  }, [activeClip, activeVideo?.public_id]);

  const handleTimelineScrub = useCallback(
    (time: number) => {
      if (!sequenceWithTiming.length) return;
      sequencePlayRef.current = false;
      setIsSequencePlaying(false);
      setTimelineTime(time);
      const clip = getClipAtTime(time);
      if (!clip) return;
      if (clip.id !== activeClipId) {
        selectClip(clip);
      }
      const offset = Math.max(0, time - (clip.start ?? 0));
      requestSeek(clip.inPoint + offset);
    },
    [
      activeClipId,
      getClipAtTime,
      requestSeek,
      selectClip,
      sequenceWithTiming,
      setIsSequencePlaying,
    ],
  );

  const handleSelectClip = useCallback(
    (clipId: string) => {
      const clip = sequenceWithTiming.find((item) => item.id === clipId);
      if (!clip) return;
      selectClip(clip);
    },
    [selectClip, sequenceWithTiming],
  );

  const handleTrimChange = useCallback(
    (range: { start: number; end: number }) => {
      if (!activeClipId) return;
      setSequence((prev) =>
        prev.map((clip) =>
          clip.id === activeClipId
            ? { ...clip, inPoint: range.start, outPoint: range.end }
            : clip,
        ),
      );
    },
    [activeClipId],
  );

  const startSequenceAt = useCallback(
    (time: number) => {
      if (!sequenceWithTiming.length) return;
      const clip = getClipAtTime(time) ?? sequenceWithTiming[0];
      const start = clip.start ?? 0;
      const offset = Math.max(0, time - start);
      sequencePlayRef.current = true;
      setIsSequencePlaying(true);

      if (clip.assetId === activeVideo?.public_id) {
        setActiveClipId(clip.id);
        requestSeek(clip.inPoint + offset);
        setTimelineTime(time);
        playbackRef.current?.play();
        return;
      }

      stopPreviewRef.current?.();
      setActiveClipId(clip.id);
      setTimelineTime(time);
      const asset = assetsById.get(clip.assetId);
      if (asset) {
        setActiveVideo(asset);
      }
      pendingSeekRef.current = clip.inPoint + offset;
      pendingAutoPlayRef.current = true;
    },
    [
      activeVideo?.public_id,
      assetsById,
      getClipAtTime,
      requestSeek,
      sequenceWithTiming,
      setActiveVideo,
    ],
  );

  const handlePlayToggle = useCallback(
    (playing: boolean) => {
      if (!sequenceWithTiming.length) {
        playbackRef.current?.toggle();
        return;
      }

      if (playing) {
        sequencePlayRef.current = false;
        setIsSequencePlaying(false);
        playbackRef.current?.pause();
        return;
      }

      const restartThreshold = Math.max(0, sequenceDuration - 0.05);
      const startTime =
        sequenceDuration > 0 && timelineTime >= restartThreshold
          ? 0
          : timelineTime;
      startSequenceAt(startTime);
    },
    [sequenceDuration, sequenceWithTiming.length, startSequenceAt, timelineTime],
  );

  const handlePreviewDuration = useCallback(
    (duration: number) => {
      if (!Number.isFinite(duration) || duration <= 0) {
        previewDurationRef.current = duration;
        return;
      }
      previewDurationRef.current = duration;
      if (pendingSeekRef.current !== null) {
        requestSeek(pendingSeekRef.current);
        pendingSeekRef.current = null;
      }
      if (pendingAutoPlayRef.current) {
        pendingAutoPlayRef.current = false;
        playbackRef.current?.play();
      }
      if (!activeClipId || activeClip?.assetId !== activeVideo?.public_id) {
        return;
      }
      setSequence((prev) =>
        prev.map((clip) => {
          if (clip.id !== activeClipId) return clip;
          const maxOut = duration || clip.outPoint;
          const nextOut =
            clip.outPoint <= clip.inPoint || clip.outPoint <= 0
              ? maxOut
              : Math.min(clip.outPoint, maxOut);
          const nextIn = Math.min(clip.inPoint, nextOut);
          return { ...clip, inPoint: nextIn, outPoint: nextOut };
        }),
      );
    },
    [activeClipId, activeClip, activeVideo?.public_id, requestSeek],
  );

  const advanceToNextClip = useCallback(() => {
    if (!activeClipId || !sequenceWithTiming.length) return;
    const currentIndex = sequenceWithTiming.findIndex(
      (clip) => clip.id === activeClipId,
    );
    if (currentIndex === -1) return;
    const nextClip = sequenceWithTiming[currentIndex + 1];
    if (!nextClip) {
      sequencePlayRef.current = false;
      setIsSequencePlaying(false);
      return;
    }
    const isSameAsset = activeVideo?.public_id === nextClip.assetId;
    if (isSameAsset) {
      setActiveClipId(nextClip.id);
      setTimelineTime(nextClip.start ?? 0);
      requestSeek(nextClip.inPoint);
      playbackRef.current?.play();
      return;
    }
    stopPreviewRef.current?.();
    setActiveClipId(nextClip.id);
    setTimelineTime(nextClip.start ?? 0);
    const asset = assetsById.get(nextClip.assetId);
    if (asset) {
      setActiveVideo(asset);
    }
    pendingSeekRef.current = nextClip.inPoint;
    pendingAutoPlayRef.current = true;
  }, [
    activeClipId,
    activeVideo?.public_id,
    assetsById,
    requestSeek,
    sequenceWithTiming,
    setActiveVideo,
  ]);

  const handleTrimEnd = useCallback(() => {
    if (!sequencePlayRef.current) return;
    endAdvanceRef.current = true;
    advanceToNextClip();
  }, [advanceToNextClip]);

  const handlePreviewTimeUpdate = useCallback((time: number) => {
    if (!activeClip || activeClip.assetId !== activeVideo?.public_id) return;
    const local = Math.max(0, time - activeClip.inPoint);
    const globalTime = (activeClip.start ?? 0) + local;
    setTimelineTime((prev) =>
      Math.abs(prev - globalTime) > 0.002 ? globalTime : prev
    );
  }, [activeClip, activeVideo?.public_id]);

  const handleSplitClip = useCallback(() => {
    if (!sequenceWithTiming.length) return;
    const target = getClipAtTime(timelineTime);
    if (!target || !target.duration) return;
    const offset = timelineTime - (target.start ?? 0);
    if (offset <= 0.1 || offset >= target.duration - 0.1) return;
    const splitPoint = target.inPoint + offset;
    const first: TimelineClip = {
      ...target,
      id: createClipId(),
      outPoint: splitPoint,
    };
    const second: TimelineClip = {
      ...target,
      id: createClipId(),
      inPoint: splitPoint,
    };
    setSequence((prev) => {
      const index = prev.findIndex((clip) => clip.id === target.id);
      if (index === -1) return prev;
      const next = [...prev];
      next.splice(index, 1, first, second);
      return next;
    });
    setActiveClipId(second.id);
  }, [createClipId, getClipAtTime, sequenceWithTiming, timelineTime]);

  const handleDeleteClip = useCallback(() => {
    if (!activeClipId) return;
    stopPreviewRef.current?.();
    sequencePlayRef.current = false;
    setIsSequencePlaying(false);
    setSequence((prev) => {
      const index = prev.findIndex((clip) => clip.id === activeClipId);
      if (index === -1) return prev;
      const next = prev.filter((clip) => clip.id !== activeClipId);
      const fallback = next[Math.max(0, index - 1)] ?? next[0] ?? null;
      setActiveClipId(fallback?.id ?? null);
      if (fallback) {
        const asset = assetsById.get(fallback.assetId);
        if (asset) {
          setActiveVideo(asset);
        }
      } else {
        setActiveVideo(null);
        setTimelineTime(0);
      }
      return next;
    });
  }, [activeClipId, assetsById, setActiveVideo, setIsSequencePlaying]);

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
            selectedAssetId={selectedAssetId}
            onSelect={handleSelectAsset}
            onAddToTimeline={handleAddToTimeline}
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
                  : "Preview"
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
              onTimeUpdate={handlePreviewTimeUpdate}
              onDurationChange={handlePreviewDuration}
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
              onPlayStateChange={handlePlayStateChange}
              onPlaybackReady={handlePlaybackReady}
              onPlayToggle={handlePlayToggle}
              onTrimEnd={handleTrimEnd}
              trimRange={activeTrimRange}
              onTrimChange={handleTrimChange}
            />
            <Timeline
              clips={sequenceWithTiming}
              currentTime={timelineTime}
              duration={sequenceDuration}
              onScrub={handleTimelineScrub}
              activeClipId={activeClipId}
              onSelectClip={handleSelectClip}
              onSplitClip={handleSplitClip}
              onDeleteClip={handleDeleteClip}
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
