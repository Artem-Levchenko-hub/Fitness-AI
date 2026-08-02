import type { MetadataRoute } from "next";

import { getAppOrigin } from "@/lib/app-origin";

export default function robots(): MetadataRoute.Robots {
  const origin = getAppOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/legal/offer", "/legal/privacy"],
      disallow: [
        "/api/",
        "/admin",
        "/billing",
        "/body",
        "/cardio",
        "/circuits",
        "/create",
        "/dashboard",
        "/exercises",
        "/friends",
        "/library",
        "/login/verify",
        "/notes",
        "/nutrition",
        "/profile",
        "/programs",
        "/schedule",
        "/settings",
        "/sleep",
        "/stats",
        "/templates",
        "/workouts",
        "/a/",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
