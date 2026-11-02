import type { HeadingSample, PageMeta } from '../agent/protocol';
import type { MessageKey } from '../i18n/en';
import type { Translate } from '../i18n/translate';

/** How a tag looks: fine, worth a look, missing or wrong, or just so you know. */
export type MetaStatus = 'ok' | 'warn' | 'bad' | 'info';

export type MetaCheckId =
  | 'title'
  | 'description'
  | 'socialTitle'
  | 'socialImage'
  | 'xCard'
  | 'canonical'
  | 'lang'
  | 'viewport'
  | 'robots'
  | 'icons';

export type MetaCheck = {
  id: MetaCheckId;
  status: MetaStatus;
  /** What the page says ('' when it says nothing). */
  value: string;
  /** Why this status, as a message and its values. */
  note: MessageKey;
  params?: Record<string, string | number>;
};

/** Search results show about this many characters of a title, and of a description. */
export const TITLE_MAX = 60;
export const TITLE_MIN = 15;
export const DESCRIPTION_MAX = 160;
export const DESCRIPTION_MIN = 50;

/** The content of the first tag with one of these keys ('' when there's none). */
export function metaValue(meta: PageMeta, ...keys: string[]): string {
  for (const key of keys) {
    const value = meta.tags.find((tag) => tag.key === key)?.value.trim();
    if (value) return value;
  }
  return '';
}

/** `text` cut to `max` characters at a word, with "…". */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '')} …`;
}

/** "brightside.example › pricing › teams", as search results show an address. */
export function breadcrumb(address: string): string {
  try {
    const url = new URL(address);
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponentSafe);
    return [`${url.protocol}//${url.host}`, ...parts].join(' › ');
  } catch {
    return address;
  }
}

function decodeURIComponentSafe(part: string) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

const sameAddress = (a: string, b: string) => {
  const clean = (address: string) => {
    try {
      const url = new URL(address);
      url.hash = '';
      return url.href.replace(/\/$/, '');
    } catch {
      return address;
    }
  };
  return clean(a) === clean(b);
};

/** What the page's tags are worth, one check each, in the order the tab lists them. */
export function metaChecks(meta: PageMeta, page: string | null): MetaCheck[] {
  const checks: MetaCheck[] = [];
  const title = meta.title.trim();
  checks.push(
    !title
      ? { id: 'title', status: 'bad', value: '', note: 'meta.missing' }
      : title.length > TITLE_MAX
        ? {
            id: 'title',
            status: 'warn',
            value: title,
            note: 'meta.tooLong',
            params: { count: title.length, max: TITLE_MAX },
          }
        : title.length < TITLE_MIN
          ? { id: 'title', status: 'warn', value: title, note: 'meta.short', params: { count: title.length } }
          : { id: 'title', status: 'ok', value: title, note: 'meta.characters', params: { count: title.length } },
  );

  const description = metaValue(meta, 'description');
  checks.push(
    !description
      ? { id: 'description', status: 'bad', value: '', note: 'meta.descriptionMissing' }
      : description.length > DESCRIPTION_MAX
        ? {
            id: 'description',
            status: 'warn',
            value: description,
            note: 'meta.tooLong',
            params: { count: description.length, max: DESCRIPTION_MAX },
          }
        : description.length < DESCRIPTION_MIN
          ? {
              id: 'description',
              status: 'warn',
              value: description,
              note: 'meta.short',
              params: { count: description.length },
            }
          : {
              id: 'description',
              status: 'ok',
              value: description,
              note: 'meta.characters',
              params: { count: description.length },
            },
  );

  const socialTitle = metaValue(meta, 'og:title', 'twitter:title');
  checks.push(
    socialTitle
      ? { id: 'socialTitle', status: 'ok', value: socialTitle, note: 'meta.present' }
      : { id: 'socialTitle', status: 'info', value: '', note: 'meta.socialTitleMissing' },
  );
  const image = metaValue(meta, 'og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image');
  checks.push(
    image
      ? { id: 'socialImage', status: 'ok', value: image, note: 'meta.present' }
      : { id: 'socialImage', status: 'warn', value: '', note: 'meta.imageMissing' },
  );
  const card = metaValue(meta, 'twitter:card');
  checks.push(
    card
      ? { id: 'xCard', status: 'ok', value: card, note: 'meta.present' }
      : { id: 'xCard', status: 'info', value: '', note: 'meta.cardMissing' },
  );

  checks.push(
    !meta.canonical
      ? { id: 'canonical', status: 'info', value: '', note: 'meta.canonicalMissing' }
      : page && !sameAddress(meta.canonical, page)
        ? { id: 'canonical', status: 'info', value: meta.canonical, note: 'meta.canonicalOther' }
        : { id: 'canonical', status: 'ok', value: meta.canonical, note: 'meta.canonicalSelf' },
  );
  checks.push(
    meta.lang
      ? { id: 'lang', status: 'ok', value: meta.lang, note: 'meta.present' }
      : { id: 'lang', status: 'warn', value: '', note: 'meta.langMissing' },
  );

  const viewport = metaValue(meta, 'viewport');
  const blocksZoom =
    /user-scalable\s*=\s*(no|0)\b/i.test(viewport) ||
    Number(/maximum-scale\s*=\s*([\d.]+)/i.exec(viewport)?.[1] ?? Infinity) < 2;
  checks.push(
    !viewport
      ? { id: 'viewport', status: 'bad', value: '', note: 'meta.viewportMissing' }
      : blocksZoom
        ? { id: 'viewport', status: 'warn', value: viewport, note: 'meta.viewportZoom' }
        : { id: 'viewport', status: 'ok', value: viewport, note: 'meta.present' },
  );

  const robots = [metaValue(meta, 'robots'), metaValue(meta, 'googlebot')].filter(Boolean).join(', ');
  checks.push(
    !robots
      ? { id: 'robots', status: 'info', value: '', note: 'meta.robotsMissing' }
      : /\bnoindex\b|\bnone\b/i.test(robots)
        ? { id: 'robots', status: 'warn', value: robots, note: 'meta.noindex' }
        : { id: 'robots', status: 'ok', value: robots, note: 'meta.present' },
  );

  const icon = meta.icons.find((item) => item.rel.split(/\s+/).includes('icon'));
  const touch = meta.icons.find((item) => item.rel.includes('apple-touch-icon'));
  checks.push(
    icon || touch
      ? {
          id: 'icons',
          status: icon ? 'ok' : 'info',
          value: (icon ?? touch)!.href,
          note: icon && touch ? 'meta.iconsBoth' : icon ? 'meta.iconOnly' : 'meta.touchOnly',
        }
      : { id: 'icons', status: 'warn', value: '', note: 'meta.iconMissing' },
  );
  return checks;
}

/** What's wrong with a heading in the outline: a level skipped before it (the first heading may start anywhere), or a second h1. */
export type HeadingIssue = 'skip' | 'extraH1' | null;

/** The outline's headings, each with what's wrong with it (hidden headings don't count). */
export function headingOutline(headings: readonly HeadingSample[]): (HeadingSample & { issue: HeadingIssue })[] {
  let previous = 0;
  let h1s = 0;
  return headings.map((heading) => {
    if (heading.hidden) return { ...heading, issue: null };
    let issue: HeadingIssue = null;
    if (heading.level === 1) {
      h1s += 1;
      if (h1s > 1) issue = 'extraH1';
    } else if (previous > 0 && heading.level > previous + 1) issue = 'skip';
    previous = heading.level;
    return { ...heading, issue };
  });
}

/** Kinds of trouble in the outline: no h1 at all, or the issues of its headings. */
export function headingSummary(headings: readonly HeadingSample[]) {
  const outline = headingOutline(headings);
  const shown = outline.filter((heading) => !heading.hidden);
  return {
    noH1: !shown.some((heading) => heading.level === 1),
    skips: shown.filter((heading) => heading.issue === 'skip').length,
    extraH1: shown.filter((heading) => heading.issue === 'extraH1').length,
  };
}

/** How many checks need fixing and how many are worth a look, plus the outline's trouble. */
export function metaSummary(checks: readonly MetaCheck[], headings: readonly HeadingSample[]) {
  const outline = headingSummary(headings);
  return {
    fix: checks.filter((check) => check.status === 'bad').length + (outline.noH1 ? 1 : 0),
    look: checks.filter((check) => check.status === 'warn').length + (outline.skips ? 1 : 0),
  };
}

export const META_CHECK_KEYS: Record<MetaCheckId, MessageKey> = {
  title: 'meta.check.title',
  description: 'meta.check.description',
  socialTitle: 'meta.check.socialTitle',
  socialImage: 'meta.check.socialImage',
  xCard: 'meta.check.xCard',
  canonical: 'meta.check.canonical',
  lang: 'meta.check.lang',
  viewport: 'meta.check.viewport',
  robots: 'meta.check.robots',
  icons: 'meta.check.icons',
};

export const META_STATUS_KEYS: Record<MetaStatus, MessageKey> = {
  ok: 'meta.status.ok',
  warn: 'meta.status.warn',
  bad: 'meta.status.bad',
  info: 'meta.status.info',
};

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

/** The Meta tab as Markdown: every check, then the headings. */
export function metaMarkdown(page: string, meta: PageMeta, t: Translate): string {
  const checks = metaChecks(meta, page || null);
  const lines = [
    `## ${t('meta.heading')}`,
    '',
    page,
    '',
    `| ${t('meta.colTag')} | ${t('meta.colStatus')} | ${t('meta.colValue')} |`,
    '| --- | --- | --- |',
    ...checks.map(
      (check) =>
        `| ${t(META_CHECK_KEYS[check.id])} | ${t(META_STATUS_KEYS[check.status])} · ${cell(t(check.note, check.params))} | ${check.value ? `\`${cell(check.value)}\`` : '—'} |`,
    ),
    '',
    `### ${t('meta.headings')}`,
    '',
    ...headingOutline(meta.headings).map(
      (heading) =>
        `${'  '.repeat(heading.level - 1)}- H${heading.level} ${heading.text || '—'}${heading.hidden ? ` (${t('meta.hiddenHeading')})` : ''}${heading.issue === 'skip' ? ` — ${t('meta.skip')}` : heading.issue === 'extraH1' ? ` — ${t('meta.extraH1')}` : ''}`,
    ),
  ];
  return `${lines.join('\n')}\n`;
}
