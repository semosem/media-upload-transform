import { NextResponse } from "next/server";
import crypto from "crypto";

type SignRequest = {
  folder?: string;
  format?: string;
  publicId?: string;
};

const buildSignature = (params: Record<string, string>, apiSecret: string) => {
  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${paramString}${apiSecret}`)
    .digest("hex");
};

export async function POST(request: Request) {
  try {
    const { folder, format, publicId }: SignRequest = await request.json();
    const timestamp = Math.round(Date.now() / 1000).toString();
    const cloudName =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??
      process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey =
      process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY ??
      process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset =
      process.env.CLOUDINARY_UPLOAD_PRESET ??
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ??
      "";

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary environment variables are missing." },
        { status: 500 }
      );
    }

    const paramsToSign: Record<string, string> = {
      timestamp,
    };

    const safeFormat = format === "mp4" ? "mp4" : "";
    const safePublicId =
      typeof publicId === "string"
        ? publicId.replace(/[^a-zA-Z0-9/_-]/g, "")
        : "";

    if (folder) {
      paramsToSign.folder = folder;
    }
    if (safeFormat) {
      paramsToSign.format = safeFormat;
    }
    if (safePublicId) {
      paramsToSign.public_id = safePublicId;
    }
    if (uploadPreset) {
      paramsToSign.upload_preset = uploadPreset;
    }

    const signature = buildSignature(paramsToSign, apiSecret);

    return NextResponse.json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder: folder ?? "",
      format: safeFormat,
      publicId: safePublicId,
      uploadPreset: uploadPreset || "",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to sign upload." },
      { status: 500 }
    );
  }
}
