import type { MetadataRoute } from "next";

/** Everything but the marketing-facing routes is a signed-in workspace: keep it out of search results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/signup"],
      disallow: "/",
    },
  };
}
