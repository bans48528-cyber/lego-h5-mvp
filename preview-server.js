const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8125);
const host = "127.0.0.1";

try {
  require("./scripts/sync-case-models")();
}
catch (error) {
  console.warn("Case model sync skipped:", error.message);
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mpd": "text/plain; charset=utf-8",
  ".ldr": "text/plain; charset=utf-8",
  ".dat": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") {
    pathname = "/index.html";
  }

  const file = path.normalize(path.join(root, pathname));
  if (!file.startsWith(root)) {
    response.writeHead(403, {"Content-Type": "text/plain; charset=utf-8"});
    response.end("Forbidden");
    return;
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    response.end(data);
  });
}).listen(port, host, () => {
  console.log(`Preview server running at http://${host}:${port}/`);
});
