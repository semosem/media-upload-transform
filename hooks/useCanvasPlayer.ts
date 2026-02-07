"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

type UseCanvasPlayerArgs = {
  videoSource?: string;
  filter: string;
  targetAspectRatio?: number;
  sharpenAmount: number;
  noiseAmount: number;
  stabilizeAmount: number;
  grainAmount: number;
  overlayText: string;
  overlayOpacity: number;
  showOverlay: boolean;
  vignette?: boolean;
};

type CanvasPlayerState = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  previewRef: RefObject<HTMLDivElement | null>;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  canvasSize: { width: number; height: number };
  previewSize: { width: number; height: number };
  togglePlayback: () => Promise<void>;
  pausePlayback: () => void;
  pauseAt: (value: number) => void;
  scrub: (value: number) => void;
  stopAndUnload: () => void;
};

export const useCanvasPlayer = ({
  videoSource,
  filter,
  targetAspectRatio,
  sharpenAmount,
  noiseAmount,
  stabilizeAmount,
  grainAmount,
  overlayText,
  overlayOpacity,
  showOverlay,
  vignette,
}: UseCanvasPlayerArgs): CanvasPlayerState => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 });
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sharpenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastDrawRef = useRef(0);
  const lastMediaTimeRef = useRef(-1);
  const lastTimeUpdateValueRef = useRef(-1);
  const frameLoopRef = useRef<{
    type: "rvfc" | "raf";
    id: number;
    video: HTMLVideoElement | null;
  } | null>(null);
  const forcedTimeRef = useRef<number | null>(null);
  const timeUpdateRef = useRef<{
    type: "rvfc" | "raf";
    id: number;
    video: HTMLVideoElement | null;
  } | null>(null);
  const isPlayingRef = useRef(false);
  const lastStateUpdateRef = useRef(0);

  const computeOutputSize = useCallback(
    (sourceWidth: number, sourceHeight: number) => {
      if (!targetAspectRatio || targetAspectRatio <= 0) {
        return {
          width: sourceWidth,
          height: sourceHeight,
          sx: 0,
          sy: 0,
          sWidth: sourceWidth,
          sHeight: sourceHeight,
        };
      }

      const sourceRatio = sourceWidth / sourceHeight;
      let cropWidth = sourceWidth;
      let cropHeight = sourceHeight;

      if (sourceRatio > targetAspectRatio) {
        cropHeight = sourceHeight;
        cropWidth = sourceHeight * targetAspectRatio;
      } else {
        cropWidth = sourceWidth;
        cropHeight = sourceWidth / targetAspectRatio;
      }

      const sx = Math.max(0, (sourceWidth - cropWidth) / 2);
      const sy = Math.max(0, (sourceHeight - cropHeight) / 2);

      return {
        width: Math.round(cropWidth),
        height: Math.round(cropHeight),
        sx,
        sy,
        sWidth: cropWidth,
        sHeight: cropHeight,
      };
    },
    [targetAspectRatio],
  );

  const applyNoise = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      intensity: number,
      mode: GlobalCompositeOperation
    ) => {
      if (intensity <= 0) return;
      const scale = 0.25;
      const w = Math.max(1, Math.floor(width * scale));
      const h = Math.max(1, Math.floor(height * scale));
      if (!noiseCanvasRef.current) {
        noiseCanvasRef.current = document.createElement("canvas");
      }
      const noiseCanvas = noiseCanvasRef.current;
      noiseCanvas.width = w;
      noiseCanvas.height = h;
      const noiseCtx = noiseCanvas.getContext("2d");
      if (!noiseCtx) return;

      const imageData = noiseCtx.createImageData(w, h);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const value = Math.floor(Math.random() * 255);
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = 255;
      }
      noiseCtx.putImageData(imageData, 0, 0);

      ctx.save();
      ctx.globalAlpha = intensity;
      ctx.globalCompositeOperation = mode;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(noiseCanvas, 0, 0, width, height);
      ctx.restore();
    },
    []
  );

  const applySharpen = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      amount: number
    ) => {
      if (amount <= 0) return;
      const scale = 0.5;
      const w = Math.max(1, Math.floor(width * scale));
      const h = Math.max(1, Math.floor(height * scale));
      if (!sharpenCanvasRef.current) {
        sharpenCanvasRef.current = document.createElement("canvas");
      }
      const sharpenCanvas = sharpenCanvasRef.current;
      sharpenCanvas.width = w;
      sharpenCanvas.height = h;
      const sharpenCtx = sharpenCanvas.getContext("2d");
      if (!sharpenCtx) return;

      sharpenCtx.drawImage(ctx.canvas, 0, 0, w, h);
      const imageData = sharpenCtx.getImageData(0, 0, w, h);
      const src = imageData.data;
      const output = sharpenCtx.createImageData(w, h);
      const dst = output.data;
      dst.set(src);

      const kernel = [
        0,
        -1 * amount,
        0,
        -1 * amount,
        1 + 4 * amount,
        -1 * amount,
        0,
        -1 * amount,
        0,
      ];

      const clamp = (value: number) => Math.max(0, Math.min(255, value));

      for (let y = 1; y < h - 1; y += 1) {
        for (let x = 1; x < w - 1; x += 1) {
          const idx = (y * w + x) * 4;
          let r = 0;
          let g = 0;
          let b = 0;
          let k = 0;
          for (let ky = -1; ky <= 1; ky += 1) {
            for (let kx = -1; kx <= 1; kx += 1) {
              const i = ((y + ky) * w + (x + kx)) * 4;
              const weight = kernel[k];
              r += src[i] * weight;
              g += src[i + 1] * weight;
              b += src[i + 2] * weight;
              k += 1;
            }
          }
          dst[idx] = clamp(r);
          dst[idx + 1] = clamp(g);
          dst[idx + 2] = clamp(b);
          dst[idx + 3] = src[idx + 3];
        }
      }

      sharpenCtx.putImageData(output, 0, 0);

      ctx.save();
      ctx.globalAlpha = Math.min(1, amount);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(sharpenCanvas, 0, 0, width, height);
      ctx.restore();
    },
    []
  );

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const sourceWidth = video.videoWidth || width;
    const sourceHeight = video.videoHeight || height;
    const crop = computeOutputSize(sourceWidth, sourceHeight);
    const stabilizeScale = 1 + Math.min(Math.max(stabilizeAmount, 0), 1) * 0.04;
    const drawWidth = width * stabilizeScale;
    const drawHeight = height * stabilizeScale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.filter = filter || "none";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      video,
      crop.sx,
      crop.sy,
      crop.sWidth,
      crop.sHeight,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight,
    );
    ctx.filter = "none";

    const isPreview = isPlayingRef.current;
    const sharpenStrength = isPreview
      ? Math.min(sharpenAmount, 0.2)
      : Math.min(sharpenAmount, 0.6);
    const noiseStrength = isPreview ? noiseAmount * 0.08 : noiseAmount * 0.2;
    const grainStrength = isPreview ? grainAmount * 0.12 : grainAmount * 0.3;

    applySharpen(ctx, width, height, sharpenStrength);
    applyNoise(ctx, width, height, noiseStrength, "screen");
    applyNoise(ctx, width, height, grainStrength, "overlay");

    if (vignette) {
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.2,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.7,
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
  }, [
    applyNoise,
    applySharpen,
    computeOutputSize,
    filter,
    grainAmount,
    noiseAmount,
    overlayOpacity,
    overlayText,
    sharpenAmount,
    showOverlay,
    stabilizeAmount,
    vignette,
  ]);

  const cancelFrameLoop = useCallback(() => {
    const request = frameLoopRef.current;
    if (!request) return;
    const { type, id, video } = request;
    if (type === "rvfc" && video && "cancelVideoFrameCallback" in video) {
      video.cancelVideoFrameCallback(id);
    } else {
      cancelAnimationFrame(id);
    }
    frameLoopRef.current = null;
  }, []);

  const scheduleFrameLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended) return;

    const loop = () => {
      const activeVideo = videoRef.current;
      if (!activeVideo || activeVideo !== video) {
        frameLoopRef.current = null;
        return;
      }
      if (activeVideo.paused || activeVideo.ended) {
        frameLoopRef.current = null;
        return;
      }
      const mediaTime = activeVideo.currentTime || 0;
      if (Math.abs(mediaTime - lastMediaTimeRef.current) < 0.0005) {
        if ("requestVideoFrameCallback" in activeVideo) {
          const id = activeVideo.requestVideoFrameCallback(() => loop());
          frameLoopRef.current = { type: "rvfc", id, video: activeVideo };
        } else {
          const id = requestAnimationFrame(loop);
          frameLoopRef.current = { type: "raf", id, video: null };
        }
        return;
      }
      lastMediaTimeRef.current = mediaTime;
      const now = performance.now();
      if (now - lastDrawRef.current >= 33) {
        lastDrawRef.current = now;
        drawFrame();
      }
      if ("requestVideoFrameCallback" in activeVideo) {
        const id = activeVideo.requestVideoFrameCallback(() => loop());
        frameLoopRef.current = { type: "rvfc", id, video: activeVideo };
      } else {
        const id = requestAnimationFrame(loop);
        frameLoopRef.current = { type: "raf", id, video: null };
      }
    };

    if ("requestVideoFrameCallback" in video) {
      const id = video.requestVideoFrameCallback(() => loop());
      frameLoopRef.current = { type: "rvfc", id, video };
    } else {
      const id = requestAnimationFrame(loop);
      frameLoopRef.current = { type: "raf", id, video: null };
    }
  }, [drawFrame]);

  const cancelTimeUpdate = useCallback(() => {
    const request = timeUpdateRef.current;
    if (!request) return;
    const { type, id, video } = request;
    if (type === "rvfc" && video && "cancelVideoFrameCallback" in video) {
      video.cancelVideoFrameCallback(id);
    } else {
      cancelAnimationFrame(id);
    }
    timeUpdateRef.current = null;
  }, []);

  const scheduleTimeUpdate = useCallback(() => {
    if (timeUpdateRef.current) return;
    const video = videoRef.current;
    if (!video || video.paused || video.ended) return;

    const loop = () => {
      const activeVideo = videoRef.current;
      if (!activeVideo || activeVideo !== video) {
        timeUpdateRef.current = null;
        return;
      }
      if (activeVideo.paused || activeVideo.ended) {
        timeUpdateRef.current = null;
        return;
      }
      const current = forcedTimeRef.current ?? activeVideo.currentTime;
      const now = performance.now();
      if (
        now - lastStateUpdateRef.current >= 33 &&
        Math.abs(current - lastTimeUpdateValueRef.current) > 0.002
      ) {
        lastStateUpdateRef.current = now;
        lastTimeUpdateValueRef.current = current;
        setCurrentTime(current);
      }
      if ("requestVideoFrameCallback" in activeVideo) {
        const id = activeVideo.requestVideoFrameCallback(() => loop());
        timeUpdateRef.current = { type: "rvfc", id, video: activeVideo };
      } else {
        const id = requestAnimationFrame(loop);
        timeUpdateRef.current = { type: "raf", id, video: null };
      }
    };

    if ("requestVideoFrameCallback" in video) {
      const id = video.requestVideoFrameCallback(() => loop());
      timeUpdateRef.current = { type: "rvfc", id, video };
    } else {
      const id = requestAnimationFrame(loop);
      timeUpdateRef.current = { type: "raf", id, video: null };
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = canvasRef.current;
      const output = computeOutputSize(width, height);
      if (canvas) {
        canvas.width = output.width;
        canvas.height = output.height;
      }
      setCanvasSize({ width: output.width, height: output.height });
      setDuration(video.duration || 0);
      const pendingTime = forcedTimeRef.current;
      forcedTimeRef.current = null;
      const initialTime = pendingTime ?? 0;
      setCurrentTime(initialTime);
      lastTimeUpdateValueRef.current = initialTime;
      try {
        video.currentTime = initialTime;
        video.pause();
      } catch {
        // Ignore seek errors before metadata is fully ready.
      }
      drawFrame();
    };

    const handleLoadedData = () => {
      if (video.paused) {
        drawFrame();
      }
    };

    const handleTimeUpdate = () => {
      if (isPlayingRef.current) return;
      if (forcedTimeRef.current !== null) {
        setCurrentTime(forcedTimeRef.current);
        lastTimeUpdateValueRef.current = forcedTimeRef.current;
        return;
      }
      setCurrentTime(video.currentTime);
      lastTimeUpdateValueRef.current = video.currentTime;
    };

    const handleSeeked = () => {
      if (forcedTimeRef.current !== null) {
        const forced = forcedTimeRef.current;
        if (Math.abs(video.currentTime - forced) <= 0.02) {
          forcedTimeRef.current = null;
          setCurrentTime(video.currentTime);
          lastTimeUpdateValueRef.current = video.currentTime;
        } else {
          setCurrentTime(forced);
          lastTimeUpdateValueRef.current = forced;
        }
      } else {
        setCurrentTime(video.currentTime);
        lastTimeUpdateValueRef.current = video.currentTime;
      }
      if (video.paused) {
        drawFrame();
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      cancelTimeUpdate();
      cancelFrameLoop();
      lastMediaTimeRef.current = -1;
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("ended", handleEnded);
    };
  }, [videoSource, drawFrame, computeOutputSize, cancelTimeUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth || canvas.width || 1280;
    const height = video.videoHeight || canvas.height || 720;
    const output = computeOutputSize(width, height);
    canvas.width = output.width;
    canvas.height = output.height;
    setCanvasSize({ width: output.width, height: output.height });
    drawFrame();
  }, [computeOutputSize, drawFrame]);

  useEffect(() => {
    drawFrame();
  }, [drawFrame]);

  useEffect(() => {
    const container = previewRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

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
      cancelFrameLoop();
      cancelTimeUpdate();
    };
  }, [cancelFrameLoop, cancelTimeUpdate]);

  useEffect(() => {
    if (isPlaying) {
      isPlayingRef.current = true;
      cancelTimeUpdate();
      scheduleTimeUpdate();
    } else {
      isPlayingRef.current = false;
      cancelTimeUpdate();
    }
  }, [isPlaying, cancelTimeUpdate, scheduleTimeUpdate]);

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !videoSource) return;

    if (video.paused || video.ended) {
      try {
        forcedTimeRef.current = null;
        await video.play();
        setIsPlaying(true);
        lastMediaTimeRef.current = video.currentTime || 0;
        cancelFrameLoop();
        scheduleFrameLoop();
      } catch (error) {
        console.error(error);
      }
    } else {
      video.pause();
      setIsPlaying(false);
      cancelFrameLoop();
      cancelTimeUpdate();
    }
  }, [cancelFrameLoop, cancelTimeUpdate, scheduleFrameLoop, videoSource]);

  const pausePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    cancelFrameLoop();
    cancelTimeUpdate();
    lastMediaTimeRef.current = -1;
  }, [cancelFrameLoop, cancelTimeUpdate]);

  const stopAndUnload = useCallback(() => {
    const video = videoRef.current;
    cancelFrameLoop();
    cancelTimeUpdate();
    forcedTimeRef.current = null;
    isPlayingRef.current = false;
    lastDrawRef.current = 0;
    lastStateUpdateRef.current = 0;
    lastTimeUpdateValueRef.current = 0;
    lastMediaTimeRef.current = -1;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (!video) return;
    try {
      video.pause();
      if (video.src) {
        video.removeAttribute("src");
        video.load();
      }
    } catch {
      // Ignore unload errors.
    }
  }, [cancelFrameLoop, cancelTimeUpdate]);

  const pauseAt = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video || !videoSource) return;
      const max = Number.isFinite(video.duration) ? video.duration : value;
      const clamped = Math.max(0, Math.min(value, max));
      forcedTimeRef.current = clamped;
      video.pause();
      setIsPlaying(false);
      cancelFrameLoop();
      cancelTimeUpdate();
      lastMediaTimeRef.current = -1;
      try {
      video.currentTime = clamped;
    } catch {
      // Ignore seek errors before metadata is ready.
    }
    setCurrentTime(clamped);
    lastTimeUpdateValueRef.current = clamped;
    lastMediaTimeRef.current = clamped;
    drawFrame();
  },
  [cancelFrameLoop, cancelTimeUpdate, drawFrame, videoSource],
);

  const scrub = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video || !videoSource) return;
      forcedTimeRef.current = null;
      try {
        video.currentTime = value;
      } catch {
        forcedTimeRef.current = value;
      }
      setCurrentTime(value);
      lastTimeUpdateValueRef.current = value;
      lastMediaTimeRef.current = value;
      drawFrame();
  },
  [drawFrame, videoSource],
);

  useEffect(() => {
    if (!videoSource) {
      stopAndUnload();
      return;
    }
    cancelFrameLoop();
    cancelTimeUpdate();
    forcedTimeRef.current = null;
    isPlayingRef.current = false;
    lastDrawRef.current = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    lastStateUpdateRef.current = 0;
    lastTimeUpdateValueRef.current = 0;
    lastMediaTimeRef.current = -1;
    const video = videoRef.current;
    if (!video) return;
    try {
      video.pause();
      if (video.readyState > 0) {
        video.currentTime = 0;
      }
      if (video.src !== videoSource) {
        video.src = videoSource;
      }
      video.load();
    } catch {
      // Ignore until metadata is available.
    }

    return () => {
      try {
        video.pause();
        if (video.src === videoSource) {
          video.removeAttribute("src");
          video.load();
        }
      } catch {
        // Ignore unload errors.
      }
    };
  }, [videoSource, cancelFrameLoop, cancelTimeUpdate, stopAndUnload]);

  return {
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
    stopAndUnload,
  };
};
