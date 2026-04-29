import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fitness SaaS — трекинг силовых тренировок",
    short_name: "Fitness",
    description:
      "Создавайте шаблоны тренировок, фиксируйте подходы и получайте AI-анализ прогресса.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4ef",
    theme_color: "#3a6b4a",
    categories: ["fitness", "health", "sports"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
