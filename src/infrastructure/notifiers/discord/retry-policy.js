function isRetryableStatusCode(statusCode) {
  if (!Number.isFinite(statusCode)) return false;
  return statusCode === 429 || statusCode >= 500;
}

export function computeRetryDelayMs(details, attemptNumber, defaultDelayMs, maxDelayMs) {
  const retryAfterMs = Number(details && details.retryAfterMs);
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.max(1000, Math.min(maxDelayMs, Math.round(retryAfterMs)));
  }

  const statusCode = Number(details && details.statusCode);
  const isRateLimited = !!(details && details.isRateLimited);
  if (isRateLimited || isRetryableStatusCode(statusCode)) {
    const attempt = Math.max(1, Number.isFinite(Number(attemptNumber)) ? Number(attemptNumber) : 1);
    const baseDelay = Math.round(defaultDelayMs * attempt);
    return Math.max(1000, Math.min(maxDelayMs, baseDelay));
  }

  return 0;
}
