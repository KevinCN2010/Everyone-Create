/**
 * mindustry-mods/plugin.js — Mindustry 模组商店（重构版）
 * 后端缓存代理 + 分页加载 + 固定尺寸卡片 + 详情弹窗
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════
     配置
     ═══════════════════════════════════════════════════ */
  var API_URL = '/api/mods/page';
  var PAGE_SIZE = 20;

  /* ═══════════════════════════════════════════════════
     状态
     ═══════════════════════════════════════════════════ */
  var container = null;
  var currentPage = 1;
  var currentSort = 'default';
  var currentSearch = '';
  var currentAuthor = '';
  var currentLang = '';
  var totalMods = 0;
  var totalPages = 0;
  var isLoading = false;

  /* ═══════════════════════════════════════════════════
     工具函数
     ═══════════════════════════════════════════════════ */

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var MINDUSTRY_COLORS = {
    'white': '#ffffff', 'lightgray': '#c0c0c0', 'gray': '#808080',
    'darkgray': '#404040', 'black': '#000000', 'red': '#ff0000',
    'orange': '#ff8c42', 'yellow': '#ffff00', 'green': '#00ff00',
    'lime': '#00ff00', 'cyan': '#00ffff', 'blue': '#0000ff',
    'navy': '#000080', 'purple': '#800080', 'violet': '#ee82ee',
    'pink': '#ff69b4', 'brown': '#8b4513', 'coral': '#ff7f50',
    'gold': '#ffd700', 'silver': '#c0c0c0', 'teal': '#008080',
    'olive': '#808000', 'maroon': '#800000', 'salmon': '#fa8072',
    'accent': '#ffd37e', 'error': '#ff4444',
  };

  function renderMindustryColors(text) {
    if (!text || text.indexOf('[') === -1) return escHtml(text);
    var out = '', i = 0, depth = 0;
    while (i < text.length) {
      var ch = text[i];
      if (ch === '[' && i + 1 < text.length) {
        if (text[i + 1] === '[') {
          out += '&#91;'; i += 2; continue;
        }
        if (text[i + 1] === ']') {
          while (depth > 0) { out += '</span>'; depth--; }
          i += 2; continue;
        }
        var end = text.indexOf(']', i + 1);
        if (end !== -1 && end - i <= 10) {
          var tag = text.substring(i + 1, end);
          var color = null;
          if (tag.charAt(0) === '#') {
            if (/^#[0-9a-fA-F]{3,8}$/.test(tag)) color = tag;
          } else {
            color = MINDUSTRY_COLORS[tag.toLowerCase()];
          }
          if (color) {
            out += '<span style="color:' + color + ';">';
            depth++; i = end + 1; continue;
          }
        }
      }
      if (ch === '&') out += '&amp;';
      else if (ch === '<') out += '&lt;';
      else if (ch === '>') out += '&gt;';
      else if (ch === '"') out += '&quot;';
      else out += ch;
      i++;
    }
    while (depth > 0) { out += '</span>'; depth--; }
    return out;
  }

  function getLang() {
    var langEl = document.querySelector('html') ? document.querySelector('html').getAttribute('lang') : 'zh';
    return langEl || 'zh';
  }

  function t(str) {
    var map = {
      'mods-title': { zh: 'Mindustry \u6a21\u7ec4\u5546\u5e97', en: 'Mindustry Mod Store', 'zh-Hant': 'Mindustry \u6a21\u7d44\u5546\u5e97' },
      'mods-loading': { zh: '\u6b63\u5728\u52a0\u8f7d\u6a21\u7ec4\u5217\u8868...', en: 'Loading mod list...', 'zh-Hant': '\u6b63\u5728\u8f09\u5165\u6a21\u7d44\u5217\u8868...' },
      'mods-load-failed': { zh: '\u65e0\u6cd5\u52a0\u8f7d\u6a21\u7ec4\u6570\u636e', en: 'Failed to load mod data', 'zh-Hant': '\u7121\u6cd5\u8f09\u5165\u6a21\u7d44\u6578\u64da' },
      'mods-retry': { zh: '\u91cd\u8bd5', en: 'Retry', 'zh-Hant': '\u91cd\u8a66' },
      'mods-search-placeholder': { zh: '\u641c\u7d22\u6a21\u7ec4\u540d\u79f0\u3001\u4f5c\u8005\u6216\u63cf\u8ff0...', en: 'Search by name, author or description...', 'zh-Hant': '\u641c\u7d22\u6a21\u7d44\u540d\u7a31\u3001\u4f5c\u8005\u6216\u63cf\u8ff0...' },
      'mods-sort-default': { zh: '\u9ed8\u8ba4\u6392\u5e8f', en: 'Default', 'zh-Hant': '\u9ed8\u8a8d\u6392\u5e8f' },
      'mods-sort-stars': { zh: 'Star \u6570\u91cf', en: 'Stars', 'zh-Hant': 'Star \u6578\u91cf' },
      'mods-sort-popular': { zh: '\u4eba\u6c14\u6392\u5e8f', en: 'Popular', 'zh-Hant': '\u4eba\u6c23\u6392\u5e8f' },
      'mods-author': { zh: '\u4f5c\u8005', en: 'By', 'zh-Hant': '\u4f5c\u8005' },
      'mods-version': { zh: '\u6e38\u620f\u7248\u672c', en: 'Game Ver', 'zh-Hant': '\u904a\u6232\u7248\u672c' },
      'mods-updated': { zh: '\u66f4\u65b0', en: 'Updated', 'zh-Hant': '\u66f4\u65b0' },
      'mods-no-results': { zh: '\u6ca1\u6709\u627e\u5230\u5339\u914d\u7684\u6a21\u7ec4', en: 'No matching mods found', 'zh-Hant': '\u6c92\u6709\u627e\u5230\u5339\u914d\u7684\u6a21\u7d44' },
      'mods-page': { zh: '\u7b2c {n} \u9875\uff0c\u5171 {t} \u9875', en: 'Page {n} of {t}', 'zh-Hant': '\u7b2c {n} \u9801\uff0c\u5171 {t} \u9801' },
      'mods-total': { zh: '\u5171 {n} \u4e2a\u6a21\u7ec4', en: '{n} mods total', 'zh-Hant': '\u5171 {n} \u500b\u6a21\u7d44' },
      'mods-cache-stale': { zh: '\u26a0 \u90e8\u5206\u6a21\u7ec4\u6570\u636e\u53ef\u80fd\u4e0d\u662f\u6700\u65b0\u7684\uff08\u7f13\u5b58\u8d85\u8fc71\u5c0f\u65f6\uff09', en: '\u26a0 Some mod data may be outdated (cached >1h)', 'zh-Hant': '\u26a0 \u90e8\u5206\u6a21\u7d44\u6578\u64da\u53ef\u80fd\u4e0d\u662f\u6700\u65b0\u7684\uff08\u7f13\u5b58\u8d85\u904e1\u5c0f\u6642\uff09' },
      'mods-detail': { zh: '\u8be6\u60c5', en: 'Details', 'zh-Hant': '\u8a73\u60c5' },
      'mods-stars-label': { zh: 'Star', en: 'Stars', 'zh-Hant': 'Star' },
      'mods-forks-label': { zh: 'Fork', en: 'Forks', 'zh-Hant': 'Fork' },
      'mods-close': { zh: '\u5173\u95ed', en: 'Close', 'zh-Hant': '\u95dc\u9589' },
      'mods-repo-link': { zh: '\u67e5\u770b\u4ed3\u5e93', en: 'View Repo', 'zh-Hant': '\u67e5\u770b\u5009\u5eab' },
      'mods-owner': { zh: '\u4ed3\u5e93\u6240\u6709\u8005', en: 'Owner', 'zh-Hant': '\u5009\u5eab\u6240\u6709\u8005' },
      'mods-internal': { zh: '\u5185\u90e8\u540d\u79f0', en: 'Internal Name', 'zh-Hant': '\u5167\u90e8\u540d\u7a31' },
      'mods-version-label': { zh: '\u7248\u672c\u53f7', en: 'Version', 'zh-Hant': '\u7248\u672c\u865f' },
    };
    var lang = getLang();
    var entry = map[str];
    if (!entry) return str;
    return entry[lang] || entry.en || entry.zh || str;
  }

  function renderTemplate(tpl, data) {
    return tpl.replace(/\{(\w+)\}/g, function (_, key) {
      return data[key] !== undefined ? data[key] : '{' + key + '}';
    });
  }

  /* ── 文本截断工具函数 ── */
  function truncateText(text, maxLen) {
    if (!text) return '';
    var s = String(text);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + '\u2026'; // …
  }

  /* ── 文本溢出SVG标识 ── */
  function textOverflowSvg() {
    return '<svg class="mods-overflow-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  }

  /* ── 检查单行文本是否溢出，追加SVG标识 ── */
  function checkOverflow(text, maxLen) {
    if (!text) return '';
    var s = String(text);
    if (s.length <= maxLen) return escHtml(s);
    return escHtml(s.slice(0, maxLen)) + textOverflowSvg();
  }

  /* ── 格式化字节大小 ── */
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    if (i >= units.length) i = units.length - 1;
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  }

  /* ── Canvas 文本像素宽度测量 ── */
  var _measureCtx = null;
  function measureTextWidth(text, fontSize) {
    if (!text) return 0;
    if (!_measureCtx) {
      var c = document.createElement('canvas');
      _measureCtx = c.getContext('2d');
    }
    _measureCtx.font = (fontSize || 13) + 'px system-ui, sans-serif';
    return _measureCtx.measureText(text).width;
  }

  /* ── 去除 Mindustry 颜色标签，返回纯文本 ── */
  function stripColorTags(text) {
    if (!text) return '';
    return text.replace(/\[(?:#[0-9a-fA-F]{3,8}|[a-z]+)\]/gi, '');
  }

  /* ── 智能文本截断：按像素宽度截断，仅超出 maxWidthPx 才截，末尾加 … ── */
  function truncateByWidth(text, maxWidthPx, fontSize) {
    if (!text) return '';
    var plain = stripColorTags(text);
    var w = measureTextWidth(plain, fontSize);
    if (w <= maxWidthPx) return text;          // 不超出 → 不截
    // 超出 → 逐个减字直到 fit
    for (var len = plain.length; len > 0; len--) {
      var sub = plain.slice(0, len) + '\u2026';
      if (measureTextWidth(sub, fontSize) <= maxWidthPx) return sub;
    }
    return '\u2026';
  }

  /* ── 渲染适配容器的颜色文本 → HTML spans ── */
  function renderSmartMindustryColors(text, maxWidthPx, fontSize) {
    var truncated = truncateByWidth(text, maxWidthPx, fontSize);
    return renderMindustryColors(truncated);
  }

  /* ═══════════════════════════════════════════════════
     数据加载（分页）
     ═══════════════════════════════════════════════════ */
  var _lastController = null;

  function fetchPage(page) {
    if (!container || isLoading) return;
    isLoading = true;
    currentPage = page;

    // 骨架屏
    var listEl = document.getElementById('mods-list');
    if (listEl) {
      listEl.innerHTML = renderSkeleton(PAGE_SIZE);
    }

    if (_lastController) _lastController.abort();
    var controller = new AbortController();
    _lastController = controller;
    var timer = setTimeout(function () { controller.abort(); }, 15000);

    var params = '?page=' + page + '&size=' + PAGE_SIZE
      + '&sort=' + encodeURIComponent(currentSort)
      + '&search=' + encodeURIComponent(currentSearch)
      + '&author=' + encodeURIComponent(currentAuthor)
      + '&lang=' + encodeURIComponent(currentLang);

    fetch(API_URL + params, { signal: controller.signal })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        isLoading = false;
        if (data.error) {
          showError(data.error);
          return;
        }
        totalMods = data.total || 0;
        totalPages = data.total_pages || 1;
        renderPage(data.mods || []);
      })
      .catch(function (err) {
        clearTimeout(timer);
        isLoading = false;
        if (err.name === 'AbortError') return;
        showError(t('mods-load-failed') + ': ' + (err.message || ''));
      });
  }

  /* ═══════════════════════════════════════════════════
     骨架屏
     ═══════════════════════════════════════════════════ */
  function renderSkeleton(count) {
    var html = '<div class="mods-grid">';
    for (var i = 0; i < count; i++) {
      html += '<div class="mods-card-skeleton">'
        + '<div class="skeleton-icon"></div>'
        + '<div class="skeleton-body">'
        + '<div class="skeleton-line skeleton-line-title"></div>'
        + '<div class="skeleton-line skeleton-line-desc"></div>'
        + '<div class="skeleton-line skeleton-line-meta"></div>'
        + '</div></div>';
    }
    html += '</div>';
    return html;
  }

  /* ═══════════════════════════════════════════════════
     渲染主入口
     ═══════════════════════════════════════════════════ */
  function renderPage(mods) {
    renderList(mods);
    renderListMobile(mods);
    renderPagination();
  }

  function renderIconUrl(mod) {
    if (mod.icon) return mod.icon;
    if (!mod.hasIcon || !mod.repo) return '';
    // 使用已部署的 /github-raw/ 代理端点（禁止直连GitHub Raw）
    return '/github-raw/' + encodeURIComponent(mod.repo) + '/icon.png?ref=master';
  }

  /* ── 弹窗高清大图（从 Anuken/MindustryMods/icons/ 目录获取） ── */
  function renderIconHdUrl(mod) {
    // /icons 目录命名规则：{author}_{repo_name}，无扩展名
    if (!mod.repo) return '';
    return '/github-raw/Anuken/MindustryMods/icons/' + encodeURIComponent(mod.repo.replace('/', '_')) + '?ref=master';
  }

  /* ═══════════════════════════════════════════════════
     桌面端卡片渲染
     ═══════════════════════════════════════════════════ */
  function renderList(mods) {
    var listEl = document.getElementById('mods-list');
    if (!listEl) return;

    if (!mods || mods.length === 0) {
      listEl.innerHTML = '<div class="mods-empty"><p>' + t('mods-no-results') + '</p></div>';
      return;
    }

    var html = '<div class="mods-grid mods-grid-desktop">';
    for (var i = 0; i < mods.length; i++) {
      html += renderCardDesktop(mods[i], i);
    }
    html += '</div>';
    listEl.innerHTML = html;
  }

  function renderCardDesktop(mod, idx) {
    var repo = mod.repo || '';
    var name = mod.name || repo.split('/').pop() || 'Unknown';
    var desc = mod.description || '';
    var author = (mod.author || repo.split('/')[0] || '').replace(/\n/g, ', ');
    var stars = mod.stars || 0;
    var forks = mod.forks || 0;
    var minVer = mod.minGameVersion || '';
    var iconUrl = renderIconUrl(mod);
    var updated = mod.lastUpdated || mod.updated || '';
    var updatedDisplay = '';
    if (updated) {
      try { updatedDisplay = new Date(updated).toLocaleDateString(); } catch (e) { updatedDisplay = updated; }
    }
    var detailId = 'mod-detail-' + idx;
    var iconHdUrl = renderIconHdUrl(mod);
    var detailData = escHtml(JSON.stringify({
      repo: repo, name: name, author: mod.author || '',
      stars: stars, forks: forks, desc: desc,
      minVer: minVer, version: mod.version || '',
      updated: updated, iconUrl: iconUrl, iconHdUrl: iconHdUrl,
      hasIcon: !!mod.hasIcon, hasScripts: !!mod.hasScripts,
      hasJava: !!mod.hasJava, internalName: mod.internalName || ''
    }));

    // 检查是否使用项目内置info SVG
    var infoIconContainer = '<span class="ico ico-info" style="width:14px;height:14px;"></span>';

    var descPreview = desc ? renderSmartMindustryColors(desc, 230, 13) : '';

    // 版本信息直接展示在卡片可视区域
    var versionHtml = '';
    if (minVer) {
      versionHtml = '<span class="mods-card-minver">' + escHtml(t('mods-version')) + ' ' + escHtml(minVer) + '</span>';
    }

    var card = '<div class="mods-card mods-card-desktop" data-idx="' + idx + '">'
      + '<button class="mods-detail-btn" onclick="window._modsShowDetail(\'' + detailId + '\')" aria-label="' + escHtml(t('mods-detail')) + '" title="' + escHtml(t('mods-detail')) + '">'
      + infoIconContainer
      + '</button>'
      + '<div class="mods-card-header">'
      + '  <div class="mods-card-icon-wrap">'
      + (iconUrl
        ? '<img class="mods-card-icon" src="' + escHtml(iconUrl) + '" alt="" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\';this.parentElement.querySelector(\'.mods-card-icon-fallback\').style.display=\'flex\';">'
          + '<div class="mods-card-icon-fallback" style="display:none;">' + escHtml(name.charAt(0).toUpperCase()) + '</div>'
        : '<div class="mods-card-icon-fallback">' + escHtml(name.charAt(0).toUpperCase()) + '</div>')
      + '  </div>'
      + '  <div class="mods-card-title-wrap">'
      + '    <div class="mods-card-title">' + renderSmartMindustryColors(name, 180, 15) + '</div>'
      + '    <div class="mods-card-author">' + escHtml(t('mods-author')) + ' ' + escHtml(truncateByWidth(author, 180, 12.5)) + '</div>'
      + '  </div>'
      + '</div>'
      + '<div class="mods-card-body">'
      + '  <div class="mods-card-desc">' + descPreview + '</div>'
      + '  <div class="mods-card-meta">'
      + (stars > 0 ? '<span class="mods-card-stars">\u2605 ' + stars + '</span>' : '')
      + versionHtml
      + (updatedDisplay ? '<span class="mods-card-date">' + escHtml(updatedDisplay) + '</span>' : '')
      + '  </div>'
      + '</div>'
      + '<div class="mods-detail-panel" id="' + detailId + '" style="display:none;" data-data="' + detailData + '"></div>'
      + '</div>';

    return card;
  }

  /* ═══════════════════════════════════════════════════
     移动端卡片渲染（独立布局）
     ═══════════════════════════════════════════════════ */
  function renderListMobile(mods) {
    var listEl = document.getElementById('mods-list-mobile');
    if (!listEl) return;

    if (!mods || mods.length === 0) {
      listEl.innerHTML = '<div class="mods-empty"><p>' + t('mods-no-results') + '</p></div>';
      return;
    }

    var html = '<div class="mods-grid mods-grid-mobile">';
    for (var i = 0; i < mods.length; i++) {
      html += renderCardMobile(mods[i], i);
    }
    html += '</div>';
    listEl.innerHTML = html;
  }

  function renderCardMobile(mod, idx) {
    var repo = mod.repo || '';
    var name = mod.name || repo.split('/').pop() || 'Unknown';
    var desc = mod.description || '';
    var author = (mod.author || repo.split('/')[0] || '').replace(/\n/g, ', ');
    var stars = mod.stars || 0;
    var forks = mod.forks || 0;
    var minVer = mod.minGameVersion || '';
    var iconUrl = renderIconUrl(mod);
    var updated = mod.lastUpdated || mod.updated || '';
    var updatedDisplay = '';
    if (updated) {
      try { updatedDisplay = new Date(updated).toLocaleDateString(); } catch (e) { updatedDisplay = updated; }
    }
    var detailId = 'mod-detail-m-' + idx;
    var iconHdUrl = renderIconHdUrl(mod);
    var detailData = escHtml(JSON.stringify({
      repo: repo, name: name, author: mod.author || '',
      stars: stars, forks: forks, desc: desc,
      minVer: minVer, version: mod.version || '',
      updated: updated, iconUrl: iconUrl, iconHdUrl: iconHdUrl,
      hasIcon: !!mod.hasIcon, hasScripts: !!mod.hasScripts,
      hasJava: !!mod.hasJava, internalName: mod.internalName || ''
    }));

    var descPreview = desc ? renderSmartMindustryColors(desc, 280, 12) : '';

    var versionHtml = '';
    if (minVer) {
      versionHtml = '<span class="mods-card-minver">' + escHtml(t('mods-version')) + ' ' + escHtml(minVer) + '</span>';
    }

    return '<div class="mods-card mods-card-mobile" data-idx="' + idx + '">'
      + '<button class="mods-detail-btn" onclick="window._modsShowDetail(\'' + detailId + '\')" aria-label="' + escHtml(t('mods-detail')) + '" title="' + escHtml(t('mods-detail')) + '">'
      + '<span class="ico ico-info" style="width:12px;height:12px;"></span>'
      + '</button>'
      + '<div class="mods-card-header">'
      + '  <div class="mods-card-icon-wrap">'
      + (iconUrl
        ? '<img class="mods-card-icon" src="' + escHtml(iconUrl) + '" alt="" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\';this.parentElement.querySelector(\'.mods-card-icon-fallback\').style.display=\'flex\';">'
          + '<div class="mods-card-icon-fallback" style="display:none;">' + escHtml(name.charAt(0).toUpperCase()) + '</div>'
        : '<div class="mods-card-icon-fallback">' + escHtml(name.charAt(0).toUpperCase()) + '</div>')
      + '  </div>'
      + '  <div class="mods-card-title-wrap">'
      + '    <div class="mods-card-title">' + renderSmartMindustryColors(name, 220, 14) + '</div>'
      + '    <div class="mods-card-author">' + escHtml(t('mods-author')) + ' ' + escHtml(truncateByWidth(author, 220, 11.5)) + '</div>'
      + '  </div>'
      + '</div>'
      + '<div class="mods-card-body">'
      + '  <div class="mods-card-desc">' + descPreview + '</div>'
      + '  <div class="mods-card-meta">'
      + (stars > 0 ? '<span class="mods-card-stars">\u2605 ' + stars + '</span>' : '')
      + versionHtml
      + (updatedDisplay ? '<span class="mods-card-date">' + escHtml(updatedDisplay) + '</span>' : '')
      + '  </div>'
      + '</div>'
      + '<div class="mods-detail-panel" id="' + detailId + '" style="display:none;" data-data="' + detailData + '"></div>'
      + '</div>';
  }

  /* ═══════════════════════════════════════════════════
     详情弹窗
     ═══════════════════════════════════════════════════ */
  function showDetail(panelId) {
    var panel = document.getElementById(panelId);
    if (!panel) return;
    var raw = panel.getAttribute('data-data');
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }

    var overlay = document.getElementById('mods-detail-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'mods-detail-overlay';
      overlay.className = 'mods-detail-overlay';
      overlay.innerHTML = '<div class="mods-detail-modal" onclick="event.stopPropagation()">'
        + '<div class="mods-detail-header">'
        + '<span class="mods-detail-title mods-detail-title-loading">&nbsp;</span>'
        + '<button class="mods-detail-close" onclick="window._modsCloseDetail()">\u2715</button>'
        + '</div>'
        + '<div class="mods-detail-body"></div>'
        + '</div>';
      overlay.addEventListener('click', function () { closeDetail(); });
      document.body.appendChild(overlay);
    }

    var titleEl = overlay.querySelector('.mods-detail-title');
    var bodyEl = overlay.querySelector('.mods-detail-body');

    // 第一步：先展示骨架加载占位（视觉优先，不等API）
    bodyEl.innerHTML = ''
      + '<div class="mods-detail-loading-grid">'
      + '  <div class="mods-detail-shimmer" style="width:80px;height:80px;border-radius:12px;"></div>'
      + '  <div style="flex:1;display:flex;flex-direction:column;gap:8px;">'
      + '    <div class="mods-detail-shimmer" style="width:60%;height:14px;"></div>'
      + '    <div class="mods-detail-shimmer" style="width:40%;height:14px;"></div>'
      + '    <div class="mods-detail-shimmer" style="width:50%;height:14px;"></div>'
      + '  </div>'
      + '</div>'
      + '<div class="mods-detail-shimmer" style="width:100%;height:60px;border-radius:8px;margin-top:12px;"></div>';
    overlay.style.display = 'flex';

    // 第二步：setTimeout(0) 退到下一帧填充真实数据，加载动画可见
    setTimeout(function () {
      titleEl.textContent = data.name || data.repo;
      titleEl.classList.remove('mods-detail-title-loading');

      var githubUrl = data.repo ? 'https://github.com/' + data.repo : '#';

      var bodyHtml = ''
        + '<div class="mods-detail-section">'
        + '  <div class="mods-detail-icon-section">'
        + (data.iconHdUrl
          ? '<img class="mods-detail-icon-full" src="' + escHtml(data.iconHdUrl) + '" alt="" onerror="this.onerror=null;this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
            + '<div class="mods-card-icon-fallback" style="display:none;width:80px;height:80px;font-size:2rem;">' + escHtml((data.name || '?').charAt(0).toUpperCase()) + '</div>'
          : '<div class="mods-card-icon-fallback" style="width:80px;height:80px;font-size:2rem;">' + escHtml((data.name || '?').charAt(0).toUpperCase()) + '</div>')
        + '  </div>'
        + '  <div class="mods-detail-top-row">'
        + '    <div class="mods-detail-meta-grid">'
        + '      <div class="mods-detail-meta-item"><span class="meta-label">' + escHtml(t('mods-owner')) + '</span><span class="meta-value">' + escHtml((data.repo || '').split('/')[0] || '-') + '</span></div>'
        + '      <div class="mods-detail-meta-item"><span class="meta-label">' + escHtml(t('mods-stars-label')) + '</span><span class="meta-value">' + (data.stars || 0) + '</span></div>'
        + '      <div class="mods-detail-meta-item"><span class="meta-label">' + escHtml(t('mods-forks-label')) + '</span><span class="meta-value">' + (data.forks || 0) + '</span></div>'
        + '      <div class="mods-detail-meta-item"><span class="meta-label">' + escHtml(t('mods-version')) + '</span><span class="meta-value">' + escHtml(data.minVer || '-') + '</span></div>'
        + (data.internalName ? '<div class="mods-detail-meta-item"><span class="meta-label">' + escHtml(t('mods-internal')) + '</span><span class="meta-value">' + escHtml(data.internalName) + '</span></div>' : '')
        + (data.version ? '<div class="mods-detail-meta-item"><span class="meta-label">' + escHtml(t('mods-version-label')) + '</span><span class="meta-value">' + escHtml(data.version) + '</span></div>' : '')
        + (data.updated ? '<div class="mods-detail-meta-item"><span class="meta-label">' + escHtml(t('mods-updated')) + '</span><span class="meta-value">' + escHtml(new Date(data.updated).toLocaleDateString()) + '</span></div>' : '')
        + '    </div>'
        + (data.desc ? '<div class="mods-detail-desc-wrap"><div class="mods-detail-desc">' + renderMindustryColors(data.desc) + '</div></div>' : '')
        + '  </div>'
        + '</div>'
        + (githubUrl !== '#' ? '<div class="mods-detail-section"><a class="nav-button mods-detail-link" href="' + escHtml(githubUrl) + '" target="_blank" rel="noopener noreferrer"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:6px;"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>' + escHtml(t('mods-repo-link')) + '</a></div>' : '');

      bodyEl.innerHTML = bodyHtml;
    }, 0);
  }

  function closeDetail() {
    var overlay = document.getElementById('mods-detail-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  window._modsShowDetail = showDetail;
  window._modsCloseDetail = closeDetail;

  /* ═══════════════════════════════════════════════════
     分页渲染
     ═══════════════════════════════════════════════════ */
  function renderPagination() {
    var pagEl = document.getElementById('mods-paginator');
    if (!pagEl) return;

    if (totalPages <= 1) {
      pagEl.innerHTML = '';
      pagEl.style.display = 'none';
      return;
    }
    pagEl.style.display = 'flex';

    var phtml = '';
    if (currentPage > 1) {
      phtml += '<button class="btn-sm paginator-btn" onclick="window._modsGoPage(1)" title="' + escHtml(t('mods-retry')) + '">&laquo;</button>';
      phtml += '<button class="btn-sm paginator-btn" onclick="window._modsGoPage(' + (currentPage - 1) + ')">&lsaquo;</button>';
    }
    phtml += '<span class="page-num">' + renderTemplate(t('mods-page'), { n: currentPage, t: totalPages }) + '</span>';
    if (currentPage < totalPages) {
      phtml += '<button class="btn-sm paginator-btn" onclick="window._modsGoPage(' + (currentPage + 1) + ')">&rsaquo;</button>';
      phtml += '<button class="btn-sm paginator-btn" onclick="window._modsGoPage(' + totalPages + ')">&raquo;</button>';
    }
    pagEl.innerHTML = phtml;
  }

  window._modsGoPage = function (page) {
    if (page < 1 || page > totalPages || isLoading) return;
    fetchPage(page);
    var el = document.getElementById('mods-list');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ═══════════════════════════════════════════════════
     错误/警告
     ═══════════════════════════════════════════════════ */
  function showError(msg) {
    if (!container) return;
    container.innerHTML = '<div class="mods-error"><p>' + escHtml(msg) + '</p><button class="btn-sm" onclick="window._modsRetry()">' + t('mods-retry') + '</button></div>';
  }

  function showWarning(msg) {
    var el = document.getElementById('mods-warning');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  window._modsRetry = function () {
    if (container) fetchPage(currentPage);
  };

  /* ═══════════════════════════════════════════════════
     筛选/搜索
     ═══════════════════════════════════════════════════ */
  window._modsSearch = function (val) {
    currentSearch = val;
    fetchPage(1);
  };

  window._modsSort = function (val) {
    currentSort = val;
    fetchPage(1);
  };

  window._modsLangFilter = function (val) {
    currentLang = val;
    fetchPage(1);
  };

  /* ═══════════════════════════════════════════════════
     UI 渲染入口
     ═══════════════════════════════════════════════════ */
  function renderUI() {
    if (!container) return;
    var html = ''
      + '<div id="mods-warning" class="mods-warning" style="display:none;"></div>'
      + '<div class="mods-toolbar mods-toolbar-desktop">'
      + '  <div class="mods-toolbar-left">'
      + '    <input type="text" id="mods-search" class="mods-search-input" placeholder="' + escHtml(t('mods-search-placeholder')) + '" oninput="window._modsSearch(this.value)">'
      + '    <select id="mods-sort" class="mods-select" onchange="window._modsSort(this.value)">'
      + '      <option value="default">' + escHtml(t('mods-sort-default')) + '</option>'
      + '      <option value="stars">' + escHtml(t('mods-sort-stars')) + '</option>'
      + '      <option value="popular">' + escHtml(t('mods-sort-popular')) + '</option>'
      + '    </select>'
      + '  </div>'
      + '  <div class="mods-toolbar-right"><span class="mods-count" id="mods-count"></span></div>'
      + '</div>'
      // 桌面端列表
      + '<div id="mods-list" class="mods-list mods-list-desktop"></div>'
      // 移动端列表（完全独立）
      + '<div id="mods-list-mobile" class="mods-list mods-list-mobile"></div>'
      + '<div id="mods-paginator" class="mods-paginator"></div>';

    container.innerHTML = html;
    fetchPage(1);
  }

  /* ═══════════════════════════════════════════════════
     初始化
     ═══════════════════════════════════════════════════ */
  function init() {
    var currentRepository = new URLSearchParams(window.location.search).get('repo') || '';
    if (!currentRepository) return;
    var tabContent = document.querySelector('.tab-content');
    if (!tabContent) return;

    var tabBar = document.querySelector('.tab-bar');
    if (tabBar) {
      var exists = tabBar.querySelector('[data-tab="mindustry-mods"]');
      if (!exists) {
        var btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.setAttribute('data-tab', 'mindustry-mods');
        btn.onclick = function () { switchTab('mindustry-mods'); };
        btn.innerHTML = '<span class="ico ico-box" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></span> <span data-i18n="mods-title">' + t('mods-title') + '</span>';
        tabBar.appendChild(btn);
      }
    }

    var containerId = 'tab-mindustry-mods';
    var existing = document.getElementById(containerId);
    if (!existing) {
      var parent = document.querySelector('.tab-content') ? document.querySelector('.tab-content').parentNode : document.querySelector('.container');
      if (!parent) return;
      var div = document.createElement('div');
      div.className = 'tab-content';
      div.id = containerId;
      div.style.display = 'none';
      div.innerHTML = '<div class="card"><div id="mindustry-mods-container" class="mods-container"></div></div>';
      var tabBarEl = document.querySelector('.tab-bar');
      if (tabBarEl && tabBarEl.nextElementSibling) {
        parent.insertBefore(div, tabBarEl.nextElementSibling);
        parent.appendChild(div);
      } else {
        parent.appendChild(div);
      }
    }

    container = document.getElementById('mindustry-mods-container');
    if (container) renderUI();
  }

  /* ── 健康上报 ── */
  window.__pluginHealth = window.__pluginHealth || {};
  window.__pluginHealth['mindustry-mods'] = { ok: true, stage: '就绪', errors: [] };

  /* ── 启动 ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
