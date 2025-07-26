// == Directory Content API Modifier ==

const DIR_CONFIG = {
  GITHUB_API: {
    BASE_URL: "https://api.github.com/repos/dtiendzai123/noidungcache",
    RAW_URL: "https://raw.githubusercontent.com/dtiendzai123/noidungcache/main",
    TOKEN: null,
    BRANCH: "main"
  },

  DIRECTORY_MAPPINGS: {
    "cache_res": "modified_cache",
    "assets": "modified_assets",
    "bundles": "modified_bundles",
    "configs": "modified_configs",
    "data": "modified_data",
    "original_folder": "replacement_folder",
    "game_data": "modded_game_data"
  },

  SUPPORTED_EXTENSIONS: [
    ".bundle", ".json", ".xml", ".txt", ".dat",
    ".bin", ".cfg", ".ini", ".properties"
  ],

  TARGET_APIS: [
    "api.github.com",
    "raw.githubusercontent.com",
    "cdn.jsdelivr.net",
    "gitee.com",
    "api-ff.garena.com",
    "download.ff.garena.com"
  ],

  CACHE_DURATION: 3600,
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  TIMEOUT: 15000,
  MAX_RETRIES: 3,
  BATCH_SIZE: 10,
  DEBUG: false
};

const DirLogger = {
  _log: (level, msg, data = null) => {
    const icons = {
      info: "📁", success: "✅", warning: "⚠️",
      error: "❌", debug: "🔍", api: "🌐"
    };
    const timestamp = new Date().toISOString();
    let logMsg = `${icons[level] || '📝'} [DIR-API ${timestamp}] ${msg}`;
    if (data && DIR_CONFIG.DEBUG) {
      logMsg += `\n${JSON.stringify(data, null, 2)}`;
    }
    console.log(logMsg);
  },
  info: (msg, data) => DirLogger._log('info', msg, data),
  success: (msg, data) => DirLogger._log('success', msg, data),
  warning: (msg, data) => DirLogger._log('warning', msg, data),
  error: (msg, data) => DirLogger._log('error', msg, data),
  debug: (msg, data) => DIR_CONFIG.DEBUG && DirLogger._log('debug', msg, data),
  api: (msg, data) => DirLogger._log('api', msg, data)
};

class DirectoryParser {
  static parseUrl(url) {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(p => p);

    return {
      host: urlObj.host,
      protocol: urlObj.protocol,
      path: urlObj.pathname,
      directory: pathParts[pathParts.length - 2] || '',
      filename: pathParts[pathParts.length - 1] || '',
      extension: this.getExtension(pathParts[pathParts.length - 1] || ''),
      pathParts,
      queryParams: Object.fromEntries(urlObj.searchParams)
    };
  }

  static getExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
  }

  static shouldProcess(parsedUrl) {
    const isTargetAPI = DIR_CONFIG.TARGET_APIS.some(api =>
      parsedUrl.host.includes(api)
    );
    const isSupportedExt = DIR_CONFIG.SUPPORTED_EXTENSIONS.includes(parsedUrl.extension) ||
      parsedUrl.extension === '';
    const needsMapping = Object.keys(DIR_CONFIG.DIRECTORY_MAPPINGS)
      .some(dir => parsedUrl.path.includes(dir));

    return {
      shouldProcess: isTargetAPI && (isSupportedExt || needsMapping),
      reason: {
        isTargetAPI,
        isSupportedExt,
        needsMapping,
        directory: parsedUrl.directory,
        extension: parsedUrl.extension
      }
    };
  }

  static mapDirectory(originalPath) {
    let mappedPath = originalPath;
    for (const [originalDir, mappedDir] of Object.entries(DIR_CONFIG.DIRECTORY_MAPPINGS)) {
      if (originalPath.includes(originalDir)) {
        mappedPath = originalPath.replace(originalDir, mappedDir);
        DirLogger.debug(`Directory mapped: ${originalDir} -> ${mappedDir}`);
        break;
      }
    }
    return mappedPath;
  }
}
class GitHubAPIClient {
  static async fetchFile(path) {
    const url = `${DIR_CONFIG.GITHUB_API.RAW_URL}/${DIR_CONFIG.GITHUB_API.BRANCH}/${path}`;
    DirLogger.api("🔗 Fetching GitHub file:", url);

    try {
      const response = await new Promise((resolve, reject) => {
        $httpClient.get({ url, timeout: DIR_CONFIG.TIMEOUT }, (err, resp, body) => {
          if (err || resp.status !== 200) {
            reject(err || new Error(`Status ${resp.status}`));
          } else {
            resolve(body);
          }
        });
      });

      return response;
    } catch (error) {
      DirLogger.error("❌ GitHub file fetch failed:", error);
      return null;
    }
  }
}

class DirectoryManager {
  static async process(url) {
    const parsed = DirectoryParser.parseUrl(url);
    const decision = DirectoryParser.shouldProcess(parsed);

    DirLogger.info(`📂 Processing request: ${url}`, parsed);

    if (!decision.shouldProcess) {
      DirLogger.warning("⚠️ Skipping non-targeted URL.", decision.reason);
      return null;
    }

    const mappedPath = DirectoryParser.mapDirectory(parsed.path);
    const cleanPath = mappedPath.replace(/^\/+/, '');

    DirLogger.debug("📁 Fetching mapped file path:", cleanPath);

    const fileContent = await GitHubAPIClient.fetchFile(cleanPath);

    if (fileContent !== null) {
      DirLogger.success("✅ File replacement successful.", { mappedPath });
    }

    return fileContent;
  }
}

async function processDirectoryRequest() {
  if (typeof $request === "undefined") return;

  try {
    const originalUrl = $request.url;
    const modified = await DirectoryManager.process(originalUrl);

    if (modified !== null) {
      $done({
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": `max-age=${DIR_CONFIG.CACHE_DURATION}`
        },
        body: modified
      });
    } else {
      DirLogger.warning("⚠️ No modified file found. Letting original pass through.");
      $done({});
    }
  } catch (err) {
    DirLogger.error("❌ Failed to process request.", err);
    $done({});
  }
}

// Start processing
processDirectoryRequest();
