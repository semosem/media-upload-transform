"use client";

import { useCallback, useEffect, useState } from "react";
import type { CloudinaryAsset } from "@/components/types/types";

type UseCloudinaryAssetsOptions = {
  folder?: string;
  listPrefix?: string;
  maxResults?: number;
};

type UseCloudinaryAssetsResult = {
  assets: CloudinaryAsset[];
  loadingAssets: boolean;
  uploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  activeVideo: CloudinaryAsset | null;
  setActiveVideo: (asset: CloudinaryAsset | null) => void;
  uploadAsset: (file: File) => Promise<void>;
  renameAsset: (publicId: string, newPublicId: string) => Promise<void>;
  deleteAsset: (publicId: string) => Promise<void>;
  refreshAssets: (silent?: boolean) => Promise<CloudinaryAsset[]>;
};

export const useCloudinaryAssets = (
  options: UseCloudinaryAssetsOptions = {},
): UseCloudinaryAssetsResult => {
  const {
    folder = "cloudcut",
    listPrefix = "",
    maxResults = 50,
  } = options;
  const [assets, setAssets] = useState<CloudinaryAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<CloudinaryAsset | null>(null);

  const fetchAssets = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoadingAssets(true);
      }
      const collected: CloudinaryAsset[] = [];
      let nextCursor: string | null = null;
      let remaining = maxResults;
      let pages = 0;

      do {
        const query = new URLSearchParams();
        const perPage = Math.min(50, remaining);
        query.set("max_results", perPage.toString());
        if (listPrefix) {
          query.set("prefix", listPrefix);
        }
        if (nextCursor) {
          query.set("next_cursor", nextCursor);
        }

        const response = await fetch(
          `/api/cloudinary/assets?${query.toString()}`
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load assets");
        }

        collected.push(...(data.assets ?? []));
        nextCursor = data.nextCursor ?? null;
        remaining = maxResults - collected.length;
        pages += 1;
      } while (nextCursor && remaining > 0 && pages < 5);

      setAssets(collected);
      if (collected.length) {
        setActiveVideo((prev) => prev ?? collected[0]);
      }
      return collected;
    } catch (error) {
      console.error(error);
      return [];
    } finally {
      if (!silent) {
        setLoadingAssets(false);
      }
    }
  }, [listPrefix, maxResults]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  const uploadAsset = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploading(true);
      setUploadProgress(0);
      try {
        const signatureResponse = await fetch("/api/cloudinary/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder }),
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
        if (signatureData.folder) {
          formData.append("folder", signatureData.folder);
        }
        if (signatureData.uploadPreset) {
          formData.append("upload_preset", signatureData.uploadPreset);
        }

        const uploadResult: CloudinaryAsset = await new Promise(
          (resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(
              "POST",
              `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/video/upload`,
            );

            xhr.upload.onprogress = (event) => {
              if (!event.lengthComputable) return;
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percent);
            };

            xhr.onload = () => {
              try {
                const response =
                  xhr.responseType === "json"
                    ? xhr.response
                    : JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve(response);
                } else {
                  const message =
                    response?.error?.message ??
                    response?.error ??
                    `Upload failed (${xhr.status})`;
                  reject(new Error(message));
                }
              } catch (parseError) {
                reject(
                  new Error(
                    `Upload failed (${xhr.status}): ${xhr.responseText ?? "Unknown error"}`,
                  ),
                );
              }
            };

            xhr.onerror = () => {
              reject(new Error("Network error while uploading."));
            };

            xhr.responseType = "json";

            xhr.send(formData);
          },
        );

        setUploadProgress(100);
        setAssets((prev) => [uploadResult, ...prev]);
        setActiveVideo(uploadResult);
        await fetchAssets(true);
      } catch (error) {
        console.error(error);
        setUploadError(
          error instanceof Error ? error.message : "Upload failed",
        );
      } finally {
        setUploading(false);
      }
    },
    [fetchAssets, folder],
  );

  const renameAsset = useCallback(
    async (publicId: string, newPublicId: string) => {
      setUploadError(null);
      try {
        const response = await fetch("/api/cloudinary/rename", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicId, newPublicId }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to rename asset");
        }
        await fetchAssets(true);
      } catch (error) {
        console.error(error);
        setUploadError(
          error instanceof Error ? error.message : "Rename failed",
        );
      }
    },
    [fetchAssets],
  );

  const deleteAsset = useCallback(
    async (publicId: string) => {
      setUploadError(null);
      try {
        const response = await fetch("/api/cloudinary/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicId }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to delete asset");
        }
        setAssets((prev) => prev.filter((asset) => asset.public_id !== publicId));
        setActiveVideo((prev) =>
          prev?.public_id === publicId ? null : prev
        );
      } catch (error) {
        console.error(error);
        setUploadError(
          error instanceof Error ? error.message : "Delete failed",
        );
      }
    },
    [],
  );

  return {
    assets,
    loadingAssets,
    uploading,
    uploadProgress,
    uploadError,
    activeVideo,
    setActiveVideo,
    uploadAsset,
    renameAsset,
    deleteAsset,
    refreshAssets: fetchAssets,
  };
};
