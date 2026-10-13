import type { LanguagePreference } from '../types';
import { en, type MessageKey } from './en';
import { vi } from './vi';

export type { MessageKey };
export type Language = 'en' | 'vi';
export type MessageParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;

export const LANGUAGES: Language[] = ['en', 'vi'];

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { en, vi };

function browserLanguage(): string {
  try {
    return chrome.i18n.getUILanguage();
  } catch {
    return typeof navigator === 'undefined' ? 'en' : navigator.language;
  }
}

export function resolveLanguage(preference: LanguagePreference, uiLanguage = browserLanguage()): Language {
  if (preference !== 'auto') return preference;
  return uiLanguage.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

/** Replaces {placeholders}; unknown placeholders are left as they are. */
export function formatMessage(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function createTranslator(language: Language): Translate {
  const dictionary = DICTIONARIES[language];
  return (key, params) => formatMessage(dictionary[key] ?? en[key], params);
}

export function dictionaryFor(language: Language): Record<MessageKey, string> {
  return DICTIONARIES[language];
}
