/**
 * legal-plugin.js - Disclaimer + Cookie Consent + CAPTCHA
 * Standalone, independent from main program (function.js).
 * Multi-language support via inline translation map.
 * Controlled by plugin.json `enabled` field.
 */
(function() {
  'use strict';

  /* ── i18n translations ── */
  var LANG = {
    zh: {
      title: '\u4f7f\u7528\u58f0\u660e',
      notice: '\u672c\u7f51\u7ad9\u4e3a\u5b66\u4e60\u7814\u7a76\u7ad9\u70b9\uff0c\u5e76\u975e\u4ee3\u7406\u6216\u6d41\u91cf\u8f6c\u53d1\u670d\u52a1\uff0c\u4e0d\u63d0\u4f9b\u4efb\u4f55\u5f62\u5f0f\u7684\u8fdd\u53cd\u6cd5\u5f8b\u6cd5\u89c4\u7684\u5185\u5bb9\u6216\u529f\u80fd\u3002',
      statusTitle: '\u670d\u52a1\u72b6\u6001\u58f0\u660e\uff1a',
      items: [
        '\u672c\u7ad9\u5728\u6b63\u5f0f\u53d1\u5e03\u7248\u672c\u4e4b\u524d\uff0c\u4e0d\u4fdd\u8bc1\u670d\u52a1\u7684\u6709\u6548\u6027\u3001\u53ef\u9760\u6027\u6216\u968f\u65f6\u53ef\u7528\u6027\uff1b',
        '\u670d\u52a1\u53ef\u80fd\u968f\u65f6\u4e2d\u65ad\u3001\u8c03\u6574\u6216\u7ec8\u6b62\uff0c\u60695\u4e0d\u53e6\u884c\u901a\u77e5\uff1b',
        '\u6211\u4eec\u4e0d\u4fdd\u8bc1\u6570\u636e\u7684\u5b89\u5168\u6027\uff0c\u8bf7\u52ff\u5728\u6b64\u7f51\u7ad9\u8f93\u5165\u4efb\u4f55\u654f\u611f\u4fe1\u606f\uff1b',
        '\u4f7f\u7528\u672c\u7f51\u7ad9\u5373\u4ee3\u8868\u60a8\u7406\u89e3\u5e76\u63a5\u53d7\u4e0a\u8ff0\u6761\u6b3e\u3002'
      ],
      accept: '\u6211\u5df2\u77e5\u6089\uff0c\u7ee7\u7eed\u4f7f\u7528',
      cookie: '\u672c\u7f51\u7ad9\u4f7f\u7528 Cookie \u5b58\u50a8\u4e3b\u9898\u504f\u597d\u4e0e\u4f1a\u8bdd\u72b6\u6001\u3002\u7ee7\u7eed\u4f7f\u7528\u5373\u8868\u793a\u60a8\u540c\u610f Cookie \u653f\u7b56\u3002',
      cookieAccept: '\u6211\u77e5\u9053\u4e86'
    },
    'zh-Hant': {
      title: '\u4f7f\u7528\u8072\u660e',
      notice: '\u672c\u7db2\u7ad9\u70ba\u5b78\u7fd2\u7814\u7a76\u7ad9\u9ede\uff0c\u4e26\u975e\u4ee3\u7406\u6216\u6d41\u91cf\u8f89\u767c\u670d\u52d9\uff0c\u4e0d\u63d0\u4f9b\u4efb\u4f55\u5f62\u5f0f\u7684\u9055\u53cd\u6cd5\u5f8b\u6cd5\u898f\u7684\u5167\u5bb9\u6216\u529f\u80fd\u3002',
      statusTitle: '\u670d\u52d9\u72c0\u614b\u8072\u660e\uff1a',
      items: [
        '\u672c\u7ad9\u5728\u6b63\u5f0f\u767c\u4f48\u7248\u672c\u4e4b\u524d\uff0c\u4e0d\u4fdd\u8b49\u670d\u52d9\u7684\u6709\u6548\u6027\u3001\u53ef\u9760\u6027\u6216\u968f\u6642\u53ef\u7528\u6027\uff1b',
        '\u670d\u52d9\u53ef\u80fd\u968f\u6642\u4e2d\u65b7\u3001\u8abf\u6574\u6216\u7d42\u6b62\uff0c\u60695\u4e0d\u53e6\u884c\u901a\u77e5\uff1b',
        '\u6211\u5011\u4e0d\u4fdd\u8b49\u8cc7\u6599\u7684\u5b89\u5168\u6027\uff0c\u8acb\u52ff\u5728\u6b64\u7db2\u7ad9\u8f38\u5165\u4efb\u4f55\u654f\u611f\u8cc7\u8a0a\uff1b',
        '\u4f7f\u7528\u672c\u7db2\u7ad9\u5373\u4ee3\u8868\u60a8\u7406\u89e3\u4e26\u63a5\u53d7\u4e0a\u8ff0\u689d\u6b3e\u3002'
      ],
      accept: '\u6211\u5df2\u77e5\u6089\uff0c\u7e7c\u7e8c\u4f7f\u7528',
      cookie: '\u672c\u7db2\u7ad9\u4f7f\u7528 Cookie \u5132\u5b58\u4e3b\u984c\u504f\u597d\u8207\u6703\u8a71\u72c0\u614b\u3002\u7e7c\u7e8c\u4f7f\u7528\u5373\u8868\u793a\u60a8\u540c\u610f Cookie \u653f\u7b56\u3002',
      cookieAccept: '\u6211\u77e5\u9053\u4e86'
    },
    en: {
      title: 'Site Disclaimer',
      notice: 'This website is a learning and research project. It does NOT provide proxy, traffic forwarding, or any illegal services.',
      statusTitle: 'Service Status Notice:',
      items: [
        'Before the official release, no guarantee of service effectiveness, reliability, or availability;',
        'Service may be interrupted, modified, or terminated at any time without notice;',
        'We do NOT guarantee data security; do not enter sensitive information;',
        'By using this site you accept the above terms.'
      ],
      accept: 'I Understand & Continue',
      cookie: 'This site uses cookies for theme preferences and session state. By continuing you agree to the cookie policy.',
      cookieAccept: 'Got it'
    }
  };

  function getCookie(name) {
    var escaped = String(name).replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
    var m = document.cookie.match(new RegExp('(^| )' + escaped + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : null;
  }
  function setCookie(name, value, days) {
    var e = '';
    if (days) { var d = new Date(); d.setTime(d.getTime() + days * 864e5); e = '; expires=' + d.toUTCString(); }
    document.cookie = name + '=' + encodeURIComponent(value) + e + '; path=/; SameSite=Lax';
  }

  /* Detect language: cookie > url param > browser lang > zh */
  function detectLang() {
    var lang = getCookie('gitaap_lang');
    if (!lang) {
      var m = window.location.search.match(/[?&]lang=([^&]+)/);
      if (m) lang = m[1];
    }
    if (!lang) lang = navigator.language || 'zh';
    if (lang.startsWith('zh-Hant') || lang.startsWith('zh-TW') || lang.startsWith('zh-HK')) return 'zh-Hant';
    if (lang.startsWith('zh')) return 'zh';
    return 'en';
  }

  function t(key) {
    var lang = detectLang();
    return (LANG[lang] && LANG[lang][key]) || (LANG.en && LANG.en[key]) || key;
  }

  var config = null;
  function loadConfig(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/static/plugins/available/legal-compliance/manifest.json?_=' + Date.now(), true);
    xhr.onload = function() {
      if (xhr.status === 200) { try { config = JSON.parse(xhr.responseText); } catch(e) { config = null; } }
      if (callback) callback(config);
    };
    xhr.onerror = function() { if (callback) callback(null); };
    xhr.send();
  }

  /* Disclaimer modal */
  function showDisclaimer() {
    if (getCookie('site_disclaimer_accepted')) return;
    var o = document.createElement('div');
    o.id = 'legal-disclaimer';
    o.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,sans-serif;';
    var b = document.createElement('div');
    b.style.cssText = 'max-width:560px;width:100%;background:var(--bg3,#1a1f2e);border-radius:16px;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,0.5);max-height:90vh;overflow-y:auto;';
    var h = document.createElement('h2');
    h.textContent = '\u26a0\ufe0f ' + t('title');
    h.style.cssText = 'margin:0 0 16px;font-size:1.3rem;color:var(--text,#c9d1d9);';
    var body = document.createElement('div');
    body.style.cssText = 'font-size:0.9rem;line-height:1.7;color:var(--text-dim,#8b98a6);';
    var items = LANG[detectLang()] && LANG[detectLang()].items ? LANG[detectLang()].items : LANG.en.items;
    body.innerHTML = '<p style="margin:0 0 12px;"><strong>' + t('notice') + '</strong></p>'
      + '<p style="margin:0 0 8px;"><strong>' + t('statusTitle') + '</strong></p>'
      + '<ul style="margin:0 0 8px;padding-left:20px;">'
      + items.map(function(item) { return '<li>' + item + '</li>'; }).join('')
      + '</ul>';
    var btn = document.createElement('button');
    btn.textContent = t('accept');
    btn.style.cssText = 'display:block;width:100%;margin-top:20px;padding:12px;border:none;border-radius:10px;background:var(--accent,#238686);color:#fff;font-size:1rem;font-weight:600;cursor:pointer;';
    btn.onclick = function() {
      setCookie('site_disclaimer_accepted', '1', 365);
      o.remove();
      showCookieBar();
    };
    b.appendChild(h); b.appendChild(body); b.appendChild(btn); o.appendChild(b);
    safeAppend(o);
  }

  /* Cookie consent bar */
  function showCookieBar() {
    if (getCookie('site_cookie_consent')) return;
    if (getCookie('site_disclaimer_accepted') !== '1') return;
    var bar = document.createElement('div');
    bar.id = 'legal-cookie-bar';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:var(--bg3,#1a1f2e);border-top:1px solid var(--border,#30363d);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;font-family:system-ui,sans-serif;';
    var txt = document.createElement('span');
    txt.style.cssText = 'font-size:0.85rem;color:var(--text-dim,#8b98a6);flex:1;min-width:200px;line-height:1.5;';
    txt.textContent = t('cookie');
    var btn = document.createElement('button');
    btn.textContent = '\u2713 ' + t('cookieAccept');
    btn.style.cssText = 'padding:8px 18px;border:none;border-radius:8px;background:var(--accent,#238686);color:#fff;font-size:0.85rem;cursor:pointer;font-weight:500;white-space:nowrap;';
    btn.onclick = function() {
      setCookie('site_cookie_consent', '1', 365);
      bar.remove();
    };
    bar.appendChild(txt); bar.appendChild(btn);
    safeAppend(bar);
  }

  /* CAPTCHA (Cloudflare Turnstile) */
  function injectCaptcha(cfg) {
    if (!cfg || !cfg.config || !cfg.config.captcha_enabled) return;
    if (!cfg.config.captcha_site_key) return;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.defer = true;
    document.head.appendChild(s);
  }

  /* ── 健康上报 ── */
  window.__pluginHealth = window.__pluginHealth || {};
  window.__pluginHealth['legal-compliance'] = { ok: true, stage: '就绪', errors: [] };

  /* 安全的 body append（defer 模式下 body 可能尚未就绪） */
  function safeAppend(el) {
    if (document.body) {
      document.body.appendChild(el);
    } else {
      // body 未就绪时延迟等待
      var retryTimer = setTimeout(function() {
        if (document.body) {
          document.body.appendChild(el);
        } else {
          // 最终 fallback：在 DOMContentLoaded 中尝试
          document.addEventListener('DOMContentLoaded', function() { document.body.appendChild(el); }, { once: true });
        }
      }, 10);
    }
  }

  /* Init */
  loadConfig(function(cfg) {
    if (!cfg || cfg.enabled === false) return;
    if (cfg.config && cfg.config.disclaimer_required !== false) showDisclaimer();
    if (getCookie('site_disclaimer_accepted') === '1') showCookieBar();
    injectCaptcha(cfg);
  });

})();
