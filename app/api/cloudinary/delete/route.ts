import { NextResponse } from "next/server";

type DeleteRequest = {
  publicId: string;
};

export async function POST(request: Request) {
  try {
    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey =
      process.env.CLOUDINARY_API_KEY ?? process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary environment variables are missing." },
        { status: 500 }
      );
    }

    const { publicId }: DeleteRequest = await request.json();
    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId." }, { status: 400 });
    }

    const authToken = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/video/upload`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          public_ids: [publicId],
          invalidate: true,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? "Failed to delete asset." },
        { status: response.status }
      );
    }

    return NextResponse.json({ result: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to delete asset." },
      { status: 500 }
    );
  }
}
