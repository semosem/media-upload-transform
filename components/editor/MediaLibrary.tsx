import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import type { CloudinaryAsset } from "@/components/types/types";
import { formatDuration } from "@/components/editor/format";

type MediaLibraryProps = {
  assets: CloudinaryAsset[];
  loadingAssets: boolean;
  uploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  activeVideoId?: string | null;
  onSelect: (asset: CloudinaryAsset) => void;
  onUpload: (file: File) => void;
  onRename: (publicId: string, newPublicId: string) => Promise<void>;
  onDelete: (publicId: string) => Promise<void>;
};

export const MediaLibrary = ({
  assets,
  loadingAssets,
  uploading,
  uploadProgress,
  uploadError,
  activeVideoId,
  onSelect,
  onUpload,
  onRename,
  onDelete,
}: MediaLibraryProps) => {
  const getPreviewUrl = (url: string) => {
    const transform = "so_0,q_auto,f_jpg,w_180,h_110,c_fill";
    if (!url.includes("/upload/")) return url;
    return url.replace("/upload/", `/upload/${transform}/`);
  };

  const getResolutionLabel = (asset: CloudinaryAsset) => {
    if (!asset.width || !asset.height) return "--x--";
    return `${asset.width}x${asset.height}`;
  };

  const getThumbStyle = (asset: CloudinaryAsset) => {
    const height = 64;
    const ratio =
      asset.width && asset.height ? asset.width / asset.height : 16 / 9;
    const clampedRatio = Math.min(Math.max(ratio, 9 / 16), 16 / 9);
    const width = Math.round(height * clampedRatio);
    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    event.currentTarget.value = "";
  };

  return (
    <aside className="fade-up stagger-1 flex min-h-0 flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 lg:overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Media Library</h2>
        <div className="flex flex-col items-end gap-1">
          <label
            className="relative flex cursor-pointer items-center gap-2 overflow-hidden rounded-full border border-dashed border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-cyan-400/60 hover:text-white"
            style={
              uploading
                ? {
                    background: `linear-gradient(90deg, rgba(56, 189, 248, 0.45) 0%, rgba(56, 189, 248, 0.45) ${Math.min(100, Math.max(0, uploadProgress))}%, rgba(255, 255, 255, 0.06) ${Math.min(100, Math.max(0, uploadProgress))}%, rgba(255, 255, 255, 0.06) 100%)`,
                  }
                : undefined
            }
          >
            <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-sm font-bold text-slate-900">
              +
            </span>
            <span className="relative z-10">
              {uploading ? `Importing ${uploadProgress}%` : "Import"}
            </span>
            <input
              type="file"
              accept="video/*"
              className="absolute inset-0 opacity-0"
              onChange={handleUpload}
            />
          </label>
        </div>
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
          assets.map((asset) => {
            const assetName = asset.public_id.split("/").slice(-1)[0];
            const prefix = asset.public_id.includes("/")
              ? asset.public_id.split("/").slice(0, -1).join("/")
              : "";

            const handleRename = (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              event.stopPropagation();
              const form = event.currentTarget;
              const input = form.elements.namedItem("name") as HTMLInputElement;
              const nextName = input?.value.trim();
              if (!nextName || nextName === assetName) return;
              const newPublicId = prefix ? `${prefix}/${nextName}` : nextName;
              void onRename(asset.public_id, newPublicId);
            };

            const handleSelect = () => onSelect(asset);

            const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleSelect();
              }
            };

            return (
              <div
                key={asset.public_id}
                role="button"
                tabIndex={0}
                onClick={handleSelect}
                onKeyDown={handleKey}
                className={`group relative flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition hover:border-cyan-400/40 hover:bg-white/10 ${
                  activeVideoId === asset.public_id
                    ? "border-cyan-400/60 bg-white/10"
                    : "border-white/5 bg-white/5"
                }`}>
              <div
                className="relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/50"
                style={getThumbStyle(asset)}
              >
                <img
                  src={getPreviewUrl(asset.secure_url)}
                  alt={`${assetName} preview`}
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/80">
                  {formatDuration(asset.duration)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">
                  {assetName}
                </p>
                <p className="text-[10px] text-white/60">
                  {getResolutionLabel(asset)} · {formatDuration(asset.duration)}
                </p>
              </div>
              <details
                className="relative"
                onClick={(event) => event.stopPropagation()}
              >
                <summary className="flex h-7 w-7 list-none items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/70 transition hover:border-cyan-400/60 hover:text-white">
                  ⋯
                </summary>
                <div className="absolute right-0 top-9 z-10 w-48 rounded-2xl border border-white/10 bg-slate-950/95 p-3 text-[10px] text-white/70 shadow-xl shadow-black/40">
                  <p className="uppercase tracking-[0.2em] text-white/40">
                    Manage
                  </p>
                  <form className="mt-2 space-y-2" onSubmit={handleRename}>
                    <input
                      name="name"
                      defaultValue={assetName}
                      className="w-full rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-[10px] text-white"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-white/10 px-2 py-1 uppercase tracking-[0.2em] text-white/60 transition hover:border-cyan-400/60 hover:text-white"
                    >
                      Rename
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const confirmed = window.confirm(
                        "Delete this asset from Cloudinary?"
                      );
                      if (!confirmed) return;
                      void onDelete(asset.public_id);
                    }}
                    className="mt-3 w-full rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1 uppercase tracking-[0.2em] text-rose-200/90 transition hover:border-rose-400/70 hover:text-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </details>
            </div>
            );
          })
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
          Assets stream from the Cloudinary video pipeline with smart previews
          and instant transforms.
        </p>
      </div>
    </aside>
  );
};
