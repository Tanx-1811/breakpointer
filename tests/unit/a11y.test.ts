import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTROL_SELECTOR,
  FIELD_SELECTOR,
  accessibleName,
  clickTarget,
  contentName,
  inTabOrder,
  isSensitiveField,
  lacksTextAlternative,
  mirrorsClick,
  navigatesAway,
  submitsForm,
} from '../../src/agent/a11y';

const html = (markup: string) => {
  document.body.innerHTML = markup;
  return document.body;
};
const $ = (selector: string) => document.querySelector(selector)!;

// jsdom has no styles for ::before and ::after (and says so on every call): leave them out.
const computed = window.getComputedStyle.bind(window);
beforeEach(() => {
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => computed(element));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('accessible names', () => {
  it('reads names in the order assistive technology does', () => {
    html(`
      <span id="l1">Close</span><span id="l2">dialog</span>
      <button id="labelledby" aria-labelledby="l1 l2" aria-label="ignored">x</button>
      <button id="label" aria-label="  Open menu ">☰</button>
      <button id="text">Save <span aria-hidden="true">💾</span></button>
      <button id="img"><img src="a.png" alt="Search"></button>
      <button id="svg"><svg><title>Settings</title></svg></button>
      <button id="icon"><svg aria-hidden="true"></svg></button>
      <button id="decorative"><img src="a.png" alt=""></button>
      <a id="title" href="/x" title="Home"><svg></svg></a>
      <button id="hidden-text"><span hidden>Secret</span></button>
      <button id="nested"><span><b aria-label="Next page">›</b></span></button>
    `);
    expect(accessibleName($('#labelledby'))).toBe('Close dialog');
    expect(accessibleName($('#label'))).toBe('Open menu');
    expect(accessibleName($('#text'))).toBe('Save');
    expect(accessibleName($('#img'))).toBe('Search');
    expect(accessibleName($('#svg'))).toBe('Settings');
    expect(accessibleName($('#icon'))).toBe('');
    expect(accessibleName($('#decorative'))).toBe('');
    expect(accessibleName($('#title'))).toBe('Home');
    expect(accessibleName($('#hidden-text'))).toBe('');
    expect(accessibleName($('#nested'))).toBe('Next page');
  });

  it('names form fields from labels, then title and placeholder', () => {
    html(`
      <label for="email">Email</label><input id="email">
      <label>Name <input id="wrapped"></label>
      <input id="title" title="Search the site">
      <input id="placeholder" placeholder="Your city">
      <input id="none">
      <select id="select"></select>
      <input id="submit" type="submit">
      <input id="button" type="button">
      <input id="image" type="image" alt="Go">
    `);
    expect(accessibleName($('#email'))).toBe('Email');
    expect(accessibleName($('#wrapped'))).toBe('Name');
    expect(accessibleName($('#title'))).toBe('Search the site');
    expect(accessibleName($('#placeholder'))).toBe('Your city');
    expect(accessibleName($('#none'))).toBe('');
    expect(accessibleName($('#select'))).toBe('');
    expect(accessibleName($('#submit'))).toBe('submit');
    expect(accessibleName($('#button'))).toBe('');
    expect(accessibleName($('#image'))).toBe('Go');
  });

  it('reads content with images and hidden parts', () => {
    html(`<p id="p">Hello <img alt="world"> <span style="display:none">gone</span></p>`);
    expect(contentName($('#p'))).toBe('Hello world');
  });

  it('finds images without a text alternative', () => {
    html(`
      <img id="missing" src="a.png">
      <img id="empty" src="a.png" alt="">
      <img id="named" src="a.png" aria-label="Logo">
      <img id="presentation" src="a.png" role="presentation">
      <div aria-hidden="true"><img id="hidden" src="a.png"></div>
      <div id="role" role="img"></div>
      <div id="role-named" role="img" aria-label="Chart"></div>
    `);
    expect(lacksTextAlternative($('#missing'))).toBe(true);
    expect(lacksTextAlternative($('#empty'))).toBe(false);
    expect(lacksTextAlternative($('#named'))).toBe(false);
    expect(lacksTextAlternative($('#presentation'))).toBe(false);
    expect(lacksTextAlternative($('#hidden'))).toBe(false);
    expect(lacksTextAlternative($('#role'))).toBe(true);
    expect(lacksTextAlternative($('#role-named'))).toBe(false);
  });

  it('selects controls and fields', () => {
    html(`
      <a href="/a">a</a><a>no href</a><button>b</button><div role="button">c</div>
      <input type="hidden"><input type="submit"><input><textarea></textarea><select></select>
    `);
    expect(document.querySelectorAll(CONTROL_SELECTOR)).toHaveLength(3);
    expect(document.querySelectorAll(FIELD_SELECTOR)).toHaveLength(3);
  });

  it('knows what the Tab key reaches', () => {
    html(`
      <button id="b">b</button>
      <button id="disabled" disabled>d</button>
      <a id="out" href="/x" tabindex="-1">x</a>
      <div inert><button id="inert">i</button></div>
      <div id="div" tabindex="0">div</div>
    `);
    expect(inTabOrder($('#b'))).toBe(true);
    expect(inTabOrder($('#disabled'))).toBe(false);
    expect(inTabOrder($('#out'))).toBe(false);
    expect(inTabOrder($('#inert'))).toBe(false);
    expect(inTabOrder($('#div'))).toBe(true);
  });
});

describe('synced interactions', () => {
  it('repeats clicks on buttons and in-page controls only', () => {
    html(`
      <button id="menu" aria-expanded="false"><span id="inner">☰</span></button>
      <a id="page" href="/other">Other page</a>
      <a id="hash" href="#top">Top</a>
      <a id="js" href="javascript:void(0)">Toggle</a>
      <form><input id="field"><button id="send">Send</button><button id="plain" type="button">Add</button>
      <input id="reset" type="reset"><input id="go" type="submit"></form>
      <label id="label" for="field">Field</label>
      <div contenteditable="true"><b id="editable">x</b></div>
    `);
    expect(clickTarget($('#inner'))).toBe($('#menu'));
    expect(mirrorsClick($('#menu'))).toBe(true);
    expect(navigatesAway($('#page'))).toBe(true);
    expect(mirrorsClick($('#page'))).toBe(false);
    expect(mirrorsClick($('#hash'))).toBe(true);
    expect(mirrorsClick($('#js'))).toBe(true);
    // Submitting a form is never repeated.
    expect(submitsForm($('#send'))).toBe(true);
    expect(mirrorsClick($('#send'))).toBe(false);
    expect(mirrorsClick($('#go'))).toBe(false);
    expect(mirrorsClick($('#plain'))).toBe(true);
    expect(mirrorsClick($('#reset'))).toBe(true);
    // Fields send their values; labels click their fields.
    expect(mirrorsClick($('#field'))).toBe(false);
    expect(mirrorsClick($('#label'))).toBe(false);
    expect(mirrorsClick($('#editable'))).toBe(false);
  });

  it('never sends passwords, codes or payment details', () => {
    html(`
      <input id="password" type="password">
      <input id="code" autocomplete="one-time-code">
      <input id="card" autocomplete="cc-number">
      <input id="new" autocomplete="new-password">
      <input id="file" type="file">
      <input id="name" autocomplete="name">
      <textarea id="text"></textarea>
    `);
    for (const id of ['password', 'code', 'card', 'new', 'file']) expect(isSensitiveField($(`#${id}`)), id).toBe(true);
    expect(isSensitiveField($('#name'))).toBe(false);
    expect(isSensitiveField($('#text'))).toBe(false);
  });
});
