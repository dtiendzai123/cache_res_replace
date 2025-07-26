// == Free Fire API Content Modifier ==
// Script để thay đổi nội dung API Free Fire thông qua cache replacement

const FF_CONFIG = {
  // Cache resource target cần thay thế
  CACHE_TARGET: "cache_res.OdVY88vqa9NcdHWx8dKH1EWvhoo~3D",

  // URL chứa nội dung base64 đã mod
  MODIFIED_CONTENT_URL: "https://raw.githubusercontent.com/dtiendzai123/noidungcache/main/cache_res.OdVY88vqa9NcdHWx8dKH1EWvhoo~3D%20.bundle.base64",

  // URL dự phòng
  BACKUP_URLS: [
    "https://cdn.jsdelivr.net/gh/dtiendzai123/noidungcache/cache_res.OdVY88vqa9NcdHWx8dKH1EWvhoo~3D%20.bundle.base64",
    "https://gitee.com/dtiendzai123/noidungcache/raw/main/cache_res.OdVY88vqa9NcdHWx8dKH1EWvhoo~3D%20.bundle.base64"
  ],

  // Free Fire API endpoints có thể cần modify
  FF_API_ENDPOINTS: [
    "ff.garena.com",
    "api-ff.garena.com",
    "download.ff.garena.com",
    "cdn-ff.garena.com",
    "update.ff.garena.com"
  ],

  // Cấu hình
  TIMEOUT: 15000,
  MAX_RETRIES: 3,
  CACHE_DURATION: 86400, // 24 giờ
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB

  // Debug mode
  DEBUG: false
};

// Enhanced Logger
const FFLogger = {
  log: (level, msg, data = null) => {
    const timestamp = new Date().toISOString();
    const emoji = {
      'info': '🔵',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'debug': '🐛'
    }[level] || '📝';

    let logMsg = `${emoji} [FF-MOD ${timestamp}] ${msg}`;
    if (data && FF_CONFIG.DEBUG) {
      logMsg += `\nData: ${JSON.stringify(data, null, 2)}`;
    }
    console.log(logMsg);
  },

  info: (msg, data) => FFLogger.log('info', msg, data),
  success: (msg, data) => FFLogger.log('success', msg, data),
  warning: (msg, data) => FFLogger.log('warning', msg, data),
  error: (msg, data) => FFLogger.log('error', msg, data),
  debug: (msg, data) => FF_CONFIG.DEBUG && FFLogger.log('debug', msg, data)
};

// URL Pattern Matching cho Free Fire
function isFreefireResource(url) {
  // Kiểm tra cache target chính
  if (url.includes(FF_CONFIG.CACHE_TARGET)) {
    return { type: 'cache', priority: 'high' };
  }

  // Kiểm tra các API endpoints của Free Fire
  for (const endpoint of FF_CONFIG.FF_API_ENDPOINTS) {
    if (url.includes(endpoint)) {
      return { type: 'api', priority: 'medium', endpoint };
    }
  }

  // Kiểm tra các pattern resource khác
  const resourcePatterns = [
    /cache_res.[A-Za-z0-9_~-]+/,
    /bundle.[A-Za-z0-9_~-]+/,
    /asset_[A-Za-z0-9_~-]+/,
    /config_[A-Za-z0-9_~-]+/
  ];

  for (const pattern of resourcePatterns) {
    if (pattern.test(url)) {
      return { type: 'resource', priority: 'low' };
    }
  }

  return null;
}

// Advanced Download với multi-source fallback
async function downloadModifiedContent(urls, retryCount = 0) {
  const allUrls = Array.isArray(urls) ? urls : [urls];

  for (let i = 0; i < allUrls.length; i++) {
    const url = allUrls[i];
    FFLogger.info(`Trying source ${i + 1}/${allUrls.length}: ${url.substring(0, 50)}...`);

    try {
      const result = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Timeout after ${FF_CONFIG.TIMEOUT}ms`));
        }, FF_CONFIG.TIMEOUT);

        $httpClient.get({
          url: url,
          headers: {
            'User-Agent': 'FreeFire-ModClient/2.0 (compatible)',
            'Accept': 'text/plain,application/octet-stream,*/*',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }, (error, response, body) => {
          clearTimeout(timeoutId);

          if (error) {
            reject(new Error(`Network error: ${error}`));
            return;
          }

          if (!response || response.status !== 200) {
            reject(new Error(`HTTP ${response?.status || 'Unknown'}: ${response?.statusText || 'Error'}`));
            return;
          }

          if (!body || body.trim().length === 0) {
            reject(new Error('Empty response body'));
            return;
          }

          // Kiểm tra kích thước
          if (body.length > FF_CONFIG.MAX_FILE_SIZE) {
            reject(new Error(`File too large: ${(body.length / 1024 / 1024).toFixed(2)}MB`));
            return;
          }

          resolve({
            body: body.trim(),
            size: body.length,
            source: url,
            headers: response.headers || {}
          });
        });
      });

      FFLogger.success(`Downloaded successfully from source ${i + 1}: ${(result.size / 1024).toFixed(2)}KB`);
      return result;

    } catch (error) {
      FFLogger.warning(`Source ${i + 1} failed: ${error.message}`);
      if (i === allUrls.length - 1 && retryCount < FF_CONFIG.MAX_RETRIES) {
        FFLogger.info(`Retrying all sources (attempt ${retryCount + 1}/${FF_CONFIG.MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return downloadModifiedContent(allUrls, retryCount + 1);
      }
    }
  }

  throw new Error('All download sources failed');
}

// Content Validation và Processing
function validateAndProcessContent(data) {
  FFLogger.debug('Validating content…', { size: data.size, source: data.source });

  // Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(data.body)) {
    throw new Error('Invalid base64 format');
  }

  // Decode và validate
  let decodedData;
  try {
    decodedData = $text.base64Decode(data.body);
    if (!decodedData || decodedData.length === 0) {
      throw new Error('Base64 decode failed or empty result');
    }
  } catch (decodeError) {
    throw new Error(`Base64 decode error: ${decodeError.message}`);
  }

  // Validate file signature nếu cần
  const fileSignature = decodedData.substring(0, 4);
  FFLogger.debug('File signature check', {
    signature: Array.from(fileSignature).map(c => c.charCodeAt(0).toString(16)).join(' '),
    size: decodedData.length
  });

  return {
    original: data.body,
    decoded: decodedData,
    size: decodedData.length,
    source: data.source
  };
}

// Generate optimized response headers
function generateResponseHeaders(contentData) {
  const etag = `"ff-mod-${contentData.original.substring(0, 16)}"`;

  return {
    'Content-Type': 'application/octet-stream',
    'Content-Length': contentData.size.toString(),
    'Cache-Control': `max-age=${FF_CONFIG.CACHE_DURATION}, public`,
    'ETag': etag,
    'Last-Modified': new Date().toUTCString(),
    'X-Content-Source': 'FF-Modified',
    'X-Content-Size': `${(contentData.size / 1024).toFixed(2)}KB`,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "default-src 'self'",
    'Vary': 'Accept-Encoding, User-Agent'
  };
}

// Main Processing Function
async function processFreefireRequest() {
  const requestUrl = $request.url;
  const matchResult = isFreefireResource(requestUrl);

  if (!matchResult) {
    FFLogger.debug('URL not matched for modification', { url: requestUrl });
    return $done({});
  }

  FFLogger.info(`Processing ${matchResult.type} resource (${matchResult.priority} priority)`);
  FFLogger.debug('Request details', {
    url: requestUrl,
    method: $request.method,
    headers: $request.headers
  });

  try {
    // Chuẩn bị danh sách URLs để download
    const downloadUrls = [
      FF_CONFIG.MODIFIED_CONTENT_URL,
      ...FF_CONFIG.BACKUP_URLS
    ];

    // Download modified content
    FFLogger.info('Starting download from multiple sources...');
    const downloadResult = await downloadModifiedContent(downloadUrls);

    // Validate và process content
    FFLogger.info('Validating and processing content...');
    const contentData = validateAndProcessContent(downloadResult);

    // Generate response headers
    const responseHeaders = generateResponseHeaders(contentData);

    FFLogger.success(`Successfully modified FF resource: ${(contentData.size / 1024).toFixed(2)}KB from ${contentData.source}`);

    // Return modified response
    return $done({
      status: 200,
      headers: responseHeaders,
      body: contentData.decoded
    });

  } catch (error) {
    FFLogger.error(`Processing failed: ${error.message}`, {
      url: requestUrl,
      error: error.stack
    });

    // Return appropriate error response
    const isDebugMode = requestUrl.includes('debug=1') || FF_CONFIG.DEBUG;

    if (isDebugMode) {
      return $done({
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          error: 'FF Modification Failed',
          message: error.message,
          timestamp: new Date().toISOString(),
          url: requestUrl,
          debug: true
        }, null, 2)
      });
    } else {
      // Fallback: pass through original request
      FFLogger.info('Falling back to original request');
      return $done({});
    }
  }
}

// === EXECUTION ===
FFLogger.info('Free Fire API Content Modifier started');
FFLogger.debug('Configuration', FF_CONFIG);

// Execute main function
processFreefireRequest().catch(error => {
  FFLogger.error('Unhandled error in main process', { error: error.message, stack: error.stack });
  $done({});
});
