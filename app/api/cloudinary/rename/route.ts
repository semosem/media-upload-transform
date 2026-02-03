import { NextResponse } from "next/server";

type RenameRequest = {
  publicId: string;
  newPublicId: string;
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

    const { publicId, newPublicId }: RenameRequest = await request.json();
    if (!publicId || !newPublicId) {
      return NextResponse.json(
        { error: "Missing publicId or newPublicId." },
        { status: 400 }
      );
    }

    const authToken = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/video/upload/rename`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_public_id: publicId,
          to_public_id: newPublicId,
          overwrite: true,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? "Failed to rename asset." },
        { status: response.status }
      );
    }

    return NextResponse.json({ asset: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to rename asset." },
      { status: 500 }
    );
  }
}
