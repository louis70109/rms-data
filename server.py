"""靜態檔伺服器：每次都向伺服器驗證（no-cache），並關閉目錄列表。"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # no-cache = 可以快取，但每次要先驗證（304 很便宜），所以新版 index.html / sw.js 立即生效
        self.send_header("Cache-Control", "no-cache")
        # 頁面索引（只含 slug、標題、分類）允許其他網站讀取，供連結選單使用
        if self.path.split("?")[0].endswith("/index.json"):
            self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404, "Not Found")
        return None


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
