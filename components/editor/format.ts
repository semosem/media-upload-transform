export const formatDuration = (duration?: number) => {
  if (!duration && duration !== 0) return "--:--";
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};
