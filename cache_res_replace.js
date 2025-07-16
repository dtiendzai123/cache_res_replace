// cache_res_replace.js

if ($request.url.includes("cache_res.OdVY88vqa9NcdHWx8dKH1EWvhoo~3D")) {
  // Lấy file base64 từ GitHub raw
  $httpClient.get("https://raw.githubusercontent.com/username/repo/main/headbot.bundle.base64", (err, res, data) => {
    if (err) {
      $done({});
    } else {
      // Giải mã base64 thành binary
      let binaryData = $text.base64Decode(data);
      $done({
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream"
        },
        body: binaryData
      });
    }
  });
} else {
  $done({});
}
