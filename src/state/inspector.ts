import type { ElementInfo } from '../agent/protocol';

/** The details the inspector compares across viewports, in display order. */
export const INSPECTED_PROPERTIES = ['size', 'display', 'font', 'margin', 'padding', 'layout', 'position'] as const;

export type InspectedProperty = (typeof INSPECTED_PROPERTIES)[number];

/** One line of text for a property, e.g. "343 × 120" or "16px / 24px · 600". Empty when there is nothing to show. */
export function propertyValue(info: ElementInfo, property: InspectedProperty): string {
  switch (property) {
    case 'size':
      return `${info.width} × ${info.height}`;
    case 'display':
      return info.display;
    case 'font':
      return `${info.fontSize} / ${info.lineHeight} · ${info.fontWeight}`;
    case 'margin':
      return info.margin;
    case 'padding':
      return info.padding;
    case 'layout':
      return info.layout;
    case 'position':
      return info.position === 'static' ? '' : info.position;
  }
}

/**
 * Properties whose value isn't the same in every viewport where the element is
 * shown — what changes between sizes. The size almost always differs, so it is
 * reported only when the element's height changes (its width tracks the viewport).
 */
export function changingProperties(infos: (ElementInfo | null | undefined)[]): Set<InspectedProperty> {
  const shown = infos.filter((info): info is ElementInfo => Boolean(info?.visible));
  const changing = new Set<InspectedProperty>();
  if (shown.length < 2) return changing;
  for (const property of INSPECTED_PROPERTIES) {
    const values =
      property === 'size'
        ? shown.map((info) => String(info.height))
        : shown.map((info) => propertyValue(info, property));
    if (new Set(values).size > 1) changing.add(property);
  }
  return changing;
}

export type ComparisonRow = { name: string; width: number; info: ElementInfo | null | undefined };

/** Text used in the comparison table for states other than a shown element. */
export type ComparisonLabels = { viewport: string; missing: string; hidden: string; waiting: string } & Record<
  InspectedProperty,
  string
>;

const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '—';

/**
 * The comparison as a Markdown table (one row per viewport, one column per
 * property), to paste into a ticket or a pull request.
 */
export function comparisonMarkdown(selector: string, rows: ComparisonRow[], labels: ComparisonLabels): string {
  const header = [labels.viewport, ...INSPECTED_PROPERTIES.map((property) => labels[property])];
  const lines = [
    `\`${selector.replace(/`/g, "'")}\``,
    '',
    `| ${header.map(cell).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) {
    const name = `${row.name} (${row.width}px)`;
    const state = row.info === undefined ? labels.waiting : row.info === null ? labels.missing : labels.hidden;
    const values =
      row.info && row.info.visible
        ? INSPECTED_PROPERTIES.map((property) => propertyValue(row.info!, property))
        : [state, ...INSPECTED_PROPERTIES.slice(1).map(() => '')];
    lines.push(`| ${[name, ...values].map(cell).join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

/** Whether the element is shown in some viewports and hidden (or missing) in others. */
export function visibilityChanges(infos: (ElementInfo | null | undefined)[]): boolean {
  const states = new Set(infos.filter((info) => info !== undefined).map((info) => Boolean(info?.visible)));
  return states.size > 1;
}
