import type { NotifyPayload } from '../../types/models.js';

export interface NotifierMeta {
  type?: string;
  serverKey?: string;
}

export interface NotifierDetails {
  statusCode?: number | null;
  retryAfterMs?: number;
  isRateLimited?: boolean;
  isMissingMessage?: boolean;
}

export type NotifierCallback = (
  ok: boolean,
  messageId: string,
  errorText: string,
  details?: NotifierDetails | null
) => void;

export interface NotifierPort {
  name: string;
  upsertMessage: (
    plugin: unknown,
    existingMessageId: string,
    payload: NotifyPayload | Record<string, unknown>,
    meta: NotifierMeta,
    done: NotifierCallback
  ) => void;
  deleteMessage: (
    plugin: unknown,
    messageId: string,
    meta: NotifierMeta,
    done: (ok: boolean, errorText: string, details?: NotifierDetails) => void
  ) => void;
  purgeStartupMessages?: (
    plugin: unknown,
    done: (ok: boolean, errorText: string, stats?: Record<string, unknown>) => void
  ) => void;
}
