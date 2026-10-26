"""靜態檔伺服器：每次都向伺服器驗證（no-cache），並關閉目錄列表。"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # no-cache = 可以快取，但每次要先驗證（304 很便宜），所以新版 index.html / sw.js 立即生效
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404, "Not Found")
        return None


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
