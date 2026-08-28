import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dutch Tutor",
    short_name: "Dutch Tutor",
    description: "Personal adaptive AI Dutch conversation tutor",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#ffffff",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
