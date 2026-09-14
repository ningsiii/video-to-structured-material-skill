#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const revision = 'be5e41cf7e95b3c3388790bcce91b8becb942ef1';
const licenseHash = '6223D6683AC5546D98C054C4F582106946F00BB93E1FB04D1F5DEE6216558532';
const root = resolve('.runtime/video-batch-download');
if (existsSync(root)) await rm(root, { recursive: true, force: true });
await mkdir(dirname(root), { recursive: true });
await run('git', ['clone', '--filter=blob:none', 'https://github.com/ljb1020/video-batch-download.git', root]);
await run('git', ['checkout', '--detach', revision], root);
const hash = createHash('sha256').update(await readFile(join(root, 'LICENSE'))).digest('hex').toUpperCase();
if (hash !== licenseHash) throw new Error('Pinned video tool license checksum did not match; setup stopped.');
await runNpm(['ci'], root);
await runNpm(['install', '--no-save', 'ffmpeg-static'], root);
const python = findPython();
await run(python.command, [...python.prefix, '-m', 'venv', '.venv'], root);
const venvPython = process.platform === 'win32' ? join(root, '.venv', 'Scripts', 'python.exe') : join(root, '.venv', 'bin', 'python');
await run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', 'faster-whisper', 'opencc'], root);
await run('node', ['scripts/setup.mjs'], root);
console.log(`Video acquisition tool ready at ${root}`);

function findPython() {
  for (const candidate of process.platform === 'win32' ? [{ command: 'py', prefix: ['-3'] }, { command: 'python', prefix: [] }] : [{ command: 'python3', prefix: [] }, { command: 'python', prefix: [] }]) {
    if (spawnSync(candidate.command, [...candidate.prefix, '--version'], { stdio: 'ignore', windowsHide: true }).status === 0) return candidate;
  }
  throw new Error('Python 3.10+ is required for local transcription.');
}

function runNpm(args, cwd) {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath))
    return run(process.execPath, [process.env.npm_execpath, ...args], cwd);
  if (process.platform !== 'win32') return run('npm', args, cwd);
  throw new Error('On Windows, run this setup through `npm run setup:video` so npm_execpath is available.');
}

function run(command, args, cwd = process.cwd()) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true });
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolveRun() : reject(new Error(`${command} exited with ${code}`)));
  });
}
