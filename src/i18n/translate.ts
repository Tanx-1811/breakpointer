import type { LanguagePreference } from '../types';
import { de } from './de';
import { en, type MessageKey } from './en';
import { es } from './es';
import { fr } from './fr';
import { id } from './id';
import { ja } from './ja';
import { pt } from './pt';
import { vi } from './vi';

export type { MessageKey };
/** UI languages, as BCP 47 tags (also used to format dates and numbers). */
export type Language = 'en' | 'vi' | 'es' | 'pt-BR' | 'fr' | 'de' | 'ja' | 'id';
export type MessageParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;

export const LANGUAGES: Language[] = ['en', 'es', 'pt-BR', 'fr', 'de', 'ja', 'id', 'vi'];

/** Each language in its own words, for the language picker. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  id: 'Bahasa Indonesia',
  vi: 'Tiếng Việt',
};

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { en, vi, es, 'pt-BR': pt, fr, de, ja, id };

function browserLanguage(): string {
  try {
    return chrome.i18n.getUILanguage();
  } catch {
    return typeof navigator === 'undefined' ? 'en' : navigator.language;
  }
}

export function resolveLanguage(preference: LanguagePreference, uiLanguage = browserLanguage()): Language {
  if (preference !== 'auto') return preference;
  const tag = uiLanguage.toLowerCase();
  // Chrome's "in" is an old code for Indonesian; any Portuguese gets the Brazilian UI.
  const base = tag.split(/[-_]/)[0] === 'in' ? 'id' : tag.split(/[-_]/)[0];
  if (base === 'pt') return 'pt-BR';
  return LANGUAGES.find((language) => language === base) ?? 'en';
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
