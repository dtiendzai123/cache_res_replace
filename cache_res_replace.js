// =============================================================
// DIRECTORY CONTENT API MODIFIER — SHADOWROCKET SAFE FIX
// Request-only | Single $done | No Loop | Stable
// =============================================================

// ================= CONFIG =================
const DIR_CONFIG = {
  GITHUB_API: {
    RAW_URL: "https://raw.githubusercontent.com/dtiendzai123/noidungcache/main"
  },

  DIRECTORY_MAPPINGS: {
    "cache_res": "modified_cache",
    "assets": "modified_assets",
    "bundles": "modified_bundles",
    "configs": "modified_configs",
    "data": "modified_data"
  },

  SUPPORTED_EXTENSIONS: [
    ".bundle", ".json", ".xml", ".txt",
    ".dat", ".bin", ".cfg", ".ini"
  ],

  TARGET_HOSTS: [
    "api-ff.garena.com",
    "download.ff.garena.com",
    "cdn.jsdelivr.net"
  ],

  CACHE_DURATION: 3600,
  TIMEOUT: 15000,
  DEBUG: false
};

// ================= LOGGER =================
function Log(msg, data) {
  if (!DIR_CONFIG.DEBUG) return;
  console.log("[DIR]", msg, data || "");
}

// ================= URL PARSER (SAFE) =================
function parseUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const filename = parts[parts.length - 1] || "";
    const ext = filename.includes(".")
      ? filename.substring(filename.lastIndexOf("."))
      : "";

    return { host: u.host, path: u.pathname, ext };
  } catch (e) {
    return null;
  }
}

// ================= CHECK =================
function shouldProcess(p) {
  if (!p) return false;

  const hostOk = DIR_CONFIG.TARGET_HOSTS.some(h => p.host.includes(h));
  const extOk = DIR_CONFIG.SUPPORTED_EXTENSIONS.includes(p.ext);
  const needMap = Object.keys(DIR_CONFIG.DIRECTORY_MAPPINGS)
    .some(d => p.path.includes("/" + d + "/"));

  return hostOk && (extOk || needMap);
}

// ================= MAP DIRECTORY =================
function mapPath(path) {
  let mapped = path;
  for (const from in DIR_CONFIG.DIRECTORY_MAPPINGS) {
    const to = DIR_CONFIG.DIRECTORY_MAPPINGS[from];
    const reg = new RegExp("/" + from + "(/|$)");
    if (reg.test(mapped)) {
      mapped = mapped.replace(reg, "/" + to + "$1");
      break;
    }
  }
  return mapped.replace(/^\/+/, "");
}

// ================= FETCH FROM GITHUB =================
function fetchGitHub(path) {
  return new Promise(resolve => {
    const url = DIR_CONFIG.GITHUB_API.RAW_URL + "/" + path;
    Log("Fetch GitHub", url);

    $httpClient.get({ url, timeout: DIR_CONFIG.TIMEOUT }, (err, resp, body) => {
      if (err || !resp || resp.statusCode !== 200 || !body) {
        resolve(null);
      } else {
        resolve(body);
      }
    });
  });
}

// ================= MAIN =================
(async function () {
  if (typeof $request === "undefined") {
    $done({});
    return;
  }

  // 🚫 Bypass GitHub request để tránh loop
  if ($request.url.includes("raw.githubusercontent.com")) {
    $done({});
    return;
  }

  try {
    const parsed = parseUrl($request.url);
    if (!shouldProcess(parsed)) {
      $done({});
      return;
    }

    const mappedPath = mapPath(parsed.path);
    const content = await fetchGitHub(mappedPath);

    if (!content) {
      $done({});
      return;
    }

    $done({
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "max-age=" + DIR_CONFIG.CACHE_DURATION
      },
      body: content
    });

  } catch (e) {
    $done({});
  }
})();
