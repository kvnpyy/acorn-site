const LATEST_URL =
  "https://github.com/kvnpyy/acorn-releases/releases/latest/download/latest.json";
const RELEASE_TTL_MS = 5 * 60 * 1000;

let cachedRelease = null;
let cachedAt = 0;

const FALLBACK = {
  version: "0.1.18",
  macUrl:
    "https://github.com/kvnpyy/acorn-releases/releases/download/v0.1.18/Acorn_0.1.18_aarch64.dmg",
  winUrl:
    "https://github.com/kvnpyy/acorn-releases/releases/download/v0.1.18/Acorn_0.1.18_x64-setup.exe",
};

function assetFor(release, platform) {
  if (platform === "mac") {
    return {
      url: release.macUrl,
      contentType: "application/x-apple-diskimage",
      filename: "Acorn.dmg",
    };
  }
  return {
    url: release.winUrl,
    contentType: "application/octet-stream",
    filename: "acorn-windows.exe",
  };
}

function releaseFromManifest(manifest) {
  const version = String(manifest?.version || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
  const base = `https://github.com/kvnpyy/acorn-releases/releases/download/v${version}`;
  const winUrl =
    manifest.platforms?.["windows-x86_64"]?.url ||
    `${base}/Acorn_${version}_x64-setup.exe`;
  return {
    version,
    macUrl: `${base}/Acorn_${version}_aarch64.dmg`,
    winUrl,
  };
}

async function getRelease() {
  if (cachedRelease && Date.now() - cachedAt < RELEASE_TTL_MS) {
    return cachedRelease;
  }

  try {
    const res = await fetch(LATEST_URL, {
      headers: {
        "User-Agent": "AcornSite/1.0 (+https://useacorn.app/)",
        Accept: "application/json",
      },
      redirect: "follow",
    });
    if (!res.ok) return cachedRelease || FALLBACK;
    const release = releaseFromManifest(await res.json());
    if (!release) return cachedRelease || FALLBACK;
    cachedRelease = release;
    cachedAt = Date.now();
    return release;
  } catch {
    return cachedRelease || FALLBACK;
  }
}

function stampVersion(body, version) {
  return body
    .replaceAll(
      /class="acorn-version">[^<]*/g,
      `class="acorn-version">${version}`
    )
    .replaceAll(
      /"softwareVersion": "[^"]*"/g,
      `"softwareVersion": "${version}"`
    )
    .replaceAll(
      /Currently in beta \(v[^)]*\)/g,
      `Currently in beta (v${version})`
    );
}

async function serveVersionedAsset(request, env, release) {
  const asset = await env.ASSETS.fetch(request);
  if (request.method === "HEAD" || asset.status !== 200) return asset;

  const type = asset.headers.get("Content-Type") || "";
  const path = new URL(request.url).pathname;
  const isText =
    type.includes("text/html") ||
    type.includes("text/plain") ||
    path === "/llms.txt";
  if (!isText) return asset;

  const body = await asset.text();
  if (
    !body.includes("acorn-version") &&
    !body.includes('"softwareVersion"') &&
    !body.includes("Currently in beta (v")
  ) {
    const headers = new Headers(asset.headers);
    headers.delete("Content-Length");
    return new Response(body, { status: asset.status, headers });
  }

  const headers = new Headers(asset.headers);
  headers.delete("Content-Length");
  return new Response(stampVersion(body, release.version), {
    status: asset.status,
    headers,
  });
}

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
      cf: { cacheEverything: true, cacheTtl: 60 },
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
  headers.set("Cache-Control", "public, max-age=60");
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

const SHARE_CODE_RE = /^[0-9a-f]{24}$/;

function parseInvitePath(pathname) {
  if (pathname !== "/r" && pathname !== "/r/" && !pathname.startsWith("/r/")) {
    return null;
  }

  let rest = "";
  if (pathname !== "/r" && pathname !== "/r/") {
    rest = pathname.slice(3);
    if (rest.endsWith("/")) rest = rest.slice(0, -1);
  }

  let decoded = rest;
  try {
    decoded = rest ? decodeURIComponent(rest) : "";
  } catch {
    decoded = "";
  }

  if (!decoded || decoded.includes("/")) {
    return { valid: false, code: "" };
  }

  const code = decoded.toLowerCase();
  if (!SHARE_CODE_RE.test(code)) {
    return { valid: false, code: "" };
  }

  return { valid: true, code, canonical: `/r/${code}` };
}

function inviteHeaders(source) {
  const headers = new Headers(source);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.delete("Content-Length");
  return headers;
}

async function serveInvitePage(request, env, invite, release) {
  const asset = await env.ASSETS.fetch(new URL("/r.html", request.url));
  const headers = inviteHeaders(asset.headers);

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }

  let html = stampVersion(await asset.text(), release.version);
  if (invite.valid) {
    html = html
      .replace('<html lang="en">', '<html lang="en" data-invite="valid">')
      .replaceAll('data-invite-view="valid" hidden', 'data-invite-view="valid"')
      .replace(
        'data-invite-view="invalid"',
        'data-invite-view="invalid" hidden'
      )
      .replace(
        'id="share-code" aria-label="Share code"></code>',
        `id="share-code" aria-label="Share code">${invite.code}</code>`
      );
  } else {
    html = html.replace(
      '<html lang="en">',
      '<html lang="en" data-invite="invalid">'
    );
  }

  return new Response(html, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.pathname === "/downloads/acorn-mac.dmg" ||
      url.pathname === "/downloads/acorn-windows.exe"
    ) {
      const release = await getRelease();
      const platform =
        url.pathname === "/downloads/acorn-mac.dmg" ? "mac" : "windows";
      return proxyDownload(request, assetFor(release, platform));
    }

    const invite = parseInvitePath(url.pathname);
    if (invite) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(null, {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        });
      }
      if (invite.valid && url.pathname !== invite.canonical) {
        const dest = new URL(invite.canonical, url.origin);
        dest.search = url.search;
        return Response.redirect(dest, 301);
      }
      return serveInvitePage(request, env, invite, await getRelease());
    }
    if (
      url.pathname === "/src" ||
      url.pathname.startsWith("/src/") ||
      url.pathname === "/.git" ||
      url.pathname.startsWith("/.git/") ||
      url.pathname === "/.wrangler" ||
      url.pathname.startsWith("/.wrangler/")
    ) {
      const notFound = await env.ASSETS.fetch(
        new URL("/404.html", request.url)
      );
      return new Response(notFound.body, {
        status: 404,
        headers: notFound.headers,
      });
    }
    if (
      url.pathname === "/" ||
      url.pathname === "/index.html" ||
      url.pathname === "/r.html" ||
      url.pathname === "/llms.txt"
    ) {
      return serveVersionedAsset(request, env, await getRelease());
    }

    return env.ASSETS.fetch(request);
  },
};
