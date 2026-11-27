'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const exporter = require('../steam-guide-exporter.user.js');

// Lightweight zero-dependency DOM shim for behavioral unit testing
function createTextNode(value) {
  return { nodeType: 3, nodeValue: String(value), parentNode: null };
}

function createElement(tagName, attrs = {}, children = []) {
  const el = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    attributes: Object.assign({}, attrs),
    style: {},
    childNodes: [],
    parentNode: null,
    get id() {
      return this.attributes.id || '';
    },
    set id(val) {
      this.attributes.id = String(val);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name)
        ? String(this.attributes[name])
        : '';
    },
    setAttribute(name, val) {
      this.attributes[name] = String(val);
    },
    get className() {
      return this.attributes.class || '';
    },
    set className(val) {
      this.attributes.class = String(val);
    },
    get classList() {
      const self = this;
      const list = () => (self.attributes.class || '').split(/\s+/).filter(Boolean);
      return {
        contains: (c) => list().includes(c),
        add: (c) => {
          const cur = list();
          if (!cur.includes(c)) self.attributes.class = [...cur, c].join(' ');
        },
        remove: (c) => {
          self.attributes.class = list().filter((x) => x !== c).join(' ');
        },
        toggle: (c, force) => {
          const has = list().includes(c);
          const shouldAdd = typeof force === 'boolean' ? force : !has;
          if (shouldAdd && !has) self.classList.add(c);
          if (!shouldAdd && has) self.classList.remove(c);
          return shouldAdd;
        },
      };
    },
    get textContent() {
      return this.childNodes
        .map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent || ''))
        .join('');
    },
    set textContent(val) {
      this.childNodes = [createTextNode(val)];
    },
    appendChild(child) {
      const node = typeof child === 'string' ? createTextNode(child) : child;
      node.parentNode = this;
      this.childNodes.push(node);
      return node;
    },
    contains(target) {
      if (this === target) return true;
      return this.childNodes.some((c) => c.nodeType === 1 && c.contains(target));
    },
    addEventListener() {},
    querySelectorAll(selector) {
      const parts = selector.trim().split(/\s+/);
      const matches = [];
      const walk = (node, ancestors) => {
        if (node.nodeType !== 1) return;
        const chain = [...ancestors, node];
        if (matchesSelectorChain(chain, parts)) matches.push(node);
        for (const ch of node.childNodes) walk(ch, chain);
      };
      for (const ch of this.childNodes) walk(ch, [this]);
      return matches;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
  };

  for (const ch of children) el.appendChild(ch);
  return el;
}

function matchesSimple(el, sel) {
  if (!el || el.nodeType !== 1) return false;
  if (sel.startsWith('#')) return el.getAttribute('id') === sel.slice(1);
  const tagMatch = sel.match(/^[a-z0-9]+/i);
  if (tagMatch && el.tagName.toLowerCase() !== tagMatch[0].toLowerCase()) return false;
  const classes = [...sel.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  return classes.every((c) => el.classList.contains(c));
}

function matchesSelectorChain(chain, parts) {
  let ci = chain.length - 1;
  if (!matchesSimple(chain[ci], parts[parts.length - 1])) return false;
  ci -= 1;
  for (let pi = parts.length - 2; pi >= 0; pi -= 1) {
    let found = false;
    while (ci >= 0) {
      if (matchesSimple(chain[ci], parts[pi])) {
        found = true;
        ci -= 1;
        break;
      }
      ci -= 1;
    }
    if (!found) return false;
  }
  return true;
}

function createMockDocument(rootChildren, { title = '', lang = 'ru', url = '' } = {}) {
  const body = createElement('body', {}, rootChildren);
  const head = createElement('head', {}, []);
  const html = createElement('html', { lang }, [head, body]);
  return {
    title,
    documentElement: html,
    head,
    body,
    location: { href: url },
    createElement: (tag) => createElement(tag),
    querySelector: (sel) => html.querySelector(sel),
    querySelectorAll: (sel) => html.querySelectorAll(sel),
    getElementById: (id) => html.querySelector(`#${id}`),
    addEventListener() {},
  };
}

function buildFernLikeGuideDoc() {
  const thumbUrl =
    'https://images.steamusercontent.com/ugc/52459510682372603/CA891E9385F39B45B2CFC220D1723F17B9F9948D/?imw=128&imh=128&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true';
  const inlineImgUrl =
    'https://images.steamusercontent.com/ugc/13224476356054139186/A2FD694B538DB8DAA33647E4F7C452A5AE058518/';

  const guideTop = createElement('div', { class: 'guideTop' }, [
    createElement('div', { class: 'apphub_AppName' }, ['Space Station 14 Playtest']),
    createElement('div', { class: 'guideTopContent' }, [
      createElement('div', { class: 'guidePreviewImage' }, [
        createElement('img', { src: thumbUrl }),
      ]),
      createElement('div', { class: 'workshopItemTitle' }, ["Fern's Guide to Robust Botany"]),
      createElement('div', { class: 'guideAuthors' }, ['От Terkala']),
      createElement('div', { class: 'guideTopDescription', id: 'highlightContent' }, [
        'Ever want to learn how to make omnizine?',
      ]),
    ]),
    createElement('div', { id: 'ItemControls', class: 'workshopItemControls' }, []),
  ]);

  const sec1 = createElement('div', { class: 'subSection detailBox', id: '7781064' }, [
    createElement('div', { class: 'subSectionTitle' }, ['Introduction and the Basics']),
    createElement('div', { class: 'subSectionDesc' }, [
      'Welcome to my botany guide.\n\n',
      createElement('ul', { class: 'bb_ul' }, [
        createElement('li', {}, [createElement('b', {}, ['Mini-hoe']), ': removes weeds']),
        createElement('li', {}, [createElement('i', {}, ['Spade']), ': uproots plants']),
      ]),
      createElement('a', { href: inlineImgUrl, class: 'modalContentLink' }, [
        createElement('img', {
          src: `${inlineImgUrl}?imw=512&imh=512`,
          class: 'sharedFilePreviewImage sizeThumb floatLeft',
          alt: 'Hydroponics tray',
        }),
      ]),
      createElement('div', { style: 'clear: both' }, []),
    ]),
  ]);

  const sec2 = createElement('div', { class: 'subSection detailBox', id: '7807868' }, [
    createElement('div', { class: 'subSectionTitle' }, ['Chems & Tables']),
    createElement('div', { class: 'subSectionDesc' }, [
      createElement('div', { class: 'bb_table' }, [
        createElement('div', { class: 'bb_table_tr' }, [
          createElement('div', { class: 'bb_table_th' }, [
            createElement('div', { class: 'bb_h1' }, ['Plant']),
          ]),
          createElement('div', { class: 'bb_table_th' }, [
            createElement('div', { class: 'bb_h1' }, ['Reagent']),
          ]),
        ]),
        // Orphan bb_table_th cells (observed live on Steam guide 3816843988)
        createElement('div', { class: 'bb_table_th' }, ['Ambrosia Deus']),
        createElement('div', { class: 'bb_table_th' }, [
          createElement('a', {
            class: 'bb_link',
            href: 'https://steamcommunity.com/linkfilter/?u=https%3A%2F%2Fwiki.spacestation14.com%2Fwiki%2FBotany',
          }, ['Omnizine']),
        ]),
      ]),
      createElement('div', { class: 'bb_blockquote' }, ['Always wear insulated gloves.']),
      createElement('div', { class: 'bb_code' }, ['mix(ambrosia, mutagen)']),
      createElement('span', { class: 'bb_spoiler' }, ['Secret mutation']),
      createElement('span', { class: 'bb_spoiler' }, ['']),
      createElement('div', { style: 'clear: both' }, []),
    ]),
  ]);

  const subSections = createElement('div', { class: 'guide subSections' }, [sec1, sec2]);

  return createMockDocument([guideTop, subSections], {
    title: "Сообщество Steam :: Руководство :: Fern's Guide to Robust Botany",
    lang: 'ru',
    url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3443098725&searchtext=fern',
  });
}

test('resolveFullImageUrl strips Steam thumbnail resize query parameters', () => {
  const thumb =
    'https://images.steamusercontent.com/ugc/52459510682372603/CA891E9385F39B45B2CFC220D1723F17B9F9948D/?imw=128&imh=128&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true';
  assert.equal(
    exporter.resolveFullImageUrl(thumb, ''),
    'https://images.steamusercontent.com/ugc/52459510682372603/CA891E9385F39B45B2CFC220D1723F17B9F9948D/'
  );
});

test('unwrapSteamLink extracts destination URL from Steam linkfilter', () => {
  assert.equal(
    exporter.unwrapSteamLink('https://steamcommunity.com/linkfilter/?u=https%3A%2F%2Fexample.com%2Fpage'),
    'https://example.com/page'
  );
  assert.equal(exporter.unwrapSteamLink('https://youtu.be/abc123'), 'https://youtu.be/abc123');
});

test('sanitizeFilename creates clean filenames for both image variants', () => {
  assert.equal(
    exporter.sanitizeFilename("Fern's Guide: Botany / 101?", true, 'md'),
    "Fern's_Guide_Botany_101_with_images.md"
  );
  assert.equal(
    exporter.sanitizeFilename('Гайд по ботанике', false, 'html'),
    'Гайд_по_ботанике_no_images.html'
  );
});

test('buildMarkdown with images includes cover, full-res inline images, tables, quotes, code, spoilers', () => {
  const doc = buildFernLikeGuideDoc();
  const data = exporter.extractGuideData(doc, doc.location.href);

  assert.equal(data.title, "Fern's Guide to Robust Botany");
  assert.equal(data.game, 'Space Station 14 Playtest');
  assert.equal(data.author, 'Terkala');
  assert.equal(data.sections.length, 2);

  const md = exporter.buildMarkdown(data, { includeImages: true });

  assert.match(md, /^# Fern's Guide to Robust Botany/m);
  assert.match(md, /!\[Fern's Guide to Robust Botany\]\(https:\/\/images\.steamusercontent\.com\/ugc\/52459510682372603\/CA891E9385F39B45B2CFC220D1723F17B9F9948D\/\)/);
  assert.match(md, /!\[Hydroponics tray\]\(https:\/\/images\.steamusercontent\.com\/ugc\/13224476356054139186\/A2FD694B538DB8DAA33647E4F7C452A5AE058518\/\)/);
  assert.doesNotMatch(md, /imw=128|imw=512/);
  assert.match(md, /- \*\*Mini-hoe\*\*: removes weeds/);
  assert.match(md, /- \*Spade\*: uproots plants/);
  assert.match(md, /\| \*\*Plant\*\* \| \*\*Reagent\*\* \|/);
  assert.match(md, /\| Ambrosia Deus \| \[Omnizine\]\(https:\/\/wiki\.spacestation14\.com\/wiki\/Botany\) \|/);
  assert.match(md, /> Always wear insulated gloves\./);
  assert.match(md, /```\nmix\(ambrosia, mutagen\)\n```/);
  assert.match(md, /\|\|Secret mutation\|\|/);
});

test('buildMarkdown without images strips cover, inline images, and modalContentLink wrappers completely', () => {
  const doc = buildFernLikeGuideDoc();
  const data = exporter.extractGuideData(doc, doc.location.href);
  const md = exporter.buildMarkdown(data, { includeImages: false });

  assert.doesNotMatch(md, /!\[/);
  assert.doesNotMatch(md, /images\.steamusercontent\.com/);
  assert.match(md, /## Introduction and the Basics/);
  assert.match(md, /- \*\*Mini-hoe\*\*: removes weeds/);
  assert.match(md, /\[Omnizine\]\(https:\/\/wiki\.spacestation14\.com\/wiki\/Botany\)/);
});

test('buildHtml supports both offline Base64 images and no-image variants', () => {
  const doc = buildFernLikeGuideDoc();
  const data = exporter.extractGuideData(doc, doc.location.href);
  const urls = exporter.collectImageUrls(data);

  assert.equal(urls.length, 2);

  const imageDataMap = {
    [urls[0]]: 'data:image/png;base64,COVERDATA',
    [urls[1]]: 'data:image/png;base64,INLINEDATA',
  };

  const htmlWith = exporter.buildHtml(data, { includeImages: true, imageDataMap });
  assert.match(htmlWith, /data:image\/png;base64,COVERDATA/);
  assert.match(htmlWith, /data:image\/png;base64,INLINEDATA/);
  assert.match(htmlWith, /<img /);

  const htmlWithout = exporter.buildHtml(data, { includeImages: false });
  assert.doesNotMatch(htmlWithout, /<img /);
  assert.doesNotMatch(htmlWithout, /images\.steamusercontent\.com/);
  assert.match(htmlWithout, /Fern&#39;s Guide to Robust Botany/);
  assert.match(htmlWithout, /Always wear insulated gloves\./);
});

test('mountUi injects button on guide pages and skips non-guide pages', () => {
  const guideDoc = buildFernLikeGuideDoc();
  assert.equal(exporter.mountUi(guideDoc), true);
  assert.ok(guideDoc.getElementById('sge-export-btn'));
  assert.ok(guideDoc.getElementById('sge-export-menu'));
  // Idempotent second call
  assert.equal(exporter.mountUi(guideDoc), true);

  const nonGuideDoc = createMockDocument([
    createElement('div', { id: 'ItemControls', class: 'workshopItemControls' }, []),
  ]);
  assert.equal(exporter.isGuidePage(nonGuideDoc), false);
  assert.equal(exporter.mountUi(nonGuideDoc), false);
  assert.equal(nonGuideDoc.getElementById('sge-export-btn'), null);
});

test('sanitizeUrl and unwrapSteamLink block javascript/data/vbscript XSS payloads in HTML and Markdown', () => {
  const payloads = [
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'https://steamcommunity.com/linkfilter/?u=javascript%3Aalert(1)',
  ];

  for (const bad of payloads) {
    assert.equal(exporter.unwrapSteamLink(bad), '');
  }

  const desc = createElement('div', {}, [
    createElement('a', { href: 'https://steamcommunity.com/linkfilter/?u=javascript%3Aalert(1)' }, ['click']),
    ' ',
    createElement('a', { href: 'JAVASCRIPT:alert(2)' }, ['upper']),
    ' ',
    createElement('iframe', { src: 'https://www.youtube.com/embed/dQw4w9WgXcQ' }, []),
  ]);

  const guide = {
    title: 'XSS Test',
    game: '',
    author: '',
    url: '',
    coverImage: '',
    descriptionNode: desc,
    sections: [],
    lang: 'en',
  };

  const html = exporter.buildHtml(guide, { includeImages: false });
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /click/);
  assert.match(html, /upper/);
  assert.match(html, /https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ/);

  const md = exporter.buildMarkdown(guide, { includeImages: false });
  assert.doesNotMatch(md, /javascript:/i);
  assert.match(md, /click upper/);
  assert.match(md, /\[Video\]\(https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ\)/);
});
