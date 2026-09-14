const MAC = {
  url: "https://github.com/kvnpyy/acorn-releases/releases/download/v0.1.13/Acorn_0.1.13_aarch64.dmg",
  contentType: "application/x-apple-diskimage",
  filename: "Acorn.dmg",
};

const WINDOWS = {
  url: "https://github.com/kvnpyy/acorn-releases/releases/download/v0.1.13/Acorn_0.1.13_x64-setup.exe",
  contentType: "application/octet-stream",
  filename: "acorn-windows.exe",
};

async function proxyDownload(request, asset) {
  const method = request.method;
  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const incoming = new Headers();
  incoming.set(
    "User-Agent",
    "Mozilla/5.0 (compatible; AcornSite/1.0; +https://useacorn.app/)"
  );
  incoming.set("Accept", "*/*");
  const range = request.headers.get("Range");
  if (range) incoming.set("Range", range);

  const upstream = await fetch(asset.url, {
    method,
    headers: incoming,
    redirect: "follow",
    cf: { cacheEverything: true, cacheTtl: 3600 },
  });

  const contentType = upstream.headers.get("Content-Type") || "";
  if (
    (!upstream.ok && upstream.status !== 206) ||
    contentType.includes("text/html")
  ) {
    return new Response("Download temporarily unavailable.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const headers = new Headers();
  headers.set("Content-Type", asset.contentType);
  headers.set(
    "Content-Disposition",
    `attachment; filename="${asset.filename}"`
  );
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("X-Content-Type-Options", "nosniff");

  const length = upstream.headers.get("Content-Length");
  if (length) headers.set("Content-Length", length);
  const contentRange = upstream.headers.get("Content-Range");
  if (contentRange) headers.set("Content-Range", contentRange);
  const acceptRanges = upstream.headers.get("Accept-Ranges");
  if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/downloads/acorn-mac.dmg") {
      return proxyDownload(request, MAC);
    }
    if (url.pathname === "/downloads/acorn-windows.exe") {
      return proxyDownload(request, WINDOWS);
    }
    if (url.pathname === "/src" || url.pathname.startsWith("/src/")) {
      return new Response(null, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};
