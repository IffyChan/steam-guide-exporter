// ==UserScript==
// @name         Steam Guide Exporter (With / Without Images)
// @name:ru      Экспорт руководств Steam (с картинками и без)
// @namespace    https://github.com/IffyChan/steam-guide-exporter
// @version      1.0.0
// @description  Adds an Export button to Steam Community Guides to download guides in Markdown (.md) or standalone HTML (.html), with or without images.
// @description:ru Добавляет кнопку экспорта на страницы руководств Steam в двух вариациях: с картинками и без картинок (Markdown и офлайн HTML).
// @author       IffyChan
// @homepageURL  https://github.com/IffyChan/steam-guide-exporter
// @supportURL   https://github.com/IffyChan/steam-guide-exporter/issues
// @downloadURL  https://raw.githubusercontent.com/IffyChan/steam-guide-exporter/main/steam-guide-exporter.user.js
// @updateURL    https://raw.githubusercontent.com/IffyChan/steam-guide-exporter/main/steam-guide-exporter.user.js
// @match        https://steamcommunity.com/sharedfiles/filedetails/*
// @match        https://steamcommunity.com/workshop/filedetails/*
// @icon         https://steamcommunity.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @connect      images.steamusercontent.com
// @connect      steamuserimages-a.akamaihd.net
// @connect      shared.fastly.steamstatic.com
// @connect      community.akamai.steamstatic.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function (root) {
  'use strict';

  const BUTTON_ID = 'sge-export-btn';
  const MENU_ID = 'sge-export-menu';
  const STYLE_ID = 'sge-export-styles';

  const STRINGS = {
    ru: {
      exportBtn: 'Экспорт',
      exportTitle: 'Экспортировать руководство Steam',
      mdWithImages: 'С картинками (Markdown .md)',
      mdWithoutImages: 'Без картинок (Markdown .md)',
      htmlWithImages: 'С картинками офлайн (HTML .html)',
      htmlWithoutImages: 'Без картинок (HTML .html)',
      copyWithImages: 'Копировать MD с картинками',
      copyWithoutImages: 'Копировать MD без картинок',
      sectionMarkdown: 'Markdown',
      sectionHtml: 'Автономный HTML',
      sectionClipboard: 'Буфер обмена',
      loadingImages: 'Загрузка картинок',
      copied: 'Скопировано!',
      exported: 'Экспортировано!',
      error: 'Ошибка экспорта',
      metaGame: 'Игра',
      metaAuthor: 'Автор',
      metaSource: 'Источник',
      metaExported: 'Экспортировано',
      tocTitle: 'Оглавление',
      descriptionTitle: 'Описание',
      spoilerLabel: 'Спойлер',
    },
    en: {
      exportBtn: 'Export',
      exportTitle: 'Export Steam Guide',
      mdWithImages: 'With images (Markdown .md)',
      mdWithoutImages: 'Without images (Markdown .md)',
      htmlWithImages: 'With images offline (HTML .html)',
      htmlWithoutImages: 'Without images (HTML .html)',
      copyWithImages: 'Copy MD with images',
      copyWithoutImages: 'Copy MD without images',
      sectionMarkdown: 'Markdown',
      sectionHtml: 'Standalone HTML',
      sectionClipboard: 'Clipboard',
      loadingImages: 'Fetching images',
      copied: 'Copied!',
      exported: 'Exported!',
      error: 'Export failed',
      metaGame: 'Game',
      metaAuthor: 'Author',
      metaSource: 'Source',
      metaExported: 'Exported',
      tocTitle: 'Table of Contents',
      descriptionTitle: 'Description',
      spoilerLabel: 'Spoiler',
    },
  };

  function detectLang(doc) {
    const htmlLang = (doc && doc.documentElement && doc.documentElement.lang) || '';
    if (htmlLang.toLowerCase().startsWith('ru')) return 'ru';
    const title = (doc && doc.title) || '';
    if (title.includes('Сообщество Steam') || title.includes('Руководство')) return 'ru';
    return 'en';
  }

  function getStrings(doc) {
    return STRINGS[detectLang(doc)] || STRINGS.en;
  }

  function cleanText(str) {
    return String(str || '').replace(/\u00A0/g, ' ').trim();
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeUrl(href) {
    if (!href) return '';
    const trimmed = String(href).trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('#')) return trimmed;
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
    try {
      const parsed = new URL(trimmed, 'https://steamcommunity.com');
      if (
        parsed.protocol === 'http:' ||
        parsed.protocol === 'https:' ||
        parsed.protocol === 'mailto:'
      ) {
        return parsed.href;
      }
      return '';
    } catch {
      return '';
    }
  }

  function unwrapSteamLink(href) {
    if (!href) return '';
    const trimmed = href.trim();
    try {
      const parsed = new URL(trimmed, 'https://steamcommunity.com');
      if (
        parsed.hostname === 'steamcommunity.com' &&
        parsed.pathname.startsWith('/linkfilter')
      ) {
        const target = parsed.searchParams.get('u') || parsed.searchParams.get('url');
        if (target) return sanitizeUrl(target);
      }
      return sanitizeUrl(parsed.href);
    } catch {
      return sanitizeUrl(trimmed);
    }
  }

  function isSteamUgcImageUrl(url) {
    if (!url) return false;
    return (
      /^https?:\/\/(images\.steamusercontent\.com|steamuserimages-a\.akamaihd\.net)\//i.test(url) ||
      /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url)
    );
  }

  function resolveFullImageUrl(imgSrc, anchorHref) {
    const candidate = anchorHref && isSteamUgcImageUrl(anchorHref) ? anchorHref : imgSrc;
    if (!candidate) return '';
    try {
      const parsed = new URL(candidate, 'https://steamcommunity.com');
      if (
        parsed.hostname === 'images.steamusercontent.com' ||
        parsed.hostname === 'steamuserimages-a.akamaihd.net'
      ) {
        const resizeParams = ['imw', 'imh', 'ima', 'impolicy', 'imcolor', 'letterbox'];
        for (const param of resizeParams) {
          parsed.searchParams.delete(param);
        }
      }
      return parsed.href;
    } catch {
      return candidate;
    }
  }

  function slugify(text) {
    return cleanText(text)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  }

  function sanitizeFilename(title, includeImages, ext) {
    const base = cleanText(title)
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 80)
      .replace(/^[._-]+|[._-]+$/g, '') || 'steam_guide';
    const variant = includeImages ? 'with_images' : 'no_images';
    return `${base}_${variant}.${ext}`;
  }

  function isGuidePage(doc) {
    if (!doc || typeof doc.querySelector !== 'function') return false;
    return Boolean(
      doc.querySelector('.guide.subSections') ||
      doc.querySelector('.guideTop') ||
      doc.querySelector('#GuideTableOfContents')
    );
  }

  function hasClass(el, cls) {
    if (!el) return false;
    if (el.classList && typeof el.classList.contains === 'function') {
      return el.classList.contains(cls);
    }
    const raw = (typeof el.getAttribute === 'function' ? el.getAttribute('class') : el.className) || '';
    return raw.split(/\s+/).includes(cls);
  }

  function getAttr(el, name) {
    if (!el) return '';
    if (typeof el.getAttribute === 'function') return el.getAttribute(name) || '';
    return (el.attributes && el.attributes[name]) || '';
  }

  function getTag(el) {
    return el && el.tagName ? String(el.tagName).toLowerCase() : '';
  }

  function isClearDiv(el) {
    if (getTag(el) !== 'div') return false;
    const style = getAttr(el, 'style').toLowerCase();
    return style.includes('clear:') || style.includes('clear :');
  }

  function extractGuideData(doc, pageUrl) {
    const titleEl =
      doc.querySelector('.guideTopContent .workshopItemTitle') ||
      doc.querySelector('.workshopItemTitle');
    const title = cleanText(titleEl ? titleEl.textContent : doc.title || 'Steam Guide');

    const gameEl =
      doc.querySelector('.apphub_AppName') ||
      doc.querySelector('.breadcrumbs a');
    const game = cleanText(gameEl ? gameEl.textContent : '');

    const authorEl =
      doc.querySelector('.guideTopContent .guideAuthors') ||
      doc.querySelector('.rightDetailsBlock .creatorsBlock .friendBlockContent');
    const author = cleanText(authorEl ? authorEl.textContent : '')
      .replace(/^(От|By)\s+/i, '')
      .split('\n')[0]
      .trim();

    const previewImg = doc.querySelector('.guidePreviewImage img');
    const coverImage = previewImg ? resolveFullImageUrl(getAttr(previewImg, 'src'), '') : '';

    const descriptionNode = doc.querySelector('.guideTopContent .guideTopDescription') ||
      doc.querySelector('.guideTopDescription');

    const sectionNodes = Array.from(doc.querySelectorAll('.guide.subSections .subSection'));
    const sections = sectionNodes.map((sec, idx) => {
      const secTitleEl = sec.querySelector('.subSectionTitle');
      const secDescEl = sec.querySelector('.subSectionDesc');
      const secTitle = cleanText(secTitleEl ? secTitleEl.textContent : `Section ${idx + 1}`);
      return {
        id: getAttr(sec, 'id') || `section-${idx + 1}`,
        title: secTitle,
        descNode: secDescEl || null,
      };
    });

    return {
      title,
      game,
      author,
      url: pageUrl || (doc.location && doc.location.href) || '',
      coverImage,
      descriptionNode,
      sections,
      lang: detectLang(doc),
    };
  }

  function serializeChildren(node, ctx) {
    if (!node || !node.childNodes) return '';
    let out = '';
    for (const child of Array.from(node.childNodes)) {
      out += serializeNode(child, ctx);
    }
    return out;
  }

  function convertTableToMarkdown(tableEl, ctx) {
    const rows = [];
    const directChildren = Array.from(tableEl.childNodes || []).filter((n) => n.nodeType === 1);

    let orphanRow = [];
    const flushOrphans = () => {
      if (orphanRow.length > 0) {
        rows.push(orphanRow);
        orphanRow = [];
      }
    };

    const extractCellText = (cell) => {
      const innerCtx = Object.assign({}, ctx, { inTableCell: true });
      const raw = serializeChildren(cell, innerCtx)
        .replace(/\n+/g, '<br>')
        .replace(/^(<br>)+|(<br>)+$/g, '')
        .replace(/\|/g, '\\|')
        .trim();
      return raw || ' ';
    };

    for (const child of directChildren) {
      const tag = getTag(child);
      if (hasClass(child, 'bb_table_tr') || tag === 'tr') {
        flushOrphans();
        const cells = Array.from(child.childNodes || []).filter(
          (n) =>
            n.nodeType === 1 &&
            (hasClass(n, 'bb_table_th') ||
              hasClass(n, 'bb_table_td') ||
              getTag(n) === 'th' ||
              getTag(n) === 'td')
        );
        if (cells.length > 0) {
          rows.push(cells.map(extractCellText));
        }
      } else if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') {
        flushOrphans();
        for (const tr of Array.from(child.childNodes || []).filter((n) => n.nodeType === 1 && getTag(n) === 'tr')) {
          const cells = Array.from(tr.childNodes || []).filter(
            (n) => n.nodeType === 1 && (getTag(n) === 'th' || getTag(n) === 'td')
          );
          if (cells.length > 0) rows.push(cells.map(extractCellText));
        }
      } else if (hasClass(child, 'bb_table_th') || hasClass(child, 'bb_table_td')) {
        orphanRow.push(extractCellText(child));
      }
    }
    flushOrphans();

    if (rows.length === 0) return '';

    const colCount = Math.max(...rows.map((r) => r.length));
    const normalized = rows.map((r) => {
      const copy = r.slice();
      while (copy.length < colCount) copy.push(' ');
      return copy;
    });

    const header = `| ${normalized[0].join(' | ')} |`;
    const divider = `| ${Array(colCount).fill('---').join(' | ')} |`;
    const body = normalized.slice(1).map((r) => `| ${r.join(' | ')} |`);

    return `\n\n${[header, divider, ...body].join('\n')}\n\n`;
  }

  function convertListToMarkdown(listEl, ordered, ctx) {
    const depth = ctx.listDepth || 0;
    const indent = '  '.repeat(depth);
    const items = Array.from(listEl.childNodes || []).filter(
      (n) => n.nodeType === 1 && getTag(n) === 'li'
    );
    if (items.length === 0) return '';

    const lines = items.map((li, idx) => {
      const marker = ordered ? `${idx + 1}. ` : '- ';
      const inner = serializeChildren(li, Object.assign({}, ctx, { listDepth: depth + 1 }))
        .replace(/^\n+|\n+$/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map((line, lineIdx) => (lineIdx === 0 ? line.trim() : `${indent}  ${line}`))
        .join('\n');
      return `${indent}${marker}${inner}`;
    });

    const prefix = depth === 0 ? '\n\n' : '\n';
    const suffix = depth === 0 ? '\n\n' : '';
    return `${prefix}${lines.join('\n')}${suffix}`;
  }

  function serializeNode(node, ctx) {
    if (!node) return '';

    // Text node
    if (node.nodeType === 3) {
      let text = String(node.nodeValue || '').replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
      if (ctx.inPre) return text;
      // Strip Steam's HTML indentation tabs at line starts while preserving intentional newlines
      text = text.replace(/\n[ \t]+/g, '\n').replace(/[ \t]+\n/g, '\n');
      text = text.replace(/^\t+/, '');
      return text;
    }

    // Ignore non-element nodes (comments, etc.)
    if (node.nodeType !== 1) return '';

    const tag = getTag(node);
    if (tag === 'script' || tag === 'style' || tag === 'noscript' || isClearDiv(node)) {
      return '';
    }

    if (tag === 'br') {
      return ctx.inTableCell ? '<br>' : '\n';
    }

    if (tag === 'hr' || hasClass(node, 'bb_hr')) {
      return '\n\n---\n\n';
    }

    // Images
    if (tag === 'img') {
      if (!ctx.includeImages) return '';
      const fullUrl = resolveFullImageUrl(getAttr(node, 'src'), ctx.parentAnchorHref || '');
      if (!fullUrl) return '';
      const alt = cleanText(getAttr(node, 'alt') || getAttr(node, 'title') || 'image').replace(/[\[\]]/g, '');
      return ctx.inTableCell ? `![${alt}](${fullUrl})` : `\n\n![${alt}](${fullUrl})\n\n`;
    }

    // Anchors (including Steam modal image wrappers)
    if (tag === 'a') {
      const rawHref = getAttr(node, 'href');
      const unwrappedHref = unwrapSteamLink(rawHref);
      const childElements = Array.from(node.childNodes || []).filter((n) => n.nodeType === 1);
      const wrapsOnlyImage =
        (hasClass(node, 'modalContentLink') || childElements.some((c) => getTag(c) === 'img')) &&
        cleanText(node.textContent || '') === '';

      if (wrapsOnlyImage) {
        if (!ctx.includeImages) return '';
        const img = childElements.find((c) => getTag(c) === 'img');
        const imgSrc = img ? getAttr(img, 'src') : '';
        const fullUrl = resolveFullImageUrl(imgSrc, rawHref);
        if (!fullUrl) return '';
        const alt = cleanText((img && (getAttr(img, 'alt') || getAttr(img, 'title'))) || 'image').replace(/[\[\]]/g, '');
        return ctx.inTableCell ? `![${alt}](${fullUrl})` : `\n\n![${alt}](${fullUrl})\n\n`;
      }

      const inner = serializeChildren(node, Object.assign({}, ctx, { parentAnchorHref: rawHref })).trim();
      if (!inner) return '';
      if (!unwrappedHref) return inner;
      if (inner === unwrappedHref) return `<${unwrappedHref}>`;
      return `[${inner}](${unwrappedHref})`;
    }

    // Steam BBCode Headings & standard headings
    if (hasClass(node, 'bb_h1') || tag === 'h1') {
      const text = serializeChildren(node, ctx).trim();
      if (!text) return '';
      return ctx.inTableCell ? `**${text}**` : `\n\n### ${text}\n\n`;
    }
    if (hasClass(node, 'bb_h2') || tag === 'h2') {
      const text = serializeChildren(node, ctx).trim();
      if (!text) return '';
      return ctx.inTableCell ? `**${text}**` : `\n\n#### ${text}\n\n`;
    }
    if (hasClass(node, 'bb_h3') || tag === 'h3' || tag === 'h4') {
      const text = serializeChildren(node, ctx).trim();
      if (!text) return '';
      return ctx.inTableCell ? `**${text}**` : `\n\n##### ${text}\n\n`;
    }

    // Inline formatting
    if (tag === 'b' || tag === 'strong') {
      const inner = serializeChildren(node, ctx).trim();
      return inner ? `**${inner}**` : '';
    }
    if (tag === 'i' || tag === 'em') {
      const inner = serializeChildren(node, ctx).trim();
      return inner ? `*${inner}*` : '';
    }
    if (tag === 's' || tag === 'strike' || tag === 'del' || hasClass(node, 'bb_strike')) {
      const inner = serializeChildren(node, ctx).trim();
      return inner ? `~~${inner}~~` : '';
    }
    if (tag === 'u') {
      const inner = serializeChildren(node, ctx).trim();
      return inner ? `<u>${inner}</u>` : '';
    }

    // Spoilers
    if (hasClass(node, 'bb_spoiler')) {
      const inner = serializeChildren(node, ctx).trim();
      if (!inner) return '';
      return `||${inner}||`;
    }

    // Code blocks & inline code
    if (hasClass(node, 'bb_code') || tag === 'pre') {
      const codeText = String(node.textContent || '').replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
      if (!codeText) return '';
      return `\n\n\`\`\`\n${codeText}\n\`\`\`\n\n`;
    }
    if (tag === 'code') {
      const codeText = String(node.textContent || '').trim();
      return codeText ? `\`${codeText}\`` : '';
    }

    // Blockquotes
    if (hasClass(node, 'bb_blockquote') || tag === 'blockquote') {
      const inner = serializeChildren(node, ctx).trim();
      if (!inner) return '';
      const quoted = inner
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
      return `\n\n${quoted}\n\n`;
    }

    // Lists
    if (tag === 'ul' || hasClass(node, 'bb_ul')) {
      return convertListToMarkdown(node, false, ctx);
    }
    if (tag === 'ol' || hasClass(node, 'bb_ol')) {
      return convertListToMarkdown(node, true, ctx);
    }

    // Tables
    if (hasClass(node, 'bb_table') || tag === 'table') {
      return convertTableToMarkdown(node, ctx);
    }

    // YouTube / Video embeds
    if (tag === 'iframe') {
      const safeSrc = sanitizeUrl(getAttr(node, 'src'));
      if (safeSrc) return `\n\n[Video](${safeSrc})\n\n`;
      return '';
    }

    // Generic block containers
    if (tag === 'p' || tag === 'div' || tag === 'section') {
      const inner = serializeChildren(node, ctx).trim();
      if (!inner) return '';
      return ctx.inTableCell ? inner : `\n\n${inner}\n\n`;
    }

    return serializeChildren(node, ctx);
  }

  function nodeToMarkdown(node, options) {
    if (!node) return '';
    const ctx = {
      includeImages: Boolean(options && options.includeImages),
      inPre: false,
      inTableCell: false,
      listDepth: 0,
      parentAnchorHref: '',
    };
    const raw = serializeChildren(node, ctx);
    return raw
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function buildMarkdown(guideData, options) {
    const includeImages = Boolean(options && options.includeImages);
    const s = STRINGS[guideData.lang] || STRINGS.en;
    const lines = [];

    lines.push(`# ${guideData.title}`);
    lines.push('');

    const meta = [];
    if (guideData.game) meta.push(`- **${s.metaGame}:** ${guideData.game}`);
    if (guideData.author) meta.push(`- **${s.metaAuthor}:** ${guideData.author}`);
    if (guideData.url) meta.push(`- **${s.metaSource}:** ${guideData.url}`);
    meta.push(`- **${s.metaExported}:** ${new Date().toISOString().slice(0, 10)}`);
    lines.push(meta.join('\n'));
    lines.push('');

    if (includeImages && guideData.coverImage) {
      lines.push(`![${guideData.title}](${guideData.coverImage})`);
      lines.push('');
    }

    const introMd = nodeToMarkdown(guideData.descriptionNode, { includeImages });
    if (introMd) {
      lines.push(`## ${s.descriptionTitle}`);
      lines.push('');
      lines.push(introMd);
      lines.push('');
    }

    if (guideData.sections.length >= 2) {
      lines.push(`## ${s.tocTitle}`);
      lines.push('');
      for (const sec of guideData.sections) {
        lines.push(`- [${sec.title}](#${slugify(sec.title)})`);
      }
      lines.push('');
    }

    for (const sec of guideData.sections) {
      lines.push('---');
      lines.push('');
      lines.push(`## ${sec.title}`);
      lines.push('');
      const bodyMd = nodeToMarkdown(sec.descNode, { includeImages });
      if (bodyMd) {
        lines.push(bodyMd);
        lines.push('');
      }
    }

    return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
  }

  function collectImageUrls(guideData) {
    const urls = new Set();
    if (guideData.coverImage) urls.add(guideData.coverImage);

    const scanNode = (node) => {
      if (!node || !node.querySelectorAll) return;
      for (const img of Array.from(node.querySelectorAll('img'))) {
        const parent = img.parentNode;
        const anchorHref = parent && getTag(parent) === 'a' ? getAttr(parent, 'href') : '';
        const resolved = resolveFullImageUrl(getAttr(img, 'src'), anchorHref);
        if (resolved) urls.add(resolved);
      }
    };

    scanNode(guideData.descriptionNode);
    for (const sec of guideData.sections) {
      scanNode(sec.descNode);
    }
    return Array.from(urls);
  }

  function cloneAndTransformHtml(node, options) {
    if (!node) return '';
    const includeImages = Boolean(options && options.includeImages);
    const imageDataMap = (options && options.imageDataMap) || {};

    const renderNode = (el) => {
      if (!el) return '';
      if (el.nodeType === 3) {
        return escapeHtml(el.nodeValue || '');
      }
      if (el.nodeType !== 1) return '';

      const tag = getTag(el);
      if (tag === 'script' || tag === 'style' || tag === 'noscript' || isClearDiv(el)) {
        return '';
      }

      if (tag === 'img') {
        if (!includeImages) return '';
        const parent = el.parentNode;
        const anchorHref = parent && getTag(parent) === 'a' ? getAttr(parent, 'href') : '';
        const fullUrl = resolveFullImageUrl(getAttr(el, 'src'), anchorHref);
        if (!fullUrl) return '';
        const finalSrc = imageDataMap[fullUrl] || fullUrl;
        const alt = escapeHtml(getAttr(el, 'alt') || getAttr(el, 'title') || '');
        return `<figure class="sge-img-wrap"><img src="${escapeHtml(finalSrc)}" alt="${alt}" loading="lazy"></figure>`;
      }

      if (tag === 'a') {
        const rawHref = getAttr(el, 'href');
        const childElements = Array.from(el.childNodes || []).filter((n) => n.nodeType === 1);
        const wrapsOnlyImage =
          (hasClass(el, 'modalContentLink') || childElements.some((c) => getTag(c) === 'img')) &&
          cleanText(el.textContent || '') === '';

        if (wrapsOnlyImage) {
          if (!includeImages) return '';
          const img = childElements.find((c) => getTag(c) === 'img');
          const fullUrl = resolveFullImageUrl(img ? getAttr(img, 'src') : '', rawHref);
          if (!fullUrl) return '';
          const finalSrc = imageDataMap[fullUrl] || fullUrl;
          const alt = escapeHtml((img && (getAttr(img, 'alt') || getAttr(img, 'title'))) || '');
          return `<figure class="sge-img-wrap"><img src="${escapeHtml(finalSrc)}" alt="${alt}" loading="lazy"></figure>`;
        }

        const safeHref = unwrapSteamLink(rawHref);
        const inner = Array.from(el.childNodes || []).map(renderNode).join('');
        if (!safeHref) return inner;
        return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
      }

      if (tag === 'iframe') {
        const safeSrc = sanitizeUrl(getAttr(el, 'src'));
        if (!safeSrc) return '';
        return `<p><a href="${escapeHtml(safeSrc)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safeSrc)}</a></p>`;
      }

      if (tag === 'br') return '<br>';
      if (tag === 'hr' || hasClass(el, 'bb_hr')) return '<hr>';

      const inner = Array.from(el.childNodes || []).map(renderNode).join('');
      const cls = getAttr(el, 'class');
      const classAttr = cls ? ` class="${escapeHtml(cls)}"` : '';
      const allowedTags = new Set([
        'div', 'p', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del',
        'ul', 'ol', 'li', 'pre', 'code', 'blockquote', 'h1', 'h2', 'h3', 'h4',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ]);
      const safeTag = allowedTags.has(tag) ? tag : 'div';
      return `<${safeTag}${classAttr}>${inner}</${safeTag}>`;
    };

    return Array.from(node.childNodes || []).map(renderNode).join('');
  }

  function buildHtml(guideData, options) {
    const includeImages = Boolean(options && options.includeImages);
    const imageDataMap = (options && options.imageDataMap) || {};
    const s = STRINGS[guideData.lang] || STRINGS.en;

    const coverSrc = includeImages && guideData.coverImage
      ? (imageDataMap[guideData.coverImage] || guideData.coverImage)
      : '';
    const coverHtml = coverSrc
      ? `<div class="cover"><img src="${escapeHtml(coverSrc)}" alt="${escapeHtml(guideData.title)}"></div>`
      : '';

    const introHtml = cloneAndTransformHtml(guideData.descriptionNode, { includeImages, imageDataMap });

    const tocHtml = guideData.sections.length >= 2
      ? `<nav class="toc"><h2>${escapeHtml(s.tocTitle)}</h2><ul>${guideData.sections
          .map((sec) => `<li><a href="#${escapeHtml(sec.id)}">${escapeHtml(sec.title)}</a></li>`)
          .join('')}</ul></nav>`
      : '';

    const sectionsHtml = guideData.sections
      .map((sec) => {
        const body = cloneAndTransformHtml(sec.descNode, { includeImages, imageDataMap });
        return `<section class="guide-section" id="${escapeHtml(sec.id)}"><h2>${escapeHtml(sec.title)}</h2><div class="section-body">${body}</div></section>`;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="${escapeHtml(guideData.lang || 'en')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(guideData.title)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 32px 16px; background: #1b2838; color: #c7d5e0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; }
  main { max-width: 920px; margin: 0 auto; background: #16202d; border: 1px solid #2a475e; border-radius: 6px; padding: 28px 32px; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
  h1 { margin: 0 0 12px; color: #ffffff; font-size: 28px; }
  h2 { color: #66c0f4; border-bottom: 1px solid #2a475e; padding-bottom: 6px; margin-top: 28px; }
  .meta { font-size: 14px; color: #8f98a0; margin-bottom: 18px; }
  .meta a { color: #66c0f4; }
  .cover img, .sge-img-wrap img { max-width: 100%; height: auto; border-radius: 4px; border: 1px solid #2a475e; display: block; margin: 12px 0; }
  .sge-img-wrap { margin: 12px 0; }
  .toc { background: #101822; border: 1px solid #2a475e; border-radius: 4px; padding: 14px 18px; margin: 20px 0; }
  .toc h2 { margin-top: 0; font-size: 18px; border: 0; }
  .toc ul { margin: 0; padding-left: 20px; }
  .toc a { color: #66c0f4; text-decoration: none; }
  .toc a:hover { text-decoration: underline; }
  .section-body { white-space: pre-wrap; word-wrap: break-word; }
  .section-body ul, .section-body ol { white-space: normal; padding-left: 24px; }
  .bb_h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin: 16px 0 8px; }
  .bb_h2 { font-size: 17px; font-weight: 700; color: #66c0f4; margin: 14px 0 6px; }
  .bb_h3 { font-size: 15px; font-weight: 700; color: #c7d5e0; margin: 12px 0 4px; }
  .bb_blockquote, blockquote { border-left: 3px solid #66c0f4; background: #101822; margin: 12px 0; padding: 10px 14px; }
  .bb_code, pre { background: #0e141c; border: 1px solid #2a475e; border-radius: 4px; padding: 12px; overflow-x: auto; font-family: Consolas, monospace; white-space: pre; }
  .bb_table { display: table; width: 100%; border-collapse: collapse; margin: 14px 0; white-space: normal; }
  .bb_table_tr { display: table-row; }
  .bb_table_th, .bb_table_td { display: table-cell; border: 1px solid #2a475e; padding: 8px 10px; vertical-align: top; }
  .bb_table_th { background: #1b2838; font-weight: 600; }
  .bb_spoiler { background: #0e141c; color: transparent; padding: 0 4px; border-radius: 3px; transition: color .15s; cursor: pointer; }
  .bb_spoiler:hover { color: #c7d5e0; }
  a { color: #66c0f4; }
  hr { border: 0; border-top: 1px solid #2a475e; margin: 20px 0; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(guideData.title)}</h1>
  <div class="meta">
    ${guideData.game ? `<div><strong>${escapeHtml(s.metaGame)}:</strong> ${escapeHtml(guideData.game)}</div>` : ''}
    ${guideData.author ? `<div><strong>${escapeHtml(s.metaAuthor)}:</strong> ${escapeHtml(guideData.author)}</div>` : ''}
    ${guideData.url ? `<div><strong>${escapeHtml(s.metaSource)}:</strong> <a href="${escapeHtml(guideData.url)}">${escapeHtml(guideData.url)}</a></div>` : ''}
    <div><strong>${escapeHtml(s.metaExported)}:</strong> ${new Date().toISOString().slice(0, 10)}</div>
  </div>
  ${coverHtml}
  ${introHtml ? `<section class="guide-section"><h2>${escapeHtml(s.descriptionTitle)}</h2><div class="section-body">${introHtml}</div></section>` : ''}
  ${tocHtml}
  ${sectionsHtml}
</main>
</body>
</html>`;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function fetchImageAsDataUrl(url) {
    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          responseType: 'blob',
          timeout: 15000,
          onload: async (resp) => {
            try {
              if (resp.status >= 200 && resp.status < 300 && resp.response) {
                resolve(await blobToDataUrl(resp.response));
                return;
              }
            } catch {
              // Fallback to original URL
            }
            resolve(url);
          },
          onerror: () => resolve(url),
          ontimeout: () => resolve(url),
        });
        return;
      }

      if (typeof fetch === 'function') {
        fetch(url)
          .then((r) => (r.ok ? r.blob() : null))
          .then((blob) => (blob ? blobToDataUrl(blob) : url))
          .then(resolve)
          .catch(() => resolve(url));
        return;
      }

      resolve(url);
    });
  }

  async function fetchAllImagesAsDataUrls(urls, onProgress) {
    const map = {};
    let done = 0;
    const total = urls.length;
    const concurrency = 4;
    let index = 0;

    async function worker() {
      while (index < total) {
        const current = index++;
        const url = urls[current];
        map[url] = await fetchImageAsDataUrl(url);
        done += 1;
        if (typeof onProgress === 'function') onProgress(done, total);
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
    return map;
  }

  function triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function injectStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .sge-control-ctn { position: relative; display: inline-block; }
      #${BUTTON_ID} {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        user-select: none;
        cursor: pointer;
      }
      #${BUTTON_ID} svg { width: 14px; height: 14px; fill: currentColor; flex-shrink: 0; }
      #${MENU_ID} {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        min-width: 265px;
        background: #171d25;
        border: 1px solid #3d4450;
        border-radius: 3px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
        z-index: 99999;
        padding: 6px 0;
        color: #dcdedf;
        font-family: "Motiva Sans", Arial, Helvetica, sans-serif;
        font-size: 13px;
      }
      #${MENU_ID}.sge-open { display: block; }
      .sge-menu-header {
        padding: 5px 12px 3px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #8f98a0;
      }
      .sge-menu-divider {
        height: 1px;
        background: #2a475e;
        margin: 6px 0;
      }
      .sge-menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        box-sizing: border-box;
        background: transparent;
        border: 0;
        color: #c7d5e0;
        text-align: left;
        padding: 8px 12px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.12s, color 0.12s;
      }
      .sge-menu-item:hover {
        background: #2a475e;
        color: #ffffff;
      }
      .sge-menu-item:disabled {
        opacity: 0.5;
        cursor: wait;
      }
      .sge-status-toast {
        padding: 6px 12px;
        font-size: 12px;
        color: #a4d007;
        border-top: 1px solid #2a475e;
        margin-top: 4px;
        display: none;
      }
      .sge-status-toast.sge-visible { display: block; }
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  function mountUi(doc) {
    if (!isGuidePage(doc)) return false;
    if (doc.getElementById(BUTTON_ID)) return true;

    const controls =
      doc.querySelector('#ItemControls') ||
      doc.querySelector('.workshopItemControls');
    if (!controls) return false;

    injectStyles(doc);
    const s = getStrings(doc);

    const wrapper = doc.createElement('div');
    wrapper.className = 'workshopItemControlCtn sge-control-ctn';

    const btn = doc.createElement('span');
    btn.id = BUTTON_ID;
    btn.className = 'general_btn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.title = s.exportTitle;
    btn.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1a.75.75 0 0 1 .75.75v7.19l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0L3.72 7.53a.75.75 0 0 1 1.06-1.06l2.47 2.47V1.75A.75.75 0 0 1 8 1zM2.5 13.25a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75z"/></svg>' +
      `<span>${escapeHtml(s.exportBtn)} ▾</span>`;

    const menu = doc.createElement('div');
    menu.id = MENU_ID;
    menu.setAttribute('role', 'menu');

    const statusToast = doc.createElement('div');
    statusToast.className = 'sge-status-toast';

    const showStatus = (text, autoHideMs) => {
      statusToast.textContent = text;
      statusToast.classList.add('sge-visible');
      if (autoHideMs) {
        setTimeout(() => statusToast.classList.remove('sge-visible'), autoHideMs);
      }
    };

    const setBusy = (busy) => {
      for (const item of Array.from(menu.querySelectorAll('.sge-menu-item'))) {
        item.disabled = busy;
      }
    };

    const addHeader = (label) => {
      const h = doc.createElement('div');
      h.className = 'sge-menu-header';
      h.textContent = label;
      menu.appendChild(h);
    };

    const addDivider = () => {
      const d = doc.createElement('div');
      d.className = 'sge-menu-divider';
      menu.appendChild(d);
    };

    const addItem = (label, action) => {
      const item = doc.createElement('button');
      item.type = 'button';
      item.className = 'sge-menu-item';
      item.setAttribute('role', 'menuitem');
      item.textContent = label;
      item.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try {
          setBusy(true);
          await action();
        } catch (err) {
          console.error('[Steam Guide Exporter]', err);
          showStatus(s.error, 3000);
        } finally {
          setBusy(false);
        }
      });
      menu.appendChild(item);
    };

    const runMarkdownDownload = (includeImages) => {
      const data = extractGuideData(doc, doc.location ? doc.location.href : '');
      const md = buildMarkdown(data, { includeImages });
      const filename = sanitizeFilename(data.title, includeImages, 'md');
      triggerDownload(md, filename, 'text/markdown;charset=utf-8');
      showStatus(s.exported, 2500);
    };

    const runHtmlDownload = async (includeImages) => {
      const data = extractGuideData(doc, doc.location ? doc.location.href : '');
      let imageDataMap = {};
      if (includeImages) {
        const urls = collectImageUrls(data);
        if (urls.length > 0) {
          showStatus(`${s.loadingImages} (0/${urls.length})...`, 0);
          imageDataMap = await fetchAllImagesAsDataUrls(urls, (done, total) => {
            showStatus(`${s.loadingImages} (${done}/${total})...`, 0);
          });
        }
      }
      const html = buildHtml(data, { includeImages, imageDataMap });
      const filename = sanitizeFilename(data.title, includeImages, 'html');
      triggerDownload(html, filename, 'text/html;charset=utf-8');
      showStatus(s.exported, 2500);
    };

    const runCopyMarkdown = async (includeImages) => {
      const data = extractGuideData(doc, doc.location ? doc.location.href : '');
      const md = buildMarkdown(data, { includeImages });
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(md);
      } else {
        const ta = doc.createElement('textarea');
        ta.value = md;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        doc.body.appendChild(ta);
        ta.select();
        doc.execCommand('copy');
        doc.body.removeChild(ta);
      }
      showStatus(s.copied, 2500);
    };

    addHeader(s.sectionMarkdown);
    addItem(s.mdWithImages, () => runMarkdownDownload(true));
    addItem(s.mdWithoutImages, () => runMarkdownDownload(false));
    addDivider();
    addHeader(s.sectionHtml);
    addItem(s.htmlWithImages, () => runHtmlDownload(true));
    addItem(s.htmlWithoutImages, () => runHtmlDownload(false));
    addDivider();
    addHeader(s.sectionClipboard);
    addItem(s.copyWithImages, () => runCopyMarkdown(true));
    addItem(s.copyWithoutImages, () => runCopyMarkdown(false));
    menu.appendChild(statusToast);

    const positionMenu = () => {
      if (typeof btn.getBoundingClientRect !== 'function') return;
      const rect = btn.getBoundingClientRect();
      const menuWidth = menu.offsetWidth || 265;
      const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
      const left = Math.max(8, Math.min(rect.left, vw - menuWidth - 8));
      const top = Math.max(8, rect.bottom + 4);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    };

    const toggleMenu = (forceOpen) => {
      const open = typeof forceOpen === 'boolean' ? forceOpen : !menu.classList.contains('sge-open');
      menu.classList.toggle('sge-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) positionMenu();
    };

    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleMenu();
    });
    btn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggleMenu();
      }
    });

    doc.addEventListener('click', (ev) => {
      if (!wrapper.contains(ev.target) && !menu.contains(ev.target)) toggleMenu(false);
    });
    doc.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') toggleMenu(false);
    });
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('scroll', () => {
        if (menu.classList.contains('sge-open')) positionMenu();
      }, { passive: true });
      window.addEventListener('resize', () => {
        if (menu.classList.contains('sge-open')) positionMenu();
      }, { passive: true });
    }

    wrapper.appendChild(btn);
    controls.appendChild(wrapper);
    (doc.body || doc.documentElement).appendChild(menu);
    return true;
  }

  const exportedApi = {
    detectLang,
    sanitizeUrl,
    unwrapSteamLink,
    resolveFullImageUrl,
    slugify,
    sanitizeFilename,
    isGuidePage,
    extractGuideData,
    nodeToMarkdown,
    buildMarkdown,
    collectImageUrls,
    buildHtml,
    mountUi,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportedApi;
  } else if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => mountUi(document));
    } else {
      mountUi(document);
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
