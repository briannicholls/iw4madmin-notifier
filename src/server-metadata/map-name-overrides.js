import { normalizeMapKey } from '../config.js';
import { cleanName } from '../utils.js';

// Keep this dictionary slug-first so it is easy to bulk-fill from a spreadsheet.
// Keys are normalized map slugs (lowercase, underscore-separated).
export const MAP_READABLE_BY_SLUG = {
  mp_safehouse: 'Safehouse'
};

function normalizeSlug(value) {
  const normalized = normalizeMapKey(value);
  if (!normalized) return '';

  return normalized
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function mapReadableFromSlug(slug) {
  const key = normalizeSlug(slug);
  if (!key) return '';

  return cleanName(MAP_READABLE_BY_SLUG[key] || '');
}
