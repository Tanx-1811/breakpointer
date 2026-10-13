import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { createTranslator, dictionaryFor, formatMessage, LANGUAGES, resolveLanguage } from '../../src/i18n/translate';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('i18n', () => {
  it.each(LANGUAGES)('%s has every key with the same placeholders', (language) => {
    const dictionary = dictionaryFor(language);
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(dictionary[key], key).toBeTruthy();
      expect(placeholders(dictionary[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('formats placeholders and leaves unknown ones', () => {
    expect(formatMessage('Hi {name}, {missing}', { name: 'Tấn' })).toBe('Hi Tấn, {missing}');
    expect(createTranslator('vi')('add.added', { name: 'Kiosk' })).toBe('Đã thêm Kiosk');
  });

  it('resolves the automatic language from Chrome', () => {
    expect(resolveLanguage('auto', 'vi-VN')).toBe('vi');
    expect(resolveLanguage('auto', 'de')).toBe('en');
    expect(resolveLanguage('en', 'vi')).toBe('en');
  });

  it('has matching manifest locales', () => {
    const read = (lang: string) =>
      JSON.parse(readFileSync(resolve(process.cwd(), `public/_locales/${lang}/messages.json`), 'utf8'));
    const enMessages = read('en');
    const viMessages = read('vi');
    expect(Object.keys(viMessages).sort()).toEqual(Object.keys(enMessages).sort());
    for (const messages of [enMessages, viMessages]) {
      expect(messages.extName.message.length).toBeLessThanOrEqual(75);
      expect(messages.extDescription.message.length).toBeLessThanOrEqual(132);
    }
  });
});
