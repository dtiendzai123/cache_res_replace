// == Cache Resource Replace (Tối ưu cao) ==

const TARGET = "cache_res.OdVY88vqa9NcdHWx8dKH1EWvhoo~3D";
const BASE64_URL = "https://raw.githubusercontent.com/dtiendzai123/noidungcache/main/cache_res.OdVY88vqa9NcdHWx8dKH1EWvhoo~3D%20.bundle.base64";

if ($request.url.includes(TARGET)) {
  // Gọi API GitHub để lấy dữ liệu base64
  $httpClient.get(BASE64_URL, function (error, response, body) {
    if (error || !body) {
      console.log("❌ Lỗi tải base64:", error || "Không có nội dung");
      return $done({});
    }

    try {
      const binary = $text.base64Decode(body.trim());
      return $done({
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "max-age=31536000",  // lưu cache 1 năm
          "Content-Disposition": "inline; filename=cache.bundle"
        },
        body: binary
      });
    } catch (e) {
      console.log("❌ Lỗi giải mã base64:", e);
      return $done({});
    }
  });
} else {
  $done({});
}
