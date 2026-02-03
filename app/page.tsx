"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CloudinaryAsset = {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format?: string;
  duration?: number;
  width?: number;
  height?: number;
  created_at?: string;
};

type QuickLook = {
  label: string;
  filter: string;
  description: string;
  vignette?: boolean;
};

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

const inspectorSettings = [
  { label: "Exposure", value: 62 },
  { label: "Contrast", value: 48 },
  { label: "Saturation", value: 71 },
  { label: "Grain", value: 24 },
];

const timelineClips = [
  { label: "Intro", color: "bg-emerald-400/80" },
  { label: "Scene 1", color: "bg-indigo-400/80" },
  { label: "Cutaway", color: "bg-amber-400/80" },
  { label: "Title", color: "bg-rose-400/80" },
];

const formatDuration = (duration?: number) => {
  if (!duration && duration !== 0) return "--:--";
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export default function Home() {
  const [assets, setAssets] = useState<CloudinaryAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<CloudinaryAsset | null>(null);
  const [activeLook, setActiveLook] = useState<QuickLook>(quickLooks[2]);
  const [showColorGrade, setShowColorGrade] = useState(false);
  const [grade, setGrade] = useState({
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [overlayText, setOverlayText] = useState("CloudCut");
  const [overlayOpacity, setOverlayOpacity] = useState(0.55);
  const [showOverlay, setShowOverlay] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 });
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [showInspector, setShowInspector] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const videoSource = useMemo(() => {
    return (
      activeVideo?.secure_url ??
      "https://res.cloudinary.com/videocrop/video/upload/female_ej5j44.mp4"
    );
  }, [activeVideo]);

  const gradeFilter = useMemo(() => {
    return `brightness(${grade.brightness}) contrast(${grade.contrast}) saturate(${grade.saturation}) hue-rotate(${grade.hue}deg)`;
  }, [grade]);

  const fetchAssets = useCallback(async () => {
    try {
      setLoadingAssets(true);
      const response = await fetch("/api/cloudinary/assets");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load assets");
      }
      setAssets(data.assets ?? []);
      if (!activeVideo && data.assets?.length) {
        setActiveVideo(data.assets[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAssets(false);
    }
  }, [activeVideo]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const filterString = [activeLook.filter, gradeFilter]
      .filter(Boolean)
      .join(" ");

    ctx.clearRect(0, 0, width, height);
    ctx.filter = filterString || "none";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, 0, 0, width, height);
    ctx.filter = "none";

    if (activeLook.vignette) {
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.2,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.7
      );
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.45)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    if (showOverlay) {
      ctx.save();
      ctx.globalAlpha = overlayOpacity;
      ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
      ctx.fillRect(32, 32, Math.min(width * 0.35, 320), 60);
      ctx.restore();

      ctx.save();
      const fontSize = Math.round(height * 0.045);
      ctx.font = `600 ${fontSize}px "Space Grotesk", sans-serif`;
      ctx.fillStyle = "#e2e8f0";
      ctx.textBaseline = "top";
      ctx.fillText(overlayText || "CloudCut", 48, 40);
      ctx.restore();
    }
  }, [activeLook, gradeFilter, overlayOpacity, overlayText, showOverlay]);

  const renderLoop = useCallback(() => {
    drawFrame();
    const video = videoRef.current;
    if (video && !video.paused && !video.ended) {
      animationRef.current = requestAnimationFrame(renderLoop);
    }
  }, [drawFrame]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
      }
      setCanvasSize({ width, height });
      setDuration(video.duration || 0);
      setCurrentTime(0);
      drawFrame();
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [videoSource, drawFrame]);

  useEffect(() => {
    drawFrame();
  }, [drawFrame]);

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      const ratio = canvasSize.width / canvasSize.height;
      let targetWidth = width;
      let targetHeight = width / ratio;
      if (targetHeight > height) {
        targetHeight = height;
        targetWidth = height * ratio;
      }
      setPreviewSize({
        width: Math.max(1, Math.floor(targetWidth)),
        height: Math.max(1, Math.floor(targetHeight)),
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [canvasSize]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleUpload = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const signatureResponse = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "cloudcut" }),
      });
      const signatureData = await signatureResponse.json();
      if (!signatureResponse.ok) {
        throw new Error(signatureData?.error ?? "Failed to sign upload");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signatureData.apiKey);
      formData.append("timestamp", signatureData.timestamp);
      formData.append("signature", signatureData.signature);
      formData.append("folder", signatureData.folder);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/video/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadResult?.error?.message ?? "Upload failed");
      }

      setAssets((prev) => [uploadResult, ...prev]);
      setActiveVideo(uploadResult);
    } catch (error) {
      console.error(error);
      setUploadError(
        error instanceof Error ? error.message : "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleTogglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      try {
        await video.play();
        setIsPlaying(true);
        animationRef.current = requestAnimationFrame(renderLoop);
      } catch (error) {
        console.error(error);
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleScrub = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
    drawFrame();
  };

  const resetGrade = () => {
    setGrade({
      brightness: 1,
      contrast: 1,
      saturation: 1,
      hue: 0,
    });
  };

  const previewResolution = `${canvasSize.width}x${canvasSize.height}`;
  const previewStyle = {
    width: previewSize.width ? `${previewSize.width}px` : "100%",
    height: previewSize.height ? `${previewSize.height}px` : "100%",
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-100">
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute -right-24 top-64 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />

      <main className="relative z-10 flex min-h-screen flex-col gap-4 px-6 py-5 lg:h-screen lg:overflow-hidden lg:px-10">
        <header className="fade-up flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-3 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.7)]">
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
              onClick={() => setShowInspector((prev) => !prev)}
            >
              {showInspector ? "Hide Inspector" : "Show Inspector"}
            </button>
            <button className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-white/80 transition hover:bg-white/20">
              Auto Enhance
            </button>
            <button className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 px-4 py-1.5 font-semibold text-slate-900 shadow-lg shadow-cyan-400/30">
              Export Cut
            </button>
          </div>
        </header>

        <section
          className={`grid flex-1 min-h-0 gap-4 lg:items-stretch ${
            showInspector
              ? "lg:grid-cols-[0.9fr_2.8fr_1fr]"
              : "lg:grid-cols-[1fr_3.6fr]"
          }`}
        >
          <aside className="fade-up stagger-1 flex min-h-0 flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 lg:overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Media Library</h2>
              <label className="relative cursor-pointer rounded-full border border-white/10 px-3 py-1 text-[10px] text-white/70">
                {uploading ? "Uploading..." : "Upload"}
                <input
                  type="file"
                  accept="video/*"
                  className="absolute inset-0 opacity-0"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleUpload(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {uploadError ? (
              <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {uploadError}
              </p>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {loadingAssets ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-xs text-white/60">
                  Loading assets from Cloudinary...
                </div>
              ) : assets.length ? (
                assets.map((asset) => (
                  <button
                    type="button"
                    key={asset.public_id}
                    onClick={() => setActiveVideo(asset)}
                    className={`group flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition hover:border-cyan-400/40 hover:bg-white/10 ${
                      activeVideo?.public_id === asset.public_id
                        ? "border-cyan-400/60 bg-white/10"
                        : "border-white/5 bg-white/5"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-medium text-white">
                        {asset.public_id.split("/").slice(-1)[0]}
                      </p>
                      <p className="text-[10px] text-white/60">
                        {asset.format?.toUpperCase() ?? "VIDEO"} ·{" "}
                        {asset.width}x{asset.height}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white/70">
                      {formatDuration(asset.duration)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-xs text-white/60">
                  No videos yet. Upload your first cut.
                </div>
              )}
            </div>
            <div className="mt-auto rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/30 p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                Cloudinary
              </p>
              <p className="mt-2 text-xs text-white/80">
                Assets stream from the Cloudinary video pipeline with smart
                previews and instant transforms.
              </p>
            </div>
          </aside>

          <section className="fade-up stagger-2 flex min-h-0 flex-col gap-4 lg:overflow-hidden">
            <div className="flex min-h-0 flex-col rounded-3xl border border-white/10 bg-white/5 p-4 lg:flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">
                    Canvas Preview
                  </p>
                  <h2 className="text-lg font-semibold text-white">
                    {activeVideo?.public_id
                      ? activeVideo.public_id.split("/").slice(-1)[0]
                      : "Neon Portrait Cut"}
                  </h2>
                </div>
                <div className="flex gap-2 text-[10px] text-white/60">
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
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80"
                  onClick={handleTogglePlayback}
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    showColorGrade
                      ? "border-cyan-400/70 bg-cyan-400/20 text-white"
                      : "border-white/10 bg-white/5 text-white/80"
                  }`}
                  onClick={() => setShowColorGrade((prev) => !prev)}
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
                  onChange={(event) => handleScrub(Number(event.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
                />
              </div>
            </div>

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
                  {timelineClips.map((clip) => (
                    <div
                      key={clip.label}
                      className={`flex-1 min-w-[120px] rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 ${clip.color}`}
                    >
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
          </section>

          {showInspector ? (
            <aside className="fade-up stagger-3 flex min-h-0 flex-col rounded-3xl border border-white/10 bg-white/5 p-0 lg:overflow-y-auto">
              <div className="sticky top-0 z-10 border-b border-white/10 bg-white/5 px-4 pb-3 pt-4 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                  Inspector
                </p>
                <h2 className="text-base font-semibold text-white">
                  Color & Motion
                </h2>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
                <div className="flex flex-col gap-3">
                  {inspectorSettings.map((setting) => (
                    <div key={setting.label} className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-white/60">
                        <span>{setting.label}</span>
                        <span>{setting.value}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
                          style={{ width: `${setting.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                    Quick Looks
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[10px]">
                    {quickLooks.map((look) => {
                      const isActive = activeLook.label === look.label;
                      return (
                        <button
                          key={look.label}
                          type="button"
                          onClick={() => setActiveLook(look)}
                          className={`rounded-xl border px-3 py-2 text-left transition ${
                            isActive
                              ? "border-cyan-400/70 bg-cyan-400/20 text-white"
                              : "border-white/10 bg-white/10 text-white/80 hover:border-cyan-400/40"
                          }`}
                        >
                          <span className="block font-medium">{look.label}</span>
                          <span className="text-[10px] text-white/60">
                            {look.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                      Color Grade
                    </p>
                    <button
                      type="button"
                      className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/70 transition hover:border-cyan-400/60"
                      onClick={() => setShowColorGrade((prev) => !prev)}
                    >
                      {showColorGrade ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showColorGrade ? (
                    <div className="mt-3 flex flex-col gap-3 text-[10px] text-white/70">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Exposure</span>
                          <span>{grade.brightness.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.7}
                          max={1.3}
                          step={0.01}
                          value={grade.brightness}
                          onChange={(event) =>
                            setGrade((prev) => ({
                              ...prev,
                              brightness: Number(event.target.value),
                            }))
                          }
                          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Contrast</span>
                          <span>{grade.contrast.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.7}
                          max={1.4}
                          step={0.01}
                          value={grade.contrast}
                          onChange={(event) =>
                            setGrade((prev) => ({
                              ...prev,
                              contrast: Number(event.target.value),
                            }))
                          }
                          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Saturation</span>
                          <span>{grade.saturation.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.5}
                          max={1.8}
                          step={0.01}
                          value={grade.saturation}
                          onChange={(event) =>
                            setGrade((prev) => ({
                              ...prev,
                              saturation: Number(event.target.value),
                            }))
                          }
                          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Hue</span>
                          <span>{grade.hue.toFixed(0)}°</span>
                        </div>
                        <input
                          type="range"
                          min={-30}
                          max={30}
                          step={1}
                          value={grade.hue}
                          onChange={(event) =>
                            setGrade((prev) => ({
                              ...prev,
                              hue: Number(event.target.value),
                            }))
                          }
                          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={resetGrade}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] text-white/70 transition hover:border-cyan-400/60"
                      >
                        Reset Grade
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-[10px] text-white/50">
                      Toggle to adjust exposure, contrast, saturation, and hue.
                    </p>
                  )}
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
                        onChange={(event) => setShowOverlay(event.target.checked)}
                        className="h-4 w-4 rounded border border-white/20 bg-transparent"
                      />
                    </label>
                    <input
                      type="text"
                      value={overlayText}
                      onChange={(event) => setOverlayText(event.target.value)}
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
                          setOverlayOpacity(Number(event.target.value))
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-auto rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-900/20 p-4 text-[10px] text-white/70">
                  Canvas pipeline synced. Preview renders locally.
                </div>
              </div>
            </aside>
          ) : null}
        </section>
      </main>
    </div>
  );
}
