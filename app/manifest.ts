import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dutch Tutor",
    short_name: "Dutch Tutor",
    description: "Personal AI Dutch conversation tutor",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f8",
    theme_color: "#ffffff",
  };
}
