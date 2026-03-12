export const MOCK_MAX_PLAYERS = 18;

export const DEFAULT_ALERTS_FOR_RENDERING = [
  { threshold: 1, message: '' },
  { threshold: 6, message: '' },
  { threshold: 11, message: '' }
];

export function mapFilenameToSlug(filename) {
  const raw = String(filename || '').trim();
  if (!raw) return '';
  return raw.replace(/^loadscreen_/i, '').replace(/\.jpg$/i, '');
}
