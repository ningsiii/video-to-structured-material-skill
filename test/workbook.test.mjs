import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { writeWorkbook } from '../scripts/lib/ooxml-workbook.mjs';

test('writes a portable workbook with three traceable sheets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'video-material-xlsx-'));
  try {
    const path = join(root, 'materials.xlsx');
    await writeWorkbook({
      generatedAt: '2026-01-01T00:00:00.000Z',
      source: { title: 'Example', platform: 'douyin', originalUrl: 'https://example.com/video', canonicalUrl: 'https://example.com/video', author: 'Author' },
      profile: { name: 'Custom', version: '1.0.0' }, summary: 'Summary',
      sections: [{ categoryLabel: 'Part', categoryDefinition: 'Definition', title: 'Title', startMs: 0, endMs: 1000, summary: 'Section', cleanedText: 'Clean', rawText: 'Raw', confidence: 0.8, uncertainty: '' }],
      transcript: { rawCues: [{ startMs: 0, endMs: 1000, text: 'Raw' }], cleanedCues: [{ text: 'Clean', uncertainty: '' }] }
    }, path);
    const archive = unzipSync(new Uint8Array(await readFile(path)));
    assert.ok(archive['xl/worksheets/sheet1.xml']);
    assert.ok(archive['xl/worksheets/sheet2.xml']);
    assert.ok(archive['xl/worksheets/sheet3.xml']);
    assert.match(strFromU8(archive['xl/workbook.xml']), /Overview/);
    assert.match(strFromU8(archive['xl/worksheets/sheet2.xml']), /Source URL/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
