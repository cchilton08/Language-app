import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Dutch Tutor",
    short_name: "Dutch Tutor",
    description: "Personal adaptive AI Dutch conversation tutor",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#ffffff",
  };
}
