import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAnalysisRequest, deriveMaterialSlug, materializeResult, normalizeSource, normalizeVideoInput, readProfile, sanitizePublicSourceUrl, serializeSrt, sourceIdentityFromUrl, validateAnalysis } from '../scripts/lib/core.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('normalizes source and produces traceable custom sections', async () => {
  const profile = readProfile(await json('../profiles/example.json'));
  const normalized = normalizeSource(await json('./fixtures/source.json'), 'fixture');
  const request = buildAnalysisRequest(normalized, profile);
  assert.equal(request.cues.length, 3);
  const analysis = validateAnalysis(await json('./fixtures/analysis.json'), normalized, profile);
  const result = materializeResult(normalized, profile, analysis, { analysisProvider: 'fixture' });
  assert.equal(result.sections.length, 2);
  assert.equal(result.sections[1].categoryDefinition, profile.categories[1].definition);
  assert.equal(result.sections[1].startMs, 3000);
  assert.match(serializeSrt(result.transcript.cleanedCues), /00:00:03,000 --> 00:00:06,000/);
  assert.equal(result.provenance.sourceResultPath, 'fixture');
});

test('rejects section gaps and invented categories', async () => {
  const profile = readProfile(await json('../profiles/example.json'));
  const normalized = normalizeSource(await json('./fixtures/source.json'));
  const analysis = await json('./fixtures/analysis.json');
  analysis.sections[1].startCue = 2;
  assert.throws(() => validateAnalysis(analysis, normalized, profile), /coverage/);
  analysis.sections[1].startCue = 1;
  analysis.sections[1].categoryId = 'invented';
  assert.throws(() => validateAnalysis(analysis, normalized, profile), /unknown category/);
});

test('extracts share text URLs and normalizes Douyin modal links', () => {
  assert.equal(
    normalizeVideoInput('复制打开抖音 https://www.douyin.com/jingxuan?modal_id=0000000000000000000 看看'),
    'https://www.douyin.com/video/0000000000000000000'
  );
});

test('removes share tokens from persisted platform URLs', () => {
  const dirty = 'https://www.xiaohongshu.com/explore/000000000000000000000000?xsec_token=REMOVE_ME&xsec_source=pc_search#detail';
  assert.equal(
    sanitizePublicSourceUrl(dirty),
    'https://www.xiaohongshu.com/explore/000000000000000000000000'
  );
  const normalized = normalizeSource({
    source_url: dirty,
    segments: [{ start: 0, end: 1, text: '测试' }]
  });
  assert.doesNotMatch(JSON.stringify(normalized.source), /REMOVE_ME|xsec_token|xsec_source/);
});

test('does not persist a machine-specific source path', () => {
  const normalized = normalizeSource({
    source_url: 'https://www.douyin.com/video/0000000000000000000',
    segments: [{ start: 0, end: 1, text: '测试' }]
  }, 'C:\\Users\\example\\private-folder\\source.json');
  assert.equal(normalized.inputPath, 'source.json');
});

test('derives a stable per-video output slug', () => {
  const identity = sourceIdentityFromUrl('https://www.douyin.com/video/0000000000000000000?source=share');
  assert.deepEqual(identity.platform, 'douyin');
  assert.equal(deriveMaterialSlug(identity), 'douyin-0000000000000000000');
  assert.match(deriveMaterialSlug({ platform: '小红书', originalUrl: 'https://xhslink.com/example' }), /^xiaohongshu-[a-f0-9]{12}$/);
});
