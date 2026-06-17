import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const tempDir = mkdtempSync(join(tmpdir(), "gcsa-readme-shots-"));

const baseStyles = `
  :root {
    --brand: #145c54;
    --brand-soft: #eaf4f1;
    --line: #d9e0e8;
    --muted: #66757a;
    --text: #223033;
  }
  * { box-sizing: border-box; }
  html, body {
    width: 430px;
    margin: 0;
    background: #ffffff;
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .phone {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    width: 430px;
    height: 900px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.78);
    border-radius: 28px;
    background: #f7f8f5;
    box-shadow: 0 20px 52px rgba(14, 33, 37, 0.18);
  }
  .status {
    display: flex;
    justify-content: space-between;
    padding: 10px 20px 6px;
    background: #ffffff;
    color: #243233;
    font-size: 12px;
    font-weight: 700;
  }
  .header {
    display: grid;
    grid-template-columns: 78px minmax(0, 1fr) 78px;
    align-items: center;
    gap: 8px;
    padding: 8px 16px 13px;
    border-bottom: 1px solid rgba(217, 224, 232, 0.8);
    background: #ffffff;
  }
  .back {
    display: inline-grid;
    width: 36px;
    height: 36px;
    place-items: center;
    border-radius: 999px;
    background: #eef4f1;
    color: var(--brand);
    font-size: 30px;
    line-height: 1;
  }
  .debug {
    margin-left: 8px;
    color: var(--brand);
    font-size: 12px;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
    vertical-align: 9px;
  }
  .title {
    margin: 0;
    font-size: 17px;
    line-height: 1.25;
    text-align: center;
  }
  .subtitle {
    margin: 3px 0 0;
    color: #5f6e73;
    font-size: 12px;
    text-align: center;
  }
  .badge {
    display: grid;
    justify-self: end;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 999px;
    background: var(--brand);
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
  }
  .messages {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    padding: 16px;
    overflow: hidden;
    background:
      linear-gradient(180deg, rgba(247, 248, 245, 0.92), rgba(239, 244, 242, 0.95)),
      #f1f4f2;
  }
  .message {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 8px;
    max-width: 86%;
    white-space: normal;
  }
  .message.user {
    align-self: flex-end;
    grid-template-columns: minmax(0, 1fr) 34px;
  }
  .avatar {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    align-self: start;
    border: 1px solid rgba(20, 92, 84, 0.1);
    border-radius: 999px;
    background: #eaf4f1;
    color: var(--brand);
    font-size: 11px;
    font-weight: 800;
    box-shadow: 0 8px 18px rgba(22, 31, 44, 0.06);
  }
  .message.user .avatar {
    grid-column: 2;
    grid-row: 1;
    background: var(--brand);
    color: #ffffff;
  }
  .body {
    display: grid;
    gap: 5px;
    min-width: 0;
  }
  .message.user .body {
    grid-column: 1;
    grid-row: 1;
    justify-items: end;
  }
  .speaker {
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.2;
  }
  .message.user .speaker {
    color: #55706c;
    text-align: right;
  }
  .bubble {
    display: block;
    padding: 10px 12px;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 8px 18px rgba(22, 31, 44, 0.06);
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .message.agent .bubble { border-top-left-radius: 3px; }
  .message.user .bubble {
    border-top-right-radius: 3px;
    background: var(--brand);
    color: #ffffff;
    text-align: left;
  }
  .composer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 42px 64px;
    align-items: center;
    gap: 8px;
    padding: 10px 12px 12px;
    border-top: 1px solid rgba(217, 224, 232, 0.9);
    background: rgba(255, 255, 255, 0.96);
  }
  .input {
    min-height: 42px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: #f5f7f6;
    color: #8a9598;
    font-size: 15px;
    line-height: 42px;
  }
  .upload {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 42px;
    width: 42px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: #f5f7f6;
    color: var(--brand);
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
  }
  .send {
    min-height: 42px;
    border-radius: 999px;
    background: var(--brand);
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    line-height: 42px;
    text-align: center;
  }
  .feedback-card {
    display: grid;
    gap: 8px;
    padding: 12px;
    border: 1px solid #dfe7e3;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 8px 20px rgba(22, 31, 44, 0.05);
  }
  .card-title {
    margin: 0;
    font-size: 15px;
    line-height: 1.35;
  }
  .field {
    display: grid;
    gap: 3px;
    padding: 6px 0;
    border-top: 1px solid #edf1ef;
  }
  .field strong {
    color: #59696c;
    font-size: 12px;
  }
  .field span {
    font-size: 13px;
    line-height: 1.45;
  }
  .card-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 2px;
  }
  .card-actions span {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    background: var(--brand);
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
  }
  .card-actions .secondary {
    border: 1px solid var(--line);
    background: #f5f7f6;
    color: var(--brand);
  }
`;

function message(role, text) {
  const speaker = role === "agent" ? "示例客服" : "我";
  const avatar = role === "agent" ? "AI" : "我";
  return `
    <article class="message ${role}">
      <span class="avatar">${avatar}</span>
      <div class="body">
        <span class="speaker">${speaker}</span>
        <span class="bubble">${text}</span>
      </div>
    </article>
  `;
}

function card() {
  return `
    <article class="feedback-card">
      <h2 class="card-title">请确认反馈内容</h2>
      <div class="field"><strong>反馈类型</strong><span>游戏 BUG</span></div>
      <div class="field"><strong>玩家 UID</strong><span>10086</span></div>
      <div class="field"><strong>问题摘要</strong><span>对局里突然卡住，点击无响应。</span></div>
      <div class="field"><strong>发生时间</strong><span>今天 20:00 左右</span></div>
      <div class="field"><strong>玩法场景</strong><span>经典房间</span></div>
      <div class="field"><strong>补充说明</strong><span>iPhone 14，iOS 17，版本 1.8.2，暂无截图。</span></div>
      <div class="card-actions"><span class="secondary">继续补充</span><span>确认提交</span></div>
    </article>
  `;
}

function page(messages) {
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <style>${baseStyles}</style>
    </head>
    <body>
      <main class="phone">
        <div class="status"><span>9:41</span><span>5G 100%</span></div>
        <header class="header">
          <div><span class="back">‹</span><span class="debug">调试</span></div>
          <div><h1 class="title">示例棋牌项目客服</h1><p class="subtitle">在线 · 通常几秒内回复</p></div>
          <span class="badge">AI</span>
        </header>
        <section class="messages">${messages.join("")}</section>
        <form class="composer">
          <div class="input">输入问题或反馈编号</div>
          <div class="upload">＋</div>
          <div class="send">发送</div>
        </form>
      </main>
    </body>
  </html>`;
}

const shots = [
  {
    name: "player-feedback-flow",
    height: 900,
    messages: [
      message("user", "bug"),
      message("agent", "请问具体遇到了什么问题？比如卡住、闪退、黑屏、显示异常，还是结算不对？"),
      message("user", "对局里突然卡住了，点什么都没反应"),
      message("agent", "收到，我先帮您记录。请先提供玩家 UID，方便客服同学后续核查。"),
      message("user", "UID 10086"),
      message("agent", "请问大概什么时候发生？发生在哪个玩法或房间？"),
      message("user", "今天 20:00 左右，经典房间"),
      message("agent", "还需要补充一下设备、系统版本、游戏版本，以及是否有截图或录屏。"),
    ],
  },
  {
    name: "player-feedback-confirm",
    height: 900,
    messages: [
      message("user", "iPhone 14，iOS 17，版本 1.8.2，没有截图"),
      message("agent", "信息已收集，我先整理成反馈卡，请确认后提交。"),
      card(),
    ],
  },
  {
    name: "player-submit-success",
    height: 900,
    messages: [
      message("agent", "请确认反馈内容，确认后我会提交给客服同学，并生成反馈编号。"),
      message("user", "确认提交"),
      message("agent", "已提交反馈，反馈编号：FB202606160001。客服同学会按优先级继续跟进。"),
      message("user", "FB202606160001 处理到哪了"),
      message("agent", "反馈编号：FB202606160001\n当前状态：已提交\n问题摘要：玩家反馈对局连续卡住，点击无响应。"),
    ],
  },
];

for (const shot of shots) {
  const htmlPath = join(tempDir, `${shot.name}.html`);
  const outPath = join(root, "docs", "assets", `${shot.name}.png`);
  writeFileSync(htmlPath, page(shot.messages));
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--force-device-scale-factor=1",
    `--window-size=430,${shot.height}`,
    `--screenshot=${outPath}`,
    pathToFileURL(htmlPath).href,
  ], { stdio: "inherit" });
}

console.log(`Generated ${shots.length} README screenshots.`);
