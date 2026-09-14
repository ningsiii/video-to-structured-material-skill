# Video acquisition

The Skill uses the MIT-licensed `ljb1020/video-batch-download` project at a pinned revision. It uses Playwright to resolve public pages, FFmpeg to validate or merge media, and local `faster-whisper` to create timed speech segments.

Install it explicitly:

```bash
npm run setup:video
```

The first setup installs a browser runtime, a Python virtual environment, FFmpeg, faster-whisper, and OpenCC. The first Whisper run may download a model and take several minutes.

Supported public-video adapters currently include Douyin, Xiaohongshu video notes, Bilibili, Kuaishou, and Weibo. Private content, expired links, image-only Xiaohongshu notes, verification challenges, and platform changes may fail. Use a canonical public URL when possible. If acquisition fails, ask for a local video, an existing downloader JSON file, or timed SRT/VTT; never bypass access controls.

Downloaded media is processing input, not the durable deliverable. The wrapper asks the downloader not to copy video into the item folder and removes its temporary job directory after normalization unless `--keep-runtime-output` was explicitly requested.

Upstream: https://github.com/ljb1020/video-batch-download
