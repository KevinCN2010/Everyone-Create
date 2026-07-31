(function() {
    'use strict';

    // 色块颜色需与 static/themes/tone-<id>.css 中的 --accent / --cyan / 次强调色保持一致，
    // 否则预览条与实际应用后的配色不符。
    var TONE_LIST = [
        { id: 'ocean', colors: ['#1a9aa8', '#5bc0de', '#4a9eff'] },
        { id: 'forest', colors: ['#2d9a55', '#6fcf97', '#27ae60'] },
        { id: 'sunset', colors: ['#d1873f', '#e8a87c', '#e67e22'] },
        { id: 'midnight', colors: ['#8e44ad', '#a569bd', '#5dade2'] },
        { id: 'sakura', colors: ['#d14d74', '#e8a0bf', '#e84393'] },
        { id: 'graphite', colors: ['#5f7d8c', '#9fb3bd', '#7aa7c7'] },
        { id: 'amber', colors: ['#c8942f', '#d4a853', '#e08a3c'] },
        { id: 'bamboo', colors: ['#1f9e8c', '#5ec8b8', '#5aa9d6'] },
        { id: 'frost', colors: ['#3a9bd5', '#64b4ff', '#4a9eff'] },
        { id: 'ember', colors: ['#cc6b33', '#e1783c', '#d9742a'] },
        { id: 'lavender', colors: ['#8b6cd4', '#aa8ce6', '#b08ce6'] }
    ];
    var toneLoading = null;
    var notifyTimer = null;
    var toneMarketRendered = false;

    function getCurrentTone() {
        return window.getCookie('gitaap_tone') || '';
    }

    function loadToneCss(toneId) {
        return new Promise(function(resolve, reject) {
            if (!toneId) { resolve(); return; }
            if (toneLoading === toneId) {
                var waitCount = 0;
                var check = setInterval(function() {
                    waitCount++;
                    if (toneLoading !== toneId || waitCount > 100) {
                        clearInterval(check);
                        if (waitCount > 100) {
                            toneLoading = null;
                            reject(new Error(window.t('tone-timeout')));
                        } else if (document.getElementById('tone-css-' + toneId)) {
                            document.documentElement.setAttribute('data-tone', toneId);
                            resolve();
                        } else {
                            reject(new Error(window.t('tone-load-failed')));
                        }
                    }
                }, 100);
                return;
            }
            if (document.getElementById('tone-css-' + toneId)) {
                document.documentElement.setAttribute('data-tone', toneId);
                resolve();
                return;
            }
            toneLoading = toneId;
            document.querySelectorAll('[id^="tone-css-"]').forEach(function(el) { el.remove(); });
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.id = 'tone-css-' + toneId;
            link.href = '/static/themes/tone-' + toneId + '.css';
            link.onload = function() {
                toneLoading = null;
                document.documentElement.setAttribute('data-tone', toneId);
                resolve();
            };
            link.onerror = function() {
                toneLoading = null;
                console.error('[tone] Failed to load: ' + toneId);
                document.documentElement.removeAttribute('data-tone');
                var failedLink = document.getElementById('tone-css-' + toneId);
                if (failedLink) failedLink.remove();
                reject(new Error('Tone "' + toneId + '" failed to load'));
            };
            document.head.appendChild(link);
        });
    }

    function showNotification(text, type) {
        if (notifyTimer) clearTimeout(notifyTimer);
        var old = document.getElementById('app-notify-bar');
        if (old) old.remove();
        var bar = document.createElement('div');
        bar.id = 'app-notify-bar';
        var background = type === 'success' ? '#1a7f2a' : type === 'error' ? '#9a2a2a' : '#9a6a00';
        bar.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:99999;padding:10px 20px;font-size:0.85rem;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:slideUp 0.3s ease;background:' + background + ';color:#fff;';
        bar.setAttribute('role', 'status');
        // 用 textContent 承载文案：text 可能来自接口错误信息，拼入 innerHTML 会形成 XSS
        var msgEl = document.createElement('span');
        msgEl.textContent = text;
        var closeEl = document.createElement('span');
        closeEl.style.cssText = 'cursor:pointer;padding:0 4px;opacity:0.8;';
        closeEl.innerHTML = '<span aria-hidden="true" class="ico ico-x" style="width:14px;height:14px;"></span>';
        closeEl.onclick = function() { if (bar.parentNode) bar.remove(); };
        bar.appendChild(msgEl);
        bar.appendChild(closeEl);
        document.body.appendChild(bar);
        notifyTimer = setTimeout(function() {
            notifyTimer = null;
            var el = document.getElementById('app-notify-bar');
            if (el) el.remove();
        }, 3000);
    }

    async function applyTone(toneId) {
        var card = document.querySelector('.tone-card[data-tone="' + toneId + '"]');
        var statusEl = card ? card.querySelector('.tone-card-status') : null;
        var toggle = document.getElementById('tone-market-toggle');
        if (card) card.classList.add('loading');
        if (statusEl) statusEl.innerHTML = window.t('tone-loading');
        if (toggle) toggle.disabled = true;
        try {
            await loadToneCss(toneId);
            window.setCookie('gitaap_tone', toneId, 365);
            document.querySelectorAll('.tone-card').forEach(function(c) {
                var isActive = c.dataset.tone === toneId;
                c.classList.toggle('active', isActive);
                c.classList.remove('loading');
                var status = c.querySelector('.tone-card-status');
                if (status) status.innerHTML = isActive ? window.t('tone-in-use') : '';
            });
            var toneName = window.t('tone-' + toneId) || toneId;
            showNotification(toneName + ' ' + (window.t('tone-activated') || 'Applied'), 'success');
        } catch (e) {
            console.error('[tone] applyTone error:', e);
            if (card) card.classList.remove('loading');
            if (statusEl) statusEl.innerHTML = window.t('tone-load-failed');
            showNotification(window.t('tone-load-failed') || 'Tone failed to load', 'error');
            if (window._toneErrorTimer) clearTimeout(window._toneErrorTimer);
            window._toneErrorTimer = setTimeout(function() {
                if (statusEl) statusEl.textContent = '';
                window._toneErrorTimer = null;
            }, 3000);
        } finally {
            if (toggle) toggle.disabled = false;
        }
    }

    async function initTone() {
        var toneId = getCurrentTone();
        if (toneId) {
            try { await loadToneCss(toneId); }
            catch (e) {
                console.warn('[tone] init failed, clearing cookie:', e);
                window.setCookie('gitaap_tone', '', -1);
            }
        } else {
            document.documentElement.removeAttribute('data-tone');
        }
    }

    function toggleToneMarket() {
        var grid = document.getElementById('tone-market-grid');
        var toggle = document.getElementById('tone-market-toggle');
        if (!grid || !toggle) return;
        if (grid.style.display === 'none') {
            grid.style.display = 'grid';
            toggle.classList.add('open');
            toggle.innerHTML = '<span aria-hidden="true" class="ico ico-chevron-up ico-gap" style="width:14px;height:14px;"></span> ' + window.t('tone-collapse');
            if (!toneMarketRendered) {
                renderToneMarket();
                toneMarketRendered = true;
            } else {
                var currentTone = getCurrentTone();
                document.querySelectorAll('.tone-card').forEach(function(card) {
                    var isActive = card.dataset.tone === currentTone;
                    card.classList.toggle('active', isActive);
                    var status = card.querySelector('.tone-card-status');
                    if (status) status.innerHTML = isActive ? window.t('tone-in-use') : '';
                });
            }
        } else {
            grid.style.display = 'none';
            toggle.classList.remove('open');
            toggle.innerHTML = '<span aria-hidden="true" class="ico ico-chevron-down ico-gap" style="width:14px;height:14px;"></span> ' + window.t('tone-browse');
        }
    }

    function openToolbox() {
        var overlay = document.getElementById('toolbox-overlay');
        if (overlay) { overlay.style.display = 'flex'; return; }
        overlay = document.createElement('div');
        overlay.id = 'toolbox-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.style.display = 'none'; });
        var panel = document.createElement('div');
        panel.style.cssText = 'background:var(--bg3);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;';
        panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><span style="font-weight:600;font-size:1.1rem;"><span class="ico ico-zap" style="width:18px;height:18px;"></span> ' + window.t('toolbox') + '</span><button class="btn-sm" onclick="this.parentElement.parentElement.parentElement.style.display=\'none\'" style="width:32px;height:32px;padding:0;">&times;</button></div>'
            + '<div style="display:flex;flex-direction:column;gap:12px;">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--border-light);border-radius:10px;"><span style="font-size:0.85rem;">' + window.t('cache-hint') + '</span><label class="plugin-toggle" style="width:36px;height:20px;"><input type="checkbox" id="toolbox-cache-hint" onchange="var c=document.getElementById(\'cache-hint-toggle\');if(c){c.checked=this.checked;c.onchange()}"><span class="toggle-slider"></span></label></div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--border-light);border-radius:10px;"><span style="font-size:0.85rem;">' + window.t('appearance') + '</span><div class="drawer-theme-options" style="gap:4px;"><button class="drawer-theme-btn btn-sm" onclick="setTheme(\'dark\')" style="padding:4px 10px;font-size:0.78rem;"><span class="ico ico-moon" style="width:12px;height:12px;"></span></button><button class="drawer-theme-btn btn-sm" onclick="setTheme(\'light\')" style="padding:4px 10px;font-size:0.78rem;"><span class="ico ico-sun" style="width:12px;height:12px;"></span></button><button class="drawer-theme-btn btn-sm" onclick="setTheme(\'system\')" style="padding:4px 10px;font-size:0.78rem;"><span class="ico ico-gear" style="width:12px;height:12px;"></span></button></div></div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--border-light);border-radius:10px;"><span style="font-size:0.85rem;">' + window.t('text-align') + '</span><div class="drawer-theme-options" id="toolbox-align-options" style="gap:4px;"><button class="align-btn btn-sm" data-align="left" onclick="setTextAlign(\'left\')" style="padding:4px 10px;font-size:0.78rem;">' + window.t('align-left') + '</button><button class="align-btn btn-sm active" data-align="center" onclick="setTextAlign(\'center\')" style="padding:4px 10px;font-size:0.78rem;">' + window.t('align-center') + '</button><button class="align-btn btn-sm" data-align="right" onclick="setTextAlign(\'right\')" style="padding:4px 10px;font-size:0.78rem;">' + window.t('align-right') + '</button></div></div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--border-light);border-radius:10px;"><span style="font-size:0.85rem;">' + window.t('font-size') + '</span><div class="drawer-theme-options" id="toolbox-font-options" style="gap:4px;"><button class="font-size-btn btn-sm" data-size="small" onclick="setFontSize(\'small\')" style="padding:4px 10px;font-size:0.78rem;">' + window.t('font-small') + '</button><button class="font-size-btn btn-sm active" data-size="medium" onclick="setFontSize(\'medium\')" style="padding:4px 10px;font-size:0.78rem;">' + window.t('font-medium') + '</button><button class="font-size-btn btn-sm" data-size="large" onclick="setFontSize(\'large\')" style="padding:4px 10px;font-size:0.78rem;">' + window.t('font-large') + '</button><button class="font-size-btn btn-sm" data-size="xlarge" onclick="setFontSize(\'xlarge\')" style="padding:4px 10px;font-size:0.78rem;">' + window.t('font-xlarge') + '</button></div></div></div>';
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        var cb = document.getElementById('cache-hint-toggle');
        var tcb = document.getElementById('toolbox-cache-hint');
        if (cb && tcb) tcb.checked = cb.checked;
    }

    function renderToneMarket() {
        var grid = document.getElementById('tone-market-grid');
        if (!grid) return;
        var currentTone = getCurrentTone();
        grid.innerHTML = TONE_LIST.map(function(item) {
            var isActive = item.id === currentTone;
            var swatch = '<div class="tone-swatch"><div class="tone-swatch-strip">' + item.colors.map(function(color) { return '<span style="background:' + color + ';"></span>'; }).join('') + '</div></div>';
            return '<div class="tone-card ' + (isActive ? 'active' : '') + '" data-tone="' + item.id + '" onclick="applyTone(\'' + item.id + '\')">' + swatch + '<div class="tone-card-name">' + window.t('tone-' + item.id) + '</div><div class="tone-card-status">' + (isActive ? window.t('tone-in-use') : '') + '</div></div>';
        }).join('');
    }

    window.getCurrentTone = getCurrentTone;
    window.loadToneCss = loadToneCss;
    window.showNotification = showNotification;
    window.applyTone = applyTone;
    window.initTone = initTone;
    window.toggleToneMarket = toggleToneMarket;
    window.openToolbox = openToolbox;
    window.renderToneMarket = renderToneMarket;

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTone);
    else initTone();

    // 健康上报：供 /plugins 管理页展示客户端自报状态
    window.__pluginHealth = window.__pluginHealth || {};
    window.__pluginHealth['appearance-tools'] = { ok: true, stage: '就绪', errors: [] };
})();
