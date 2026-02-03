import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadRequest = {
  folder?: string;
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
    const cloudName =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??
      process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey =
      process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY ??
      process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary environment variables are missing." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const folder = formData.get("folder");
    const uploadPreset =
      process.env.CLOUDINARY_UPLOAD_PRESET ??
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ??
      "";

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Missing file for upload." },
        { status: 400 }
      );
    }

    const timestamp = Math.round(Date.now() / 1000).toString();
    const paramsToSign: Record<string, string> = { timestamp };

    if (folder && typeof folder === "string" && folder.length > 0) {
      paramsToSign.folder = folder;
    }
    if (uploadPreset) {
      paramsToSign.upload_preset = uploadPreset;
    }

    const signature = buildSignature(paramsToSign, apiSecret);

    const uploadForm = new FormData();
    const uploadFile = file as File;
    const fileBuffer = Buffer.from(await uploadFile.arrayBuffer());
    uploadForm.append(
      "file",
      new Blob([fileBuffer], {
        type: uploadFile.type || "application/octet-stream",
      }),
      uploadFile.name ?? "upload"
    );
    uploadForm.append("api_key", apiKey);
    uploadForm.append("timestamp", timestamp);
    uploadForm.append("signature", signature);
    if (paramsToSign.folder) {
      uploadForm.append("folder", paramsToSign.folder);
    }
    if (paramsToSign.upload_preset) {
      uploadForm.append("upload_preset", paramsToSign.upload_preset);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      {
        method: "POST",
        body: uploadForm,
      }
    );

    const contentType = response.headers.get("content-type") ?? "";
    const raw = await response.text();
    let data: any = null;
    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(raw);
      } catch (parseError) {
        console.error("Cloudinary JSON parse error", parseError);
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ??
            data?.error ??
            raw?.slice(0, 300) ??
            "Upload failed.",
          status: response.status,
        },
        { status: response.status }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Upload succeeded but no JSON payload returned." },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Unable to upload to Cloudinary.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
