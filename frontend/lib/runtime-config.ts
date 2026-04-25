export type ConceptMateRuntimeConfig = {
  apiBaseUrl?: string;
  firebase?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    appId?: string;
  };
};

declare global {
  interface Window {
    __CONCEPTMATE_CONFIG__?: ConceptMateRuntimeConfig;
  }
}

export function getRuntimeConfig(): ConceptMateRuntimeConfig {
  if (typeof window === "undefined") {
    return {};
  }
  return window.__CONCEPTMATE_CONFIG__ ?? {};
}
