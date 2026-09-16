---
name: video-to-structured-material
description: Turn a public Douyin, Xiaohongshu, Bilibili, Kuaishou, or Weibo video link, a local downloader JSON result, or supplied timed transcript into traceable SRT, user-defined semantic sections, JSON, Excel, and optionally a Feishu spreadsheet. Use when the user wants reusable video breakdown data rather than a prose-only summary.
---

# Video to Structured Material

Produce one inspectable content package per video without imposing a universal video formula. This version does not maintain a cross-video library, append to an existing workbook, or write Feishu Bitable records.

Resolve the directory containing this `SKILL.md` as the Skill root and run all repository commands with that directory as the working directory. Output may be written to a user-selected absolute path.

## Required choices

Before analysis, obtain or infer:

- the source link or a local downloader JSON file;
- a breakdown profile whose categories each have an ID, label, and concrete definition;
- the destination: local files, a newly imported Feishu spreadsheet, or both.

If the user has not defined the categories, help them draft a profile and ask them to approve it. Do not silently substitute Hook/Problem/CTA or any other preset as universal truth.

## Workflow

1. Run `npm install` if dependencies are absent.
2. For a public link, read [references/video-acquisition.md](references/video-acquisition.md). Never claim that every public link is downloadable or bypass a login, private-content, or verification control.
3. Run `node scripts/run.mjs --url "<url>" --profile "<profile.json>"`. For an existing downloader result use `--source-json` instead. Unless the user chose `--output`, the wrapper creates `output/<platform>-<content-id>/` so another video does not overwrite it.
4. If the command exits with code 3, it created `analysis-request.json` and `source-normalized.json`. Use the current Agent's model to return exactly the requested JSON shape, save it as `analysis-response.json`, then run the full continuation command printed by the wrapper. Keep its `--output` value so short-link inputs continue in the same directory. Do not redownload the link or invent or alter timestamps.
5. Inspect `result.json`, `transcript.srt`, and `materials.xlsx`. Report uncertainties and acquisition limitations.
6. Only when the user requested Feishu, read [references/feishu.md](references/feishu.md) and rerun with `--feishu`. External writes require an explicit destination choice.

The CLI may call an OpenAI-compatible model automatically only when `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` are configured. Otherwise the current Agent host processes `analysis-request.json`; explain that the host's own model and privacy settings govern that text. Raw cues remain in the result; AI-cleaned text is a proposal tied to the same cue index and timestamps. Persisted source URLs are cleaned of known share tokens and tracking parameters.

Read [references/output-contract.md](references/output-contract.md) when integrating another destination or validating downstream fields.
