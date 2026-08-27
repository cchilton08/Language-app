import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dutch Tutor",
    short_name: "Dutch Tutor",
    description: "A personal, conversation-first Dutch learning companion.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#f8f7f3",
  };
}
