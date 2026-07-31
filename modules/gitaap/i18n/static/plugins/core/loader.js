/**
 * plugins-loader.js — 插件资产自动加载器
 * =============================================
 * 页面加载时自动扫描 registry.json，获取所有已启用插件，
 * 自动注入 CSS、注册 SVG 图标、加载 JS 入口文件。
 * 独立运行，不依赖主程序 function.js。
 */
(function() {
  'use strict';

  var LOADED = [];

  /* ── 健康状态（全局，供 manager.js 查询） ── */
  window.__pluginHealth = window.__pluginHealth || {};
  window.__pluginHealth['_loader'] = { ok: false, stage: '加载中…', loaded: [], errors: [] };

  function _reportHealth(ok, stage, errMsg) {
    var h = window.__pluginHealth['_loader'];
    h.ok = ok;
    h.stage = stage;
    h.loaded = LOADED.slice();
    if (errMsg) h.errors.push(errMsg);
  }

  /* ── 获取 registry ── */
  function loadRegistry(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/static/plugins/registry.json?_=' + Date.now(), true);
    xhr.timeout = 8000;
    xhr.ontimeout = function() {
      console.warn('[plugins] registry 加载超时（8秒），插件将不可用');
      _reportHealth(false, 'registry 加载超时（8秒）', 'registry 加载超时');
      callback(null);
    };
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          // 缓存供 manager.js 复用
          window.__pluginRegistry = data;
          callback(data);
        } catch(e) {
          console.error('[plugins] registry JSON 解析失败:', e);
          _reportHealth(false, 'registry JSON 解析失败', e.message);
          callback(null);
        }
      } else {
        console.warn('[plugins] registry 请求失败: HTTP ' + xhr.status);
        _reportHealth(false, 'registry 请求失败 HTTP ' + xhr.status, 'HTTP ' + xhr.status);
        callback(null);
      }
    };
    xhr.onerror = function() {
      console.error('[plugins] registry 网络请求失败');
      _reportHealth(false, 'registry 网络请求失败', '网络请求失败');
      callback(null);
    };
    xhr.send();
  }

  /* ── 注入 CSS ── */
  function injectCSS(url) {
    // 去重：比较源 URL 路径（不带查询参数）
    var srcUrl = url.split('?')[0];
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].href.split('?')[0] === srcUrl) return;
    }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url + '?_=' + Date.now();
    document.head.appendChild(link);
  }

  /* ── 加载 JS ── */
  function loadJS(url, callback) {
    // 去重：比较源 URL 路径（不带查询参数）
    var srcUrl = url.split('?')[0];
    var scripts = document.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src.split('?')[0] === srcUrl) {
        if (callback) callback();
        return;
      }
    }
    var s = document.createElement('script');
    s.src = url + '?_=' + Date.now();
    s.defer = true;
    s.onload = function() { if (callback) callback(); };
    s.onerror = function() {
      console.warn('[plugins] JS 加载失败: ' + srcUrl.split('/').pop());
      if (callback) callback();
    };
    document.head.appendChild(s);
  }

  /* ── 主逻辑 ── */
  function init() {
    loadRegistry(function(registry) {
      if (!registry || !registry.plugins) {
        _reportHealth(false, 'registry 不可用', 'registry 为空或不存在');
        return;
      }

      var allPlugins = registry.plugins;
      var currentRepository = new URLSearchParams(window.location.search).get('repo') || '';
      var enabled = allPlugins.filter(function(p) {
        if (p.enabled === false) return false;
        if (!Array.isArray(p.repositoryScopes) || p.repositoryScopes.length === 0) return true;
        return p.repositoryScopes.indexOf(currentRepository) !== -1;
      });

      if (enabled.length === 0) {
        _reportHealth(true, '无已启用插件');
        return;
      }

      // ── dependencies 依赖检查 ──
      var enabledIds = {};
      enabled.forEach(function(p) { enabledIds[p.id] = true; });

      var skipped = [];
      var ready = [];

      enabled.forEach(function(p) {
        if (!p.dependencies || p.dependencies.length === 0) {
          ready.push(p);
          return;
        }
        var missing = [];
        for (var i = 0; i < p.dependencies.length; i++) {
          if (!enabledIds[p.dependencies[i]]) {
            missing.push(p.dependencies[i]);
          }
        }
        if (missing.length > 0) {
          console.warn('[plugins] ' + p.id + ' 依赖缺失: ' + missing.join(', ') + ' — 跳过加载');
          skipped.push({ id: p.id, missing: missing });
        } else {
          ready.push(p);
        }
      });

      // ── 按依赖顺序注入：先注入被依赖的，再注入依赖方 ──
      // 构建依赖图以确定注入顺序
      var ordered = [];
      var visited = {};
      function visit(pid) {
        if (visited[pid]) return;
        visited[pid] = true;
        var depPlugin = ready.filter(function(p) { return p.id === pid; })[0];
        // 不在 ready 中的跳过（可能是被跳过的）
        if (!depPlugin) return;
        if (depPlugin.dependencies) {
          for (var i = 0; i < depPlugin.dependencies.length; i++) {
          visit(depPlugin.dependencies[i]);
          }
        }
        ordered.push(depPlugin);
      }
      ready.forEach(function(p) { visit(p.id); });

      // ── 注入资源 ──
      ordered.forEach(function(plugin) {
        function resolvePath(file) {
          return file && file.indexOf('/') === 0 ? file : '/static/plugins/' + plugin.id + '/' + file;
        }

        // 注入 CSS
        if (plugin.style) {
          injectCSS(resolvePath(plugin.style));
        }
        if (plugin.assets && plugin.assets.css) {
          plugin.assets.css.forEach(function(cssFile) {
            injectCSS(resolvePath(cssFile));
          });
        }

        // 加载 JS
        if (plugin.entry) {
          loadJS(resolvePath(plugin.entry));
        }
        if (plugin.assets && plugin.assets.js) {
          plugin.assets.js.forEach(function(jsFile) {
            if (jsFile === plugin.entry) return;
            loadJS(resolvePath(jsFile));
          });
        }

        LOADED.push(plugin.id);
      });

      var summary = ordered.length + ' 个插件已加载: ' + ordered.map(function(p) { return p.id; }).join(', ');
      if (skipped.length > 0) {
        var skipList = skipped.map(function(s) { return s.id + '(缺:' + s.missing.join(',') + ')'; }).join('; ');
        summary += ' | ' + skipped.length + ' 个跳过: ' + skipList;
      }
      if (ordered.length > 0 || skipped.length > 0) {
        console.log('[plugins] ' + summary);
      }
      _reportHealth(true, summary);

      // ── 更新抽屉中的插件状态 ──
      updateDrawerPluginStatus(registry);
    });
  }

  /* ── 更新侧边抽屉插件状态 ── */
  function updateDrawerPluginStatus(registry) {
    var el = document.getElementById('drawer-plugin-status');
    if (!el || !registry || !registry.plugins) return;

    var all = registry.plugins;
    var enabled = all.filter(function(p) { return p.enabled !== false; });
    var disabled = all.filter(function(p) { return p.enabled === false; });

    var html = '<div style="margin-bottom:4px;">'
      + '<span class="ico ico-check ico-green" style="width:12px;height:12px;"></span> '
      + '<span style="color:var(--green);">' + enabled.length + '</span><span style="color:var(--text-dim);">/' + all.length + ' 已启用</span>'
      + '</div>';

    if (disabled.length > 0) {
      html += '<div style="margin-bottom:4px;">'
        + '<span class="ico ico-slash ico-red" style="width:12px;height:12px;"></span> '
        + '<span style="color:var(--red);">' + disabled.length + '</span><span style="color:var(--text-dim);"> 个未启用</span>'
        + '</div>';
    }

    // 已启用的插件列表
    if (enabled.length > 0) {
      html += '<div style="margin-top:4px; font-size:0.75rem;">';
      enabled.forEach(function(p) {
        html += '<div style="display:flex;align-items:center;gap:4px;padding:2px 0;">'
          + '<span class="plugin-status-dot dot-green" style="width:6px;height:6px;border-radius:50%;display:inline-block;background:var(--green);flex-shrink:0;"></span>'
          + '<span>' + (p.title || p.id) + ' <span style="color:var(--text-dim);">v' + (p.version || '0') + '</span></span>'
          + '</div>';
      });
      html += '</div>';
    }

    el.innerHTML = html;
  }

  /* ── 在 DOMContentLoaded 后执行 ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
