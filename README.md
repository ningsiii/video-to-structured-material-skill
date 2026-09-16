# Video to Structured Material Skill

把一条公开视频链接或一份带时间码的转录，变成一个可追溯的单视频材料包：SRT、由使用者自定义的视频结构、JSON、Excel，以及可选的飞书电子表格。

这个项目不内置“所有视频都应该分成 Hook、痛点、方法、CTA”之类的唯一答案。使用者先在 Profile 里定义想拆成哪些部分及其含义，AI 只能在这些定义内分类，并且每个结果都保留原始时间码和文本。

安装到支持 Agent Skills 的工具：

```bash
npx skills add https://github.com/ningsiii/video-to-structured-material-skill -y -g
```

## 输出链路

```text
公开视频链接 / 已有 JSON
  → 本地获取与 faster-whisper 转录
  → 保守字幕清洗
  → 按用户 Profile 完整分段
  → result.json + transcript.srt + materials.xlsx
  → 可选导入飞书
```

当前版本的边界很明确：**一条视频生成一个独立材料包**。它不是长期内容库，不会把新视频追加进旧 Excel，也不会直接写入飞书多维表格。这样更容易安装、检查和迁移；长期 Library 或多维表格属于后续可选集成。

## 快速开始

需要 Node.js 20+、Git 和 Python 3.10+。

```bash
npm install
npm run setup:video
node scripts/run.mjs --url "你的公开视频链接" --profile profiles/example.json
```

不传 `--output` 时，程序会按“平台 + 视频 ID”创建独立目录，例如 `output/douyin-0000000000000000000/`，所以处理下一条视频不会覆盖上一条。也可以用 `--output <目录>` 明确指定位置。

没有配置模型时，命令会生成 `analysis-request.json` 并以状态码 3 结束。让支持 Skill 的 Agent 按请求生成 `analysis-response.json`，然后执行终端中打印出的继续命令；它会复用同一个材料目录。例如：

```bash
node scripts/run.mjs --source-json output/douyin-0000000000000000000/source-normalized.json --profile profiles/example.json --output output/douyin-0000000000000000000 --analysis-json output/douyin-0000000000000000000/analysis-response.json
```

若希望 CLI 自动调用模型，配置 `OPENAI_API_KEY`、`OPENAI_BASE_URL` 和 `OPENAI_MODEL`。不要提交 `.env`。

已经有下载器 JSON 时，可跳过链接获取：

```bash
node scripts/run.mjs --source-json ./video.json --profile profiles/example.json --analysis-json ./analysis.json
```

## 数据在哪里处理

- 视频获取和 Whisper 转录在本机运行；默认最终材料不保留下载的视频。
- 未配置 API 时，当前 Codex、WorkBuddy 或其他 Agent 根据 `analysis-request.json` 清洗和拆解字幕。文本是否离开本机取决于该宿主自身使用的模型与隐私设置。
- 只有同时配置 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 时，CLI 才会主动请求该兼容接口。仓库不包含任何 API key，`.env` 也不会提交。
- 写入 JSON 和 Excel 前会移除小红书、抖音等链接中的分享 token、追踪参数和 URL fragment；下载阶段仍可临时使用原始分享链接。
- 只有用户明确选择 `--feishu` 时才会调用飞书官方 CLI。

## 飞书

飞书是可选目的地。项目调用飞书官方开源 `@larksuite/cli`，认证、二维码和 token 均由官方 CLI 处理。本项目只把已生成的 `.xlsx` 交给它导入。

完成官方 CLI 授权后，在运行命令末尾增加 `--feishu` 即可将 `materials.xlsx` 导入为一个新的飞书电子表格。当前版本不追加到已有表格，也不创建飞书多维表格。

详见 [`references/feishu.md`](references/feishu.md)。

## 真实边界

- 公开可见不代表一定能稳定解析；平台页面、短链和风控随时可能变化。
- 不处理私密内容，不绕过登录或验证控制。
- 小红书只支持视频笔记；图片/文字笔记不是视频输入。
- 没有现成字幕时需要下载媒体并在本地运行 Whisper，因此首次安装和首次模型下载不会是瞬间完成。
- 默认最终交付不保留下载的视频；JSON、SRT 和 Excel 会保留。
- 获取或转录失败时，上游会在输出目录的 `.acquisition` 中暂存媒体和失败状态，方便诊断或重试。确认不再重试后可以删除该目录。

## 开源依赖与署名

视频获取与本地转录使用 MIT 许可的 [`ljb1020/video-batch-download`](https://github.com/ljb1020/video-batch-download)，安装脚本锁定并校验已审阅的提交与许可证哈希。本仓库不复制其实现。

本项目采用 MIT License。
