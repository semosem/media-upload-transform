"use client";
import Image from "next/image";
import { CldVideoPlayer, getCldImageUrl } from "next-cloudinary";
import "next-cloudinary/dist/cld-video-player.css";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <CldVideoPlayer
          width="1920"
          height="1080"
          // poster={getCldImageUrl({
          //   tint: "equalize:80:blue:blueviolet",

          //   src: "",
          // })}
          src="https://res.cloudinary.com/videocrop/video/upload/female_ej5j44.mp4"
          colors={{
            accent: "#ff0000",
            base: "#00ff00",
            text: "#0000ff",
          }}
          transformation={{
            width: 500,
            height: 500,
            crop: "fill",
            opacity: 0.8,
            overlays: [
              {
                publicId:
                  "https://res.cloudinary.com/videocrop/image/upload/c_pad,b_auto:predominant_gradient,w_400,ar_1/v1769975359/king_qafgin.jpeg",
                position: {
                  x: 50,
                  y: 50,
                  gravity: "north_west",
                },
                appliedEffects: [
                  {
                    multiply: true,
                  },
                ],
              },
            ],
          }}
        />
      </main>
    </div>
  );
}
