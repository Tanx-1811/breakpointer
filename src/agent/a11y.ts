/**
 * Accessibility helpers for the frame agent: the Pro accessibility checks and
 * synced interactions. DOM-only and dependency-free (unit tested in jsdom).
 *
 * The accessible name here is a simplified version of the W3C algorithm
 * (accname 1.2), good enough to tell "has a name" from "has none" — which is
 * all the checks need. Like the other checks it errs on the side of not
 * reporting: anything that may give a name counts as one.
 */

const MAX_DEPTH = 12;

/** Letters or digits: generated text made only of symbols (icon fonts, "×") isn't a name. */
const MEANINGFUL = /[\p{L}\p{N}]/u;

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Hidden from everyone: `hidden`, `display: none`, `visibility: hidden`, or `aria-hidden="true"`. */
function hiddenNode(element: Element): boolean {
  if (element.getAttribute('aria-hidden') === 'true') return true;
  if (element instanceof HTMLElement && element.hidden) return true;
  const style = getComputedStyle(element);
  return style.display === 'none' || style.visibility === 'hidden';
}

/** Hidden from assistive technology, by itself or an ancestor. */
export const hiddenFromAssistiveTech = (element: Element) => element.closest('[aria-hidden="true"]') !== null;

/** Text a ::before or ::after adds, when it reads as words. */
function generatedText(element: Element, pseudo: '::before' | '::after'): string {
  let content: string;
  try {
    content = getComputedStyle(element, pseudo).content;
  } catch {
    return '';
  }
  if (!content || content === 'none' || content === 'normal') return '';
  const text = [...content.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)]
    .map((match) => match[1] ?? match[2] ?? '')
    .join('');
  return MEANINGFUL.test(text) ? text : '';
}

function svgTitle(element: Element): string {
  const title = Array.from(element.children).find((child) => child.localName === 'title');
  return collapse(title?.textContent ?? '');
}

/** What an element's content reads as: its text, images' alt, SVG titles and labelled children; hidden parts skipped. */
export function contentName(element: Element, depth = 0): string {
  if (depth > MAX_DEPTH) return '';
  const parts: string[] = [generatedText(element, '::before')];
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
      continue;
    }
    if (!(node instanceof Element) || hiddenNode(node)) continue;
    const label = node.getAttribute('aria-label');
    if (label && collapse(label)) {
      parts.push(label);
      continue;
    }
    if (node.localName === 'img' || node.localName === 'area') parts.push(node.getAttribute('alt') ?? '');
    else if (node.localName === 'svg') parts.push(svgTitle(node));
    else parts.push(contentName(node, depth + 1));
  }
  parts.push(generatedText(element, '::after'));
  return collapse(parts.join(' '));
}

/** Roles (and elements) whose name may come from their content. */
const NAME_FROM_CONTENT =
  /^(button|link|tab|menuitem|menuitemcheckbox|menuitemradio|option|checkbox|radio|switch|treeitem|heading|cell|columnheader|rowheader|tooltip)$/;

function nameFromContentAllowed(element: Element): boolean {
  const role = element.getAttribute('role');
  if (role) return NAME_FROM_CONTENT.test(role.trim().split(/\s+/)[0] ?? '');
  return /^(a|button|summary|h[1-6]|td|th|label|legend|caption|option)$/.test(element.localName);
}

const BUTTON_TYPES = /^(button|submit|reset)$/;

/** The element's accessible name, simplified (see above); '' when it has none. */
export function accessibleName(element: Element): string {
  const doc = element.ownerDocument;
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = collapse(
      labelledBy
        .split(/\s+/)
        .map((id) => {
          const target = id ? doc.getElementById(id) : null;
          return target ? contentName(target) || collapse(target.textContent ?? '') : '';
        })
        .join(' '),
    );
    if (text) return text;
  }
  const label = collapse(element.getAttribute('aria-label') ?? '');
  if (label) return label;

  if (element instanceof HTMLInputElement) {
    const type = element.type;
    if (BUTTON_TYPES.test(type)) {
      // Submit and reset buttons have a name of their own ("Submit", "Reset") when they have no value.
      const value = collapse(element.value);
      if (value) return value;
      if (type !== 'button') return type;
    } else if (type === 'image') {
      const alt = collapse(element.getAttribute('alt') ?? '');
      if (alt) return alt;
    }
  }
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const labels = Array.from(element.labels ?? [])
      .map((labelElement) => contentName(labelElement))
      .join(' ');
    if (collapse(labels)) return collapse(labels);
  }
  if (element.localName === 'img' || element.localName === 'area') {
    const alt = collapse(element.getAttribute('alt') ?? '');
    if (alt) return alt;
  }
  if (element.localName === 'svg') {
    const title = svgTitle(element);
    if (title) return title;
  }
  if (nameFromContentAllowed(element)) {
    const content = contentName(element);
    if (content) return content;
  }
  const title = collapse(element.getAttribute('title') ?? '');
  if (title) return title;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const placeholder = collapse(element.getAttribute('placeholder') ?? '');
    if (placeholder) return placeholder;
  }
  return '';
}

/** Images that need a text alternative: `<img>` and `role="img"` (an empty `alt` marks a decorative image). */
export function lacksTextAlternative(element: Element): boolean {
  if (hiddenFromAssistiveTech(element)) return false;
  const role = element.getAttribute('role');
  if (role === 'presentation' || role === 'none') return false;
  if (element.localName === 'img') return !element.hasAttribute('alt') && !accessibleName(element);
  return role === 'img' && !accessibleName(element);
}

/** Buttons and links (`unnamed-control`). */
export const CONTROL_SELECTOR =
  'a[href], button, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], input[type="button"], input[type="image"]';

/** Form fields that need a label (`unlabeled-field`). */
export const FIELD_SELECTOR =
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), select, textarea, [role="textbox"], [role="combobox"], [role="searchbox"]';

/** Elements that can take keyboard focus (candidates; `inTabOrder` decides). */
export const FOCUSABLE_SELECTOR =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, [tabindex], [contenteditable=""], [contenteditable="true"]';

/** Reached with the Tab key: not disabled, not inert, and not taken out with `tabindex="-1"`. */
export function inTabOrder(element: Element): boolean {
  if (!(element instanceof HTMLElement) || element.tabIndex < 0) return false;
  if ((element as HTMLButtonElement).disabled === true) return false;
  return element.closest('[inert]') === null;
}

/* ---------- Synced interactions ---------- */

/** What a click acts on: the nearest button, link, summary, form control or element with a button-like role. */
const ACTIONABLE =
  'a[href], button, summary, label, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"], [role="treeitem"], [aria-expanded], [aria-controls]';

export function clickTarget(target: Element): Element {
  return target.closest(ACTIONABLE) ?? target;
}

/** A link that loads another page: synced navigation already takes the other previews there. */
export function navigatesAway(element: Element): boolean {
  if (!(element instanceof HTMLAnchorElement || element instanceof HTMLAreaElement) || !element.hasAttribute('href'))
    return false;
  const href = (element.getAttribute('href') ?? '').trim();
  return !(href === '' || href.startsWith('#') || /^javascript:/i.test(href));
}

/** Would submit a form: never done again in other previews (it could send an order or a message twice). */
export function submitsForm(element: Element): boolean {
  if (element instanceof HTMLButtonElement) return element.type === 'submit' && element.form !== null;
  if (element instanceof HTMLInputElement)
    return (element.type === 'submit' || element.type === 'image') && element.form !== null;
  return false;
}

/** Fields whose values never travel to other previews: passwords, one-time codes and payment details. */
export function isSensitiveField(element: Element): boolean {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return false;
  if (element instanceof HTMLInputElement && (element.type === 'password' || element.type === 'file')) return true;
  const autocomplete = (element.getAttribute('autocomplete') ?? '').toLowerCase();
  return /\b(cc-[\w-]+|one-time-code|current-password|new-password)\b/.test(autocomplete);
}

/** A click that other previews may repeat: not a link to another page, not a form submission, not a field (fields sync their values). */
export function mirrorsClick(element: Element): boolean {
  if (navigatesAway(element) || submitsForm(element)) return false;
  // Clicking a label clicks its field; fields send their own changes.
  if (/^(label|input|select|textarea|option)$/.test(element.localName)) {
    return element instanceof HTMLInputElement && /^(button|reset)$/.test(element.type);
  }
  return !element.closest('[contenteditable=""], [contenteditable="true"]');
}
