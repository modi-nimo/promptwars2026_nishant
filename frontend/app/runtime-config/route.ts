import type { ConceptMateRuntimeConfig } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

function safeScriptJson(value: ConceptMateRuntimeConfig) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function GET() {
  const config: ConceptMateRuntimeConfig = {
    apiBaseUrl: process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
    firebase: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? ""
    }
  };

  return new Response(`window.__CONCEPTMATE_CONFIG__=${safeScriptJson(config)};`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/javascript; charset=utf-8"
    }
  });
}
