import { cleanName, parseIntSafe } from '../utils.js';

export function textFromUnknown(value) {
  if (value == null) return '';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return cleanName(String(value));
  }

  try {
    if (typeof value.toString === 'function') {
      const rendered = cleanName(value.toString());
      if (rendered && rendered !== '[object Object]') return rendered;
    }
  } catch (_) { }

  return '';
}

export function pickCleanString(values) {
  const list = Array.isArray(values) ? values : [];
  for (let i = 0; i < list.length; i++) {
    const cleaned = textFromUnknown(list[i]);
    if (cleaned) return cleaned;
  }
  return '';
}

export function listKeys(value, maxCount) {
  if (!value) return '(none)';

  const keys = [];
  try {
    const own = Object.keys(value);
    for (let i = 0; i < own.length; i++) keys.push(String(own[i]));
  } catch (_) { }

  try {
    for (const key in value) {
      keys.push(String(key));
    }
  } catch (_) { }

  const unique = Array.from(new Set(keys)).sort();
  if (unique.length === 0) return '(none)';

  const limit = Math.max(10, parseIntSafe(maxCount, 80));
  return unique.slice(0, limit).join(',') + (unique.length > limit ? ',...(truncated)' : '');
}

export function mergeNamedInfo(primary, secondary) {
  const left = primary || {};
  const right = secondary || {};

  return {
    readable: pickCleanString([left.readable, right.readable]),
    slug: pickCleanString([left.slug, right.slug])
  };
}

export function formatNamedInfoForStatus(info, unknownValue) {
  const readable = pickCleanString([info && info.readable]);
  const slug = pickCleanString([info && info.slug]);

  if (readable && slug && readable.toLowerCase() !== slug.toLowerCase()) {
    return readable + ' (`' + slug + '`)';
  }
  if (readable) return readable;
  if (slug) return '`' + slug + '`';
  return unknownValue || 'unknown';
}
