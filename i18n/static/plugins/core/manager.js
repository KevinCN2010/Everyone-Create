/* ═══════════════════════════════════════════════════
   plugins-manager.js — 插件管理器（独立，不依赖主程序）
   加载 registry.json 并渲染插件列表
   ═══════════════════════════════════════════════════ */
(function() {
  'use strict';

  var container = document.getElementById('plugins-container');
  if (!container) { console.error('[plugins] #plugins-container not found'); return; }

  // ── 状态信息文本框管理 ──
  var statusBox = document.getElementById('plugin-status-box');
  var statusIcon = document.getElementById('plugin-status-icon');
  var statusText = document.getElementById('plugin-status-text');
  var statusClose = document.getElementById('plugin-status-close');

  function setStatus(mode, text) {
    if (!statusBox) return;
    // 清除所有状态类
    statusBox.className = 'plugin-status-box animate-in visible';
    if (mode) statusBox.classList.add('plugin-status-' + mode);
    if (statusIcon) {
      if (mode === 'loading') {
        statusIcon.innerHTML = '<span class="spinner-small"></span>';
      } else if (mode === 'success') {
        statusIcon.innerHTML = '<span style="font-size:1.1rem;">✓</span>';
      } else if (mode === 'error') {
        statusIcon.innerHTML = '<span style="font-size:1.1rem;">✕</span>';
      }
    }
    if (statusText) statusText.textContent = text || '';
    if (statusClose) statusClose.style.display = (mode === 'error') ? 'block' : 'none';
  }

  function hideStatus() {
    if (!statusBox) return;
    statusBox.classList.add('plugin-status-hidden');
    setTimeout(function() {
      statusBox.style.display = 'none';
    }, 450);
  }

  // 暴露关闭函数供 HTML onclick 调用
  window.closePluginStatus = function() {
    hideStatus();
  };

  // 初始状态：加载中
  setStatus('loading', '正在加载插件列表...');

  // ── toggle 竞态序号（避免快速连续点击覆盖） ──
  var _toggleSeq = 0;

  /* ── 安全的 CSS 选择器转义（避免特殊字符注入） ── */
  function cssEscape(value) {
    // 转义 CSS 选择器中的特殊字符：.!:#[] 等
    // 使用 CSS.escape 浏览器原生 API，现代浏览器均已支持
    if (typeof CSS !== 'undefined' && CSS.escape) {
      return CSS.escape(value);
    }
    // Fallback: 对已知特殊字符做简单转义
    return String(value).replace(/[!"#$%&'()*+,./:;<=>?@[\]^`{|}~]/g, '\\$&');
  }

  /* ── 通过事件委托绑定 toggle，避免 onclick 中拼接 plugin id（XSS 防护） ── */
  container.addEventListener('change', function(e) {
    var checkbox = e.target;
    if (!checkbox || checkbox.type !== 'checkbox') return;
    var card = checkbox.closest('.plugin-card');
    if (!card) return;
    var pluginId = card.getAttribute('data-plugin-id');
    if (!pluginId) return;
    doToggle(pluginId, checkbox.checked, checkbox);
  });

  function doToggle(id, enabled, checkboxEl) {
    var seq = ++_toggleSeq;

    function sendToggle(csrfToken) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/plugins/toggle', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      xhr.onload = function() {
        if (xhr.status === 200) {
          var card = container.querySelector('.plugin-card[data-plugin-id="' + cssEscape(id) + '"]');
          if (card) {
            card.className = 'plugin-card ' + (enabled ? 'plugin-enabled' : 'plugin-disabled');
            var dot = card.querySelector('.plugin-status-dot');
            if (dot) dot.className = 'plugin-status-dot ' + (enabled ? 'dot-green' : 'dot-gray');
          }
        } else {
          console.warn('[plugins] toggle failed:', xhr.status, xhr.responseText);
          showToggleError('插件状态切换失败 (HTTP ' + xhr.status + ')');
          // 恢复复选框状态（仅当序号仍匹配时）
          if (seq === _toggleSeq && checkboxEl) {
            checkboxEl.checked = !enabled;
          }
        }
      };
      xhr.onerror = function() {
        console.error('[plugins] toggle network error');
        if (seq === _toggleSeq && checkboxEl) {
          showToggleError('网络请求失败，请检查连接后重试');
          checkboxEl.checked = !enabled;
        }
      };
      xhr.send(JSON.stringify({ id: id, enabled: enabled }));
    }

    // CSRF token 缺失时主动获取
    // 注：function.js 也管理 _csrfToken，此地仅作兜底，不修改 window._csrfToken
    // 以避免与 function.js 的 fetchCsrfToken() 发生竞态覆盖
    if (!window._csrfToken) {
      var csrfXhr = new XMLHttpRequest();
      csrfXhr.open('GET', '/csrf-token', true);
      csrfXhr.timeout = 4000;
      csrfXhr.onload = function() {
        try {
          var data = JSON.parse(csrfXhr.responseText);
          if (data.token) {
            // 直接传给 sendToggle，不设置 window._csrfToken（由 function.js 管理）
            sendToggle(data.token);
            return;
          }
        } catch(e) {}
        // 获取失败时无 token 也发（由后端 403 保护）
        sendToggle('');
      };
      csrfXhr.onerror = function() { sendToggle(''); };
      csrfXhr.ontimeout = function() { sendToggle(''); };
      csrfXhr.send();
      return;
    }
    sendToggle(window._csrfToken);
  }

  // 保留旧的全局接口供向后兼容（改为空操作以避免破坏现有调用）
  window.__togglePlugin = function(id, enabled) {
    // 已通过事件委托处理，此函数保留仅为向后兼容
    // 如有直接代码调用，仍可手动触发
    doToggle(id, enabled, null);
  };

  function showToggleError(msg) {
    var errDiv = document.createElement('div');
    errDiv.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;background:#9a2a2a;color:#fff;padding:10px 20px;border-radius:8px;font-size:0.85rem;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
    errDiv.textContent = msg;
    document.body.appendChild(errDiv);
    setTimeout(function() { errDiv.remove(); }, 4000);
  }

  // ── 优先复用 loader.js 缓存的 registry ──
  if (window.__pluginRegistry) {
    try {
      render(window.__pluginRegistry);
    } catch(e) {
      console.error('[plugins] 缓存 registry 渲染失败，回退到直接请求:', e);
      setStatus('error', '缓存数据渲染异常: ' + e.message + ' — 重新加载中...');
      // 清除缓存，走 fallback
      window.__pluginRegistry = null;
      fetchRegistry();
    }
    return;
  }

  fetchRegistry();

  function fetchRegistry() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/static/plugins/registry.json?_=' + Date.now(), true);
    xhr.timeout = 10000;
    xhr.ontimeout = function() {
      var errMsg = '加载超时：服务器未响应';
      container.innerHTML = '<p style="color:var(--red);text-align:center;padding:40px;">' + errMsg + '</p>';
      console.error('[plugins] registry load timeout');
      setStatus('error', errMsg + ' — 请刷新页面重试。');
    };
    xhr.onload = function() {
      if (xhr.status !== 200) {
        var errMsg = '加载失败: HTTP ' + xhr.status + ' (' + xhr.statusText + ')';
        container.innerHTML = '<p style="color:var(--red);text-align:center;padding:40px;">' + errMsg + '</p>';
        console.error('[plugins] registry load failed:', xhr.status, xhr.statusText);
        setStatus('error', errMsg + ' — 请检查网络连接或服务端状态。');
        return;
      }
      try {
        var data = JSON.parse(xhr.responseText);
        // 缓存供后续使用
        window.__pluginRegistry = data;
        render(data);
        setStatus('success', '插件列表加载完成，共 ' + (data.plugins || []).length + ' 个插件。');
        setTimeout(hideStatus, 1200);
      } catch(e) {
        var parseErr = '数据解析失败: ' + e.message;
        container.innerHTML = '<p style="color:var(--red);text-align:center;padding:40px;">Invalid registry data.</p>';
        console.error('[plugins] JSON parse error:', e);
        setStatus('error', parseErr + ' — registry.json 格式异常。');
      }
    };
    xhr.onerror = function() {
      var netErr = '网络请求失败：无法连接到服务端';
      container.innerHTML = '<p style="color:var(--red);text-align:center;padding:40px;">Network error loading plugin registry.</p>';
      console.error('[plugins] XHR network error');
      setStatus('error', netErr + ' — 请刷新页面重试。');
    };
    xhr.send();
  }

  function render(data) {
    var plugins = data.plugins || [];
    var countEl = document.getElementById('plugins-count');
    if (countEl) countEl.textContent = plugins.length + ' 个插件';

    if (plugins.length === 0) {
      container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px;">No plugins installed.</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < plugins.length; i++) {
      var p = plugins[i];
      html += renderPluginCard(p, i);
    }
    container.innerHTML = html;
    // 渲染完成后检查插件健康状态（延迟等待异步插件加载）
    checkPluginHealth();
    setTimeout(checkPluginHealth, 2000);
    setTimeout(checkPluginHealth, 5000);
  }

  function checkPluginHealth() {
    if (!window.__pluginHealth) return;
    var cards = container.querySelectorAll('.plugin-card');
    cards.forEach(function(card) {
      var id = card.getAttribute('data-plugin-id');
      // 跳过加载器自身的健康条目
      if (id === '_loader') return;
      var health = window.__pluginHealth[id];
      if (!health) return;
      // 清除旧健康状态
      var old = card.querySelector('.plugin-health');
      if (old) old.remove();
      var div = document.createElement('div');
      div.className = 'plugin-health';
      if (health.ok) {
        div.innerHTML = '<span class="health-dot health-ok"></span> 运行正常 · ' + escHtml(health.stage || '');
      } else {
        var errText = (health.errors || []).join('; ') || health.stage || '未知错误';
        div.innerHTML = '<span class="health-dot health-err"></span> 异常: ' + escHtml(errText);
      }
      card.appendChild(div);
    });

    // 同时显示 loader 自身的健康状态
    var loaderHealth = window.__pluginHealth['_loader'];
    if (loaderHealth) {
      var loaderCard = document.getElementById('loader-health-card');
      if (!loaderCard) {
        loaderCard = document.createElement('div');
        loaderCard.id = 'loader-health-card';
        loaderCard.className = 'plugin-health';
        loaderCard.style.cssText = 'margin-top:12px;';
        container.insertBefore(loaderCard, container.firstChild);
      }
      if (loaderHealth.ok) {
        loaderCard.innerHTML = '<span class="health-dot health-ok"></span> 加载器: ' + escHtml(loaderHealth.stage || '');
      } else {
        var errText = (loaderHealth.errors || []).join('; ') || loaderHealth.stage || '未知错误';
        loaderCard.innerHTML = '<span class="health-dot health-err"></span> 加载器异常: ' + escHtml(errText);
      }
    }
  }

  function renderPluginCard(p, idx) {
    var statusClass = p.enabled ? 'plugin-enabled' : 'plugin-disabled';
    var statusText = p.enabled ? 'Enabled' : 'Disabled';
    // 注意：checkbox 不再带 onclick，由事件委托统一处理
    return '<div class="plugin-card ' + statusClass + '" data-plugin-id="' + escAttr(p.id) + '">'
      + '<div class="plugin-card-header">'
      +   '<div class="plugin-title-row">'
      +     '<span class="plugin-status-dot ' + (p.enabled ? 'dot-green' : 'dot-gray') + '"></span>'
      +     '<h3 class="plugin-name">' + escHtml(p.title || p.id) + '</h3>'
      +     '<span class="plugin-version">v' + escHtml(p.version || '0.0.0') + '</span>'
      +   '</div>'
      +   '<label class="plugin-toggle">'
      +     '<input type="checkbox" ' + (p.enabled ? 'checked' : '') + '>'
      +     '<span class="toggle-slider"></span>'
      +   '</label>'
      + '</div>'
      + '<p class="plugin-desc">' + escHtml(p.description || 'No description') + '</p>'
      + '<div class="plugin-meta-grid">'
      +   metaItem('Author', p.author || '--')
      +   metaItem('Team', p.team || '--')
      +   metaItem('Created', p.created_at ? p.created_at.slice(0, 10) : '--')
      +   metaItem('Updated', p.updated_at ? p.updated_at.slice(0, 10) : '--')
      +   metaItem('Size', p.size || '--')
      +   metaItem('Status', statusText)
      + '</div>'
      + (p.tags && p.tags.length ? '<div class="plugin-tags">' + p.tags.map(function(t) { return '<span class="plugin-tag">' + escHtml(t) + '</span>'; }).join('') + '</div>' : '')
      + '<div class="plugin-deps">Dependencies: ' + (p.dependencies && p.dependencies.length ? p.dependencies.map(function(d) { return escHtml(d); }).join(', ') : 'None') + '</div>'
      + '</div>';
  }

  function metaItem(label, value) {
    return '<div class="plugin-meta-item"><span class="meta-label">' + escHtml(label) + '</span><span class="meta-value">' + escHtml(value) + '</span></div>';
  }

  /* ── Helpers ── */
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function escAttr(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

})();
