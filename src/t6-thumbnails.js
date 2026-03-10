import { normalizeMapKey } from './config.js';
import { T6_THUMBNAIL_FILES } from './generated/t6-thumbnail-manifest.js';

function normalizeBaseUrl(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

export function resolveT6ThumbnailUrl(baseUrl, mapSlug) {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return '';

  const slug = normalizeMapKey(mapSlug);
  if (!slug) return '';

  const fileName = T6_THUMBNAIL_FILES[slug];
  if (!fileName) return '';

  return base + '/' + fileName;
}
