import { snippet } from '../../../utils.js';

function responseToText(response) {
  if (response == null) return '';
  if (typeof response === 'string') return response;

  try {
    if (typeof response.body === 'string') return response.body;
    if (typeof response.content === 'string') return response.content;
    if (typeof response.data === 'string') return response.data;
  } catch (_) { }

  try {
    return JSON.stringify(response);
  } catch (_) {
    try {
      return String(response);
    } catch (_error) {
      return '';
    }
  }
}

function parseStatusCode(response) {
  const raw = response
    ? (response.statusCode || response.status || response.StatusCode || response.httpStatus)
    : null;
  const parsed = parseInt(String(raw == null ? '' : raw), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDiscordCode(parsed) {
  const raw = parsed && parsed.code != null ? parsed.code : null;
  const parsedCode = parseInt(String(raw == null ? '' : raw), 10);
  return Number.isFinite(parsedCode) ? parsedCode : 0;
}

function parseRetryAfterMs(parsed) {
  const raw = parsed
    ? (parsed.retry_after != null ? parsed.retry_after : parsed.retryAfter)
    : null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1000) return Math.round(value);
  return Math.round(value * 1000);
}

export function parseDiscordErrorCode(parsed) {
  return parseDiscordCode(parsed);
}

function isMissingMessageResponse(statusCode, parsed) {
  if (statusCode === 404) return true;
  return parseDiscordCode(parsed) === 10008;
}

function isRateLimitedResponse(statusCode, parsed) {
  if (statusCode === 429) return true;
  if (parsed && typeof parsed.message === 'string') {
    return /rate\s*limited/i.test(parsed.message);
  }
  return false;
}

function tryParseJson(text) {
  const body = String(text == null ? '' : text).trim();
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch (_) {
    return null;
  }
}

function extractMessageId(parsed, text) {
  if (parsed && parsed.id) return String(parsed.id);

  const match = /"id"\s*:\s*"(\d+)"/.exec(String(text || ''));
  if (match && match[1]) return String(match[1]);

  return '';
}

function isLikelySuccess(response, statusCode, parsed, text, method) {
  if (response && response.success === false) return false;

  if (Number.isFinite(statusCode)) {
    return statusCode >= 200 && statusCode < 300;
  }

  if (parsed && (parsed.error || parsed.errors || parsed.code)) {
    return false;
  }

  if (method === 'DELETE') {
    return String(text || '').trim() === '';
  }

  const id = extractMessageId(parsed, text);
  if (id) return true;

  if (!text || String(text).trim() === '') return true;
  return false;
}

function buildErrorText(statusCode, parsed, text) {
  if (parsed && typeof parsed.message === 'string' && parsed.message) {
    return parsed.message;
  }
  if (parsed && typeof parsed.error === 'string' && parsed.error) {
    return parsed.error;
  }
  if (parsed && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
    return typeof parsed.errors[0] === 'string' ? parsed.errors[0] : snippet(JSON.stringify(parsed.errors[0]), 220);
  }

  const textSnippet = snippet(text, 220);
  if (textSnippet) {
    if (Number.isFinite(statusCode)) {
      return 'status=' + statusCode + ' body=' + textSnippet;
    }
    return textSnippet;
  }

  if (Number.isFinite(statusCode)) return 'status=' + statusCode;
  return 'unknown discord response';
}

export function createHeaders(botToken) {
  const stringDict = System.Collections.Generic.Dictionary(System.String, System.String);
  const headers = new stringDict();

  const token = String(botToken || '');
  const authValue = token.indexOf('Bot ') === 0 ? token : ('Bot ' + token);
  headers.add('Authorization', authValue);

  return headers;
}

export function requestJson(plugin, url, method, bodyObject, headers, done) {
  try {
    const pluginScript = importNamespace('IW4MAdmin.Application.Plugin.Script');
    const body = bodyObject ? JSON.stringify(bodyObject) : '';

    const request = new pluginScript.ScriptPluginWebRequest(
      url,
      body,
      method,
      'application/json',
      headers
    );

    plugin.pluginHelper.requestUrl(request, function (response) {
      const text = responseToText(response);
      const parsed = tryParseJson(text);
      const statusCode = parseStatusCode(response);
      const messageId = extractMessageId(parsed, text);
      const ok = isLikelySuccess(response, statusCode, parsed, text, method);
      const errorText = ok ? '' : buildErrorText(statusCode, parsed, text);
      const retryAfterMs = parseRetryAfterMs(parsed);
      const isRateLimited = isRateLimitedResponse(statusCode, parsed);
      const isMissingMessage = isMissingMessageResponse(statusCode, parsed);

      done({
        ok: ok,
        statusCode: statusCode,
        parsed: parsed,
        text: text,
        messageId: messageId,
        errorText: errorText,
        retryAfterMs: retryAfterMs,
        isRateLimited: isRateLimited,
        isMissingMessage: isMissingMessage
      });
    });
  } catch (error) {
    done({
      ok: false,
      statusCode: null,
      parsed: null,
      text: '',
      messageId: '',
      errorText: error && error.message ? error.message : 'discord request setup failed',
      retryAfterMs: 0,
      isRateLimited: false,
      isMissingMessage: false
    });
  }
}
