# Video to Structured Material Skill

把公开视频链接或带时间码的转录，变成可追溯的 SRT、由使用者自定义的视频结构、JSON、Excel，以及可选的飞书表格。

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

## 快速开始

需要 Node.js 20+、Git 和 Python 3.10+。

```bash
npm install
npm run setup:video
node scripts/run.mjs --url "你的公开视频链接" --profile profiles/example.json --output output
```

没有配置模型时，命令会生成 `output/analysis-request.json` 并以状态码 3 结束。让支持 Skill 的 Agent 按请求生成 `analysis-response.json`，然后继续：

```bash
node scripts/run.mjs --source-json output/source-normalized.json --profile profiles/example.json --output output --analysis-json output/analysis-response.json
```

若希望 CLI 自动调用模型，配置 `OPENAI_API_KEY`、`OPENAI_BASE_URL` 和 `OPENAI_MODEL`。不要提交 `.env`。

已经有下载器 JSON 时，可跳过链接获取：

```bash
node scripts/run.mjs --source-json ./video.json --profile profiles/example.json --output output --analysis-json ./analysis.json
```

## 飞书

飞书是可选目的地。项目调用飞书官方开源 `@larksuite/cli`，认证、二维码和 token 均由官方 CLI 处理。本项目只把已生成的 `.xlsx` 交给它导入。

完成官方 CLI 授权后，在运行命令末尾增加 `--feishu` 即可将 `materials.xlsx` 导入为飞书电子表格。

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
