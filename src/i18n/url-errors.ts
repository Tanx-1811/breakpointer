import type { UrlParseError } from '../utils/url';
import type { MessageKey } from './en';

/** Message shown for each reason an address can't be previewed. */
export const URL_ERROR_KEYS: Record<UrlParseError, MessageKey> = {
  empty: 'url.error.empty',
  'unsupported-scheme': 'url.error.unsupported',
  invalid: 'url.error.invalid',
  credentials: 'url.error.credentials',
};
