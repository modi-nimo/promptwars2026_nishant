import { NextRequest, NextResponse } from "next/server";

const fallbackBackendUrl = "http://localhost:8000";

function getBackendUrl() {
  return (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? fallbackBackendUrl).replace(
    /\/$/,
    ""
  );
}

export async function proxyToBackend(request: NextRequest, backendPath: string) {
  const body = request.method === "GET" ? undefined : await request.text();
  const response = await fetch(`${getBackendUrl()}${backendPath}`, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json"
    },
    body,
    cache: "no-store"
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json"
    }
  });
}
