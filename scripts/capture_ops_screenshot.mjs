import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const opsUrl = pathToFileURL(resolve(root, "app", "ops.html"));
opsUrl.searchParams.set("preview", "readme");

execFileSync(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--force-device-scale-factor=1",
  "--window-size=1440,1000",
  `--screenshot=${resolve(root, "docs", "assets", "ops-workbench-feedback.png")}`,
  opsUrl.href,
], { stdio: "inherit" });

console.log("Generated ops README screenshot.");
