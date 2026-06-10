# 本地页面访问地址

更新时间：2026-06-01  
用途：避免多个本地项目共用端口导致页面混淆。

## 1. 本项目专用端口

本项目固定使用：

```text
http://127.0.0.1:5188
```

启动命令：

```bash
python3 -m http.server 5188 --bind 127.0.0.1
```

请在项目根目录运行：

```text
<project-root>
```

## 2. 页面入口

| 页面 | 地址 | 用途 |
| --- | --- | --- |
| 玩家端 WebView | `http://127.0.0.1:5188/app/player.html` | 玩家咨询、提交反馈、查询进度 |
| 产品运营端工作台 | `http://127.0.0.1:5188/app/ops.html` | 内部查看、筛选、处理、流转反馈 |
| Debug 页 | `http://127.0.0.1:5188/app/` | 开发调试完整链路 |

当前玩家端缓存刷新地址：

```text
http://127.0.0.1:5188/app/player.html?v=money-clarify-1
```

说明：

- 普通地址适合日常访问。
- 带 `v=` 的地址适合刚改完脚本后强制浏览器加载最新版本。

## 3. 不建议直接打开 HTML 文件

不要在浏览器中直接打开 `app/player.html` 文件。

原因：

- 直接打开本地 HTML 文件时，浏览器会限制 JSON 数据加载。
- Agent 需要读取 `data/knowledge_base` 和 `data/agent` 下的 JSON 数据。

也不建议继续使用：

```text
http://127.0.0.1:5173
```

原因：

- 该端口可能被其他本地项目占用。
- 容易打开到另一个项目的页面。

## 4. 快速检查

```bash
curl -I http://127.0.0.1:5188/app/player.html
curl -I http://127.0.0.1:5188/app/ops.html
```

预期返回：

```text
HTTP/1.0 200 OK
```
