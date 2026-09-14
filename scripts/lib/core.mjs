import { createHash } from 'node:crypto';

export function normalizeVideoInput(input) {
  const matches = String(input).match(/https?:\/\/[^\s<>"']+/gi) || [];
  if (matches.length !== 1) throw new Error('Input must contain exactly one public video URL.');
  const parsed = new URL(matches[0].replace(/[，。！？、；：）】》]+$/u, ''));
  if (/(^|\.)douyin\.com$/i.test(parsed.hostname)) {
    const modalId = parsed.searchParams.get('modal_id');
    if (modalId && /^\d+$/.test(modalId)) return `https://www.douyin.com/video/${modalId}`;
  }
  return parsed.toString();
}

export function readProfile(value) {
  if (!value || typeof value !== 'object') throw new Error('Profile must be a JSON object.');
  const categories = value.categories;
  if (!value.id || !value.name || !value.version || !Array.isArray(categories) || !categories.length)
    throw new Error('Profile requires id, name, version, and at least one category.');
  const ids = new Set();
  for (const category of categories) {
    if (!category.id || !category.label || !category.definition)
      throw new Error('Every profile category requires id, label, and definition.');
    if (ids.has(category.id)) throw new Error(`Duplicate profile category: ${category.id}`);
    ids.add(category.id);
  }
  return { ...value, language: value.language || 'zh-CN' };
}

export function normalizeSource(value, inputPath = '') {
  const raw = Array.isArray(value.segments) ? value.segments : value.transcript?.segments;
  if (!Array.isArray(raw) || !raw.length) throw new Error('Source JSON has no timed segments.');
  const rawCues = raw.map((cue, index) => ({
    index,
    startMs: Math.round(Number(cue.startMs ?? Number(cue.start) * 1000)),
    endMs: Math.round(Number(cue.endMs ?? Number(cue.end) * 1000)),
    text: String(cue.text || '').trim()
  }));
  for (const cue of rawCues) {
    if (!Number.isInteger(cue.startMs) || !Number.isInteger(cue.endMs) || cue.startMs < 0 || cue.endMs <= cue.startMs || !cue.text)
      throw new Error(`Cue ${cue.index} has invalid time or text.`);
    if (cue.index && cue.startMs < rawCues[cue.index - 1].endMs)
      throw new Error(`Cue ${cue.index} overlaps the previous cue.`);
  }
  return {
    source: {
      originalUrl: value.source_url ?? value.originalUrl ?? value.url ?? null,
      canonicalUrl: value.canonical_url ?? value.canonicalUrl ?? value.source_url ?? null,
      platform: value.platform ?? null,
      contentId: value.video_id ?? value.contentId ?? null,
      title: value.title ?? null,
      description: value.description ?? null,
      author: value.author ?? null,
      publishedAt: value.post_time ?? value.publishedAt ?? null,
      durationSeconds: value.duration ?? value.durationSeconds ?? Math.ceil(rawCues.at(-1).endMs / 1000),
      stats: value.stats ?? null
    },
    rawCues,
    inputPath,
    sourceHash: createHash('sha256').update(JSON.stringify(value)).digest('hex')
  };
}

export function buildAnalysisRequest(normalized, profile) {
  return {
    schemaVersion: 1,
    task: 'Clean each cue conservatively, then divide all cues into ordered semantic sections using only the supplied profile categories.',
    rules: [
      'Keep exactly one cleanedCues item per input cue and preserve cueIndex.',
      'Correct only context-supported recognition, punctuation, terminology, and sentence-boundary issues; do not summarize or add claims.',
      'Sections must cover every cue exactly once, in order, with no gaps or overlaps.',
      'Section boundaries may occur only between cues.',
      'Use only categoryId values from the supplied profile.',
      'Return JSON only.'
    ],
    responseShape: {
      schemaVersion: 1,
      summary: 'string',
      cleanedCues: [{ cueIndex: 0, text: 'string', uncertainty: 'string' }],
      sections: [{ id: 'section_1', categoryId: 'category-id', title: 'string', startCue: 0, endCue: 0, summary: 'string', confidence: 0.8, uncertainty: 'string' }]
    },
    profile,
    cues: normalized.rawCues
  };
}

export function validateAnalysis(value, normalized, profile) {
  if (!value || value.schemaVersion !== 1 || !value.summary) throw new Error('Analysis schemaVersion or summary is invalid.');
  if (!Array.isArray(value.cleanedCues) || value.cleanedCues.length !== normalized.rawCues.length)
    throw new Error('Analysis must contain exactly one cleaned cue per raw cue.');
  value.cleanedCues.forEach((cue, index) => {
    if (cue.cueIndex !== index || !String(cue.text || '').trim()) throw new Error(`Cleaned cue ${index} is invalid.`);
  });
  if (!Array.isArray(value.sections) || !value.sections.length) throw new Error('Analysis requires sections.');
  const categoryIds = new Set(profile.categories.map((item) => item.id));
  let expected = 0;
  value.sections.forEach((section, index) => {
    if (!categoryIds.has(section.categoryId)) throw new Error(`Section ${index} uses an unknown category.`);
    if (section.startCue !== expected || !Number.isInteger(section.endCue) || section.endCue < section.startCue || section.endCue >= normalized.rawCues.length)
      throw new Error(`Section ${index} does not provide ordered, complete cue coverage.`);
    if (!section.id || !section.title || !section.summary || typeof section.confidence !== 'number' || section.confidence < 0 || section.confidence > 1)
      throw new Error(`Section ${index} is incomplete.`);
    expected = section.endCue + 1;
  });
  if (expected !== normalized.rawCues.length) throw new Error('Sections do not cover every cue.');
  return value;
}

export function materializeResult(normalized, profile, analysis, provenance) {
  const categories = new Map(profile.categories.map((item) => [item.id, item]));
  const cleanedCues = analysis.cleanedCues.map((cue, index) => ({
    index,
    startMs: normalized.rawCues[index].startMs,
    endMs: normalized.rawCues[index].endMs,
    text: cue.text.trim(),
    uncertainty: String(cue.uncertainty || '')
  }));
  const sections = analysis.sections.map((section) => {
    const category = categories.get(section.categoryId);
    const raw = normalized.rawCues.slice(section.startCue, section.endCue + 1);
    const cleaned = cleanedCues.slice(section.startCue, section.endCue + 1);
    return {
      ...section,
      categoryLabel: category.label,
      categoryDefinition: category.definition,
      startMs: raw[0].startMs,
      endMs: raw.at(-1).endMs,
      rawText: raw.map((cue) => cue.text).join(''),
      cleanedText: cleaned.map((cue) => cue.text).join('')
    };
  });
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: normalized.source,
    profile,
    summary: analysis.summary,
    transcript: { rawCues: normalized.rawCues, cleanedCues },
    sections,
    provenance: { sourceHash: normalized.sourceHash, sourceResultPath: normalized.inputPath, ...provenance }
  };
}

function srtTime(ms) {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

export function serializeSrt(cues) {
  return cues.map((cue, index) => `${index + 1}\n${srtTime(cue.startMs)} --> ${srtTime(cue.endMs)}\n${cue.text}`).join('\n\n') + '\n';
}
