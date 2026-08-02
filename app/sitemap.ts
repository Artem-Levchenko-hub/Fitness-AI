import type { MetadataRoute } from "next";

import { getAppOrigin } from "@/lib/app-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getAppOrigin();

  return [
    {
      url: origin,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${origin}/legal/offer`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${origin}/legal/privacy`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
