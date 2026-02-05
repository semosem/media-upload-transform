import { NextResponse } from "next/server";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get("prefix");
    const maxResults = searchParams.get("max_results") ?? "20";
    const nextCursor = searchParams.get("next_cursor");

    const query = new URLSearchParams({
      max_results: maxResults,
    });

    if (prefix) {
      query.set("prefix", prefix);
    }
    if (nextCursor) {
      query.set("next_cursor", nextCursor);
    }

    const authToken = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/video/upload?${query.toString()}`,
      {
        headers: {
          Authorization: `Basic ${authToken}`,
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? "Failed to load assets." },
        { status: response.status }
      );
    }

    return NextResponse.json({
      assets: data.resources ?? [],
      nextCursor: data.next_cursor ?? null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load Cloudinary assets." },
      { status: 500 }
    );
  }
}
