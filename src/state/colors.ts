import type { ColorCount, ColorSample } from '../agent/protocol';
import type { MessageKey } from '../i18n/en';

/**
 * The audit's Colours tab: the colours a page shows for text, backgrounds and
 * borders, merged across the previews (a colour counts as often as in the
 * preview that uses it most), and the palette as CSS custom properties.
 */

export type ColorRole = 'text' | 'background' | 'border';
export const COLOR_ROLES: readonly ColorRole[] = ['text', 'background', 'border'];

export const COLOR_ROLE_KEYS: Record<ColorRole, MessageKey> = {
  text: 'colorAudit.text',
  background: 'colorAudit.background',
  border: 'colorAudit.border',
};

export type Palette = Record<ColorRole, ColorCount[]>;

const HEX = /^#[0-9a-f]{6}$/i;

export function mergePalettes(samples: readonly (ColorSample | null | undefined)[], limit = 24): Palette {
  const palette: Palette = { text: [], background: [], border: [] };
  for (const role of COLOR_ROLES) {
    const counts = new Map<string, number>();
    for (const sample of samples)
      for (const { hex, count } of sample?.[role] ?? []) {
        if (!HEX.test(hex)) continue;
        const key = hex.toLowerCase();
        counts.set(key, Math.max(counts.get(key) ?? 0, count));
      }
    palette[role] = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([hex, count]) => ({ hex, count }));
  }
  return palette;
}

export const paletteSize = (palette: Palette) =>
  new Set(COLOR_ROLES.flatMap((role) => palette[role].map((color) => color.hex))).size;

/** The palette as CSS custom properties, e.g. `--text-1: #1f2430;`, most used first. */
export function paletteCss(palette: Palette): string {
  const lines = COLOR_ROLES.flatMap((role) =>
    palette[role].map((color, index) => `  --${role}-${index + 1}: ${color.hex}; /* ${color.count} */`),
  );
  return `:root {\n${lines.join('\n')}\n}\n`;
}

const cell = (value: string) => value.replace(/\|/g, '\\|').trim() || '—';

/** The palette as a Markdown table: role, colour and how many elements use it. */
export function paletteMarkdown(
  page: string,
  palette: Palette,
  heading: string,
  headers: [string, string, string],
  roleName: (role: ColorRole) => string,
): string {
  const lines = [
    `${heading} · ${page}`,
    '',
    `| ${headers.map(cell).join(' | ')} |`,
    '| --- | --- | ---: |',
    ...COLOR_ROLES.flatMap((role) =>
      palette[role].map((color) => `| ${cell(roleName(role))} | \`${color.hex}\` | ${color.count} |`),
    ),
  ];
  return `${lines.join('\n')}\n`;
}
