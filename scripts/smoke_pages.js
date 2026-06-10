const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pages = ["app/player.html", "app/ops.html", "app/index.html"];

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const scripts = Array.from(html.matchAll(/<script src="(.+?)"><\/script>/g)).map((match) => match[1]);
  const styles = Array.from(html.matchAll(/<link rel="stylesheet" href="(.+?)"/g)).map((match) => match[1]);
  for (const asset of [...scripts, ...styles]) {
    const assetPath = path.join(root, path.dirname(page), asset.split("?")[0]);
    if (!fs.existsSync(assetPath)) {
      throw new Error(`${page} references missing asset ${asset}`);
    }
  }
}

console.log("Page smoke tests passed");
