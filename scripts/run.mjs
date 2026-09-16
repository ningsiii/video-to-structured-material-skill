#!/usr/bin/env node
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { buildAnalysisRequest, deriveMaterialSlug, materializeResult, normalizeSource, normalizeVideoInput, readProfile, serializeSrt, sourceIdentityFromUrl, validateAnalysis } from './lib/core.mjs';
import { writeWorkbook } from './lib/ooxml-workbook.mjs';

const args = process.argv.slice(2);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const has = (name) => args.includes(name);
const url = value('--url');
const normalizedUrl = url ? normalizeVideoInput(url) : undefined;
const sourceJson = value('--source-json');
const profilePath = resolve(value('--profile') || 'profiles/example.json');
const requestedOutput = value('--output');
const analysisPath = value('--analysis-json');
if ((!url && !sourceJson) || (url && sourceJson)) {
  console.error('Provide exactly one of --url or --source-json.'); process.exit(2);
}

const profile = readProfile(JSON.parse(await readFile(profilePath, 'utf8')));
let acquiredPath = sourceJson ? resolve(sourceJson) : undefined;
let runtimeOutput;
let normalized;
let output;
if (url) {
  output = resolve(requestedOutput || join('output', deriveMaterialSlug(sourceIdentityFromUrl(normalizedUrl), normalizedUrl)));
  await mkdir(output, { recursive: true });
  const runtime = resolve('.runtime/video-batch-download');
  const script = join(runtime, 'scripts', 'download.mjs');
  if (!existsSync(script)) throw new Error('Video tool is not installed. Run npm run setup:video first.');
  runtimeOutput = join(output, '.acquisition');
  const venvBin = process.platform === 'win32' ? join(runtime, '.venv', 'Scripts') : join(runtime, '.venv', 'bin');
  await run(process.execPath, [script, normalizedUrl, '--output', runtimeOutput, '--no-video-output', '--model', value('--whisper-model') || 'small', '--device', value('--device') || 'cpu', '--compute-type', value('--compute-type') || 'int8'], runtime, {
    ...process.env,
    PATH: `${venvBin}${delimiter}${process.env.PATH || process.env.Path || ''}`,
    Path: `${venvBin}${delimiter}${process.env.Path || process.env.PATH || ''}`,
    PYTHONIOENCODING: 'utf-8'
  });
  const summary = JSON.parse(await readFile(join(runtimeOutput, 'download-summary.json'), 'utf8'));
  acquiredPath = summary.results?.find((item) => item.jsonPath)?.jsonPath;
  if (!acquiredPath) throw new Error('Video acquisition did not produce a transcript JSON result.');
  normalized = normalizeSource(JSON.parse(await readFile(acquiredPath, 'utf8')), acquiredPath);
} else {
  normalized = normalizeSource(JSON.parse(await readFile(acquiredPath, 'utf8')), acquiredPath);
  output = resolve(requestedOutput || join('output', deriveMaterialSlug(normalized.source, acquiredPath)));
  await mkdir(output, { recursive: true });
}

const normalizedSourcePath = join(output, 'source-normalized.json');
await writeFile(normalizedSourcePath, JSON.stringify({
  ...normalized.source,
  segments: normalized.rawCues
}, null, 2));
const request = buildAnalysisRequest(normalized, profile);
const requestPath = join(output, 'analysis-request.json');
await writeFile(requestPath, JSON.stringify(request, null, 2));
let analysis;
let analysisProvider = 'agent-host';
let analysisModel = null;
if (analysisPath) {
  analysis = JSON.parse(await readFile(resolve(analysisPath), 'utf8'));
} else if (process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL && process.env.OPENAI_MODEL) {
  analysisProvider = new URL(process.env.OPENAI_BASE_URL).hostname;
  analysisModel = process.env.OPENAI_MODEL;
  analysis = await callModel(request);
  await writeFile(join(output, 'analysis-response.json'), JSON.stringify(analysis, null, 2));
} else {
  if (url && runtimeOutput && !has('--keep-runtime-output')) await rm(runtimeOutput, { recursive: true, force: true });
  console.error(`Analysis request created at ${requestPath}. Use the Agent to produce analysis-response.json, then rerun with --source-json "${normalizedSourcePath}" --profile "${profilePath}" --output "${output}" --analysis-json <analysis-response.json>.`);
  process.exit(3);
}
analysis = validateAnalysis(analysis, normalized, profile);
const result = materializeResult(normalized, profile, analysis, {
  acquisitionTool: url ? 'ljb1020/video-batch-download' : 'supplied-json',
  acquisitionRevision: url ? 'be5e41cf7e95b3c3388790bcce91b8becb942ef1' : null,
  analysisProvider,
  analysisModel
});
const resultPath = join(output, 'result.json');
const srtPath = join(output, 'transcript.srt');
const workbookPath = join(output, 'materials.xlsx');
await writeFile(resultPath, JSON.stringify(result, null, 2));
await writeFile(srtPath, serializeSrt(result.transcript.cleanedCues));
await writeWorkbook(result, workbookPath);
if (url && runtimeOutput && !has('--keep-runtime-output')) await rm(runtimeOutput, { recursive: true, force: true });
let feishu = null;
if (has('--feishu')) feishu = await importToFeishu(workbookPath);
console.log(JSON.stringify({ ok: true, resultPath, srtPath, workbookPath, feishu }, null, 2));

async function callModel(payload) {
  const response = await fetch(`${process.env.OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: 'Return one JSON object only. Follow the supplied schema and coverage rules exactly. Never invent timestamps or transcript content.' },
      { role: 'user', content: JSON.stringify(payload) }
    ] })
  });
  if (!response.ok) throw new Error(`Analysis provider failed with HTTP ${response.status}.`);
  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('Analysis provider returned no JSON content.');
  return JSON.parse(content);
}

async function importToFeishu(file) {
  const executable = process.env.LARK_CLI_BIN || (process.platform === 'win32' ? 'lark-cli.cmd' : 'lark-cli');
  if (/[&|<>^\"]/.test(file) || /[&|<>^\"]/.test(executable)) throw new Error('Feishu command path contains unsupported shell metacharacters.');
  const commandArgs = ['drive', '+import', '--type', 'sheet', '--as', 'user', '--file', file];
  try {
    const output = process.platform === 'win32'
      ? await capture(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', executable, ...commandArgs])
      : await capture(executable, commandArgs);
    return JSON.parse(output);
  }
  catch (error) { throw new Error(`Feishu import failed. Authenticate with the official lark-cli first. ${error.message}`); }
}

function run(command, commandArgs, cwd, env = process.env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, commandArgs, { cwd, env, stdio: 'inherit', windowsHide: true });
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolveRun() : reject(new Error(`${basename(command)} exited with ${code}`)));
  });
}

function capture(command, commandArgs) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => stdout += chunk); child.stderr.on('data', (chunk) => stderr += chunk);
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolveRun(stdout) : reject(new Error(stderr || `${command} exited with ${code}`)));
  });
}
