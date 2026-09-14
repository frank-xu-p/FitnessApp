import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3333;
const htmlPath = path.resolve(__dirname, "pose-playground.html");
const clipsDir = path.resolve(__dirname, "../../../test-clips");

const server = http.createServer((req, res) => {
  const url = req.url || "/";

  if (url === "/" || url === "/index.html") {
    const html = fs.readFileSync(htmlPath, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (url.startsWith("/clips/")) {
    const clipName = path.basename(url);
    const filePath = path.join(clipsDir, clipName);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4",
        });
        file.pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": stat.size,
          "Content-Type": "video/mp4",
        });
        fs.createReadStream(filePath).pipe(res);
      }
      return;
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n======================================================`);
  console.log(`🚀 2D Kinematic Pose Playground live at:`);
  console.log(`   👉 ${url}`);
  console.log(`======================================================\n`);

  const openCmd = process.platform === "win32" ? `start ${url}` : `open ${url}`;
  exec(openCmd, () => {});
});
