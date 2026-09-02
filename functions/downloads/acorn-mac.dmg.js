const UPSTREAM =
  "https://github.com/kvnpyy/acorn-releases/releases/download/v0.1.2/Acorn_0.1.2_aarch64.dmg";

export async function onRequest(context) {
  const method = context.request.method;
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
  const range = context.request.headers.get("Range");
  if (range) incoming.set("Range", range);

  const upstream = await fetch(UPSTREAM, {
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
  headers.set("Content-Type", "application/x-apple-diskimage");
  headers.set("Content-Disposition", 'attachment; filename="Acorn.dmg"');
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
