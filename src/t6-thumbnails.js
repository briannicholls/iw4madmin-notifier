import { normalizeMapKey } from './config.js';
import { T6_THUMBNAIL_FILES } from './generated/t6-thumbnail-manifest.js';

function normalizeBaseUrl(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

function normalizeCandidate(value) {
  let key = normalizeMapKey(value);
  if (!key) return '';

  key = key.replace(/^loadscreen_/, '');
  key = key.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  key = key.replace(/[\s-]+/g, '_');
  key = key.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return key;
}

function addUnique(list, value) {
  if (!value) return;
  if (list.indexOf(value) === -1) list.push(value);
}

const ALIAS_INDEX = (() => {
  const index = {};

  function add(alias, key) {
    if (!alias) return;
    if (!index[alias]) index[alias] = [];
    if (index[alias].indexOf(key) === -1) index[alias].push(key);
  }

  const keys = Object.keys(T6_THUMBNAIL_FILES);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    add(key, key);

    if (key.indexOf('mp_') === 0) add(key.substring(3), key);
    if (key.indexOf('zm_') === 0) add(key.substring(3), key);
    if (key.indexOf('transit_') === 0) add(key.substring(8), key);
    if (key.indexOf('buried_') === 0) add(key.substring(7), key);
    if (key.indexOf('zombie_') === 0) add(key.substring(7), key);

    add(key.replace(/_2020$/, ''), key);
  }

  return index;
})();

function resolveFileName(mapSlug, mapReadable) {
  const candidates = [];
  addUnique(candidates, normalizeCandidate(mapSlug));
  addUnique(candidates, normalizeCandidate(mapReadable));

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const direct = T6_THUMBNAIL_FILES[candidate];
    if (direct) return direct;
  }

  const prefixed = [];
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    addUnique(prefixed, candidate);

    if (candidate === 'nuketown') {
      addUnique(prefixed, 'mp_nuketown_2020');
      addUnique(prefixed, 'zm_nuketown');
      continue;
    }

    if (candidate && candidate.indexOf('mp_') !== 0) addUnique(prefixed, 'mp_' + candidate);
    if (candidate && candidate.indexOf('zm_') !== 0) addUnique(prefixed, 'zm_' + candidate);
  }

  for (let i = 0; i < prefixed.length; i++) {
    const candidate = prefixed[i];
    const direct = T6_THUMBNAIL_FILES[candidate];
    if (direct) return direct;
  }

  for (let i = 0; i < prefixed.length; i++) {
    const candidate = prefixed[i];
    const aliasHits = ALIAS_INDEX[candidate];
    if (aliasHits && aliasHits.length === 1) {
      const key = aliasHits[0];
      const fileName = T6_THUMBNAIL_FILES[key];
      if (fileName) return fileName;
    }
  }

  return '';
}

export function resolveT6ThumbnailUrl(baseUrl, mapSlug, mapReadable) {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return '';

  const fileName = resolveFileName(mapSlug, mapReadable);
  if (!fileName) return '';

  return base + '/' + fileName;
}
