/**
 * captcha-verify/plugin.js — 人机验证插件（弹窗版）
 * ==================================================
 * 集成 TAC (Tianai-Captcha) 文字语序点选验证码。
 *
 * 行为：
 *   1. 页面加载后自动弹出验证码遮罩层（不再依赖抽屉容器）
 *   2. 用户完成验证后遮罩关闭，状态存入全局变量
 *   3. 网络/接口异常时显示 Toast 通知
 *   4. 提供 window.requireCaptcha() 供其他脚本主动调用
 *
 * 全局 API：
 *   window._captchaPassed  — boolean 是否已验证通过
 *   window._captchaToken   — string  一次性验证凭证
 *   window.requireCaptcha(callback) — 主动弹出验证，通过后执行 callback
 */
(function() {
    'use strict';

    /* ═══════════════════════════════════════════════════
       自检系统 — 每个阶段输出状态，并通过全局 API 暴露
       插件管理页 /plugins 会读取 window.__pluginHealth 渲染状态
       ═══════════════════════════════════════════════════ */
    var _SELF_CHECK = { stage: 'init', ok: true, errors: [] };

    // 注册到全局健康检查中心，供 manager.js 读取
    window.__pluginHealth = window.__pluginHealth || {};
    window.__pluginHealth['captcha-verify'] = _SELF_CHECK;

    function _log(msg, type) {
        var prefix = '[captcha-verify]';
        if (type === 'ok')   { console.log('%c' + prefix + ' ✅ ' + msg, 'color:#3fb950'); }
        else if (type == 'warn') { console.warn(prefix + ' ⚠️ ' + msg); }
        else if (type == 'err')  {
            console.error(prefix + ' ❌ ' + msg);
            _SELF_CHECK.ok = false;
            _SELF_CHECK.errors.push(msg);
            _SELF_CHECK.stage = 'error';
            _SELF_CHECK.checked_at = Date.now();
        }
        else { console.log(prefix + ' ' + msg); }
        _SELF_CHECK.stage = msg;
        _SELF_CHECK.checked_at = Date.now();
    }
    _log('插件启动 v1.0.0, DOM 状态: ' + document.readyState, 'ok');

    // ── 不在管理员页面弹出验证码 ──
    var _path = window.location.pathname;
    if (_path === '/admin' || _path === '/admin/manage' || _path.startsWith('/admin/')) {
        _log('管理员页面，跳过验证码初始化', 'ok');
        return;
    }

    /* ── 配置 ── */
    var TAC_CDN_BASE = 'https://cdn.jsdelivr.net/npm/captcha-web-sdk@1.0.11/dist/tac';
    var TAC_API_BASE = window.location.origin;

    /* ── 全局状态 ── */
    window._captchaPassed = false;
    window._captchaToken  = null;
    window._tacToken      = null;

    var _tacInstance   = null;   // TAC SDK 实例
    var _modalEl       = null;   // 遮罩层 DOM
    var _pendingCb     = null;   // 待执行的验证回调

    /* ═══════════════════════════════════════════════════
       弹窗 UI（纯 JS 构建，不依赖模板）
       ═══════════════════════════════════════════════════ */
    function buildModal() {
        if (_modalEl) return _modalEl;

        var overlay = document.createElement('div');
        overlay.id = 'tac-modal-overlay';
        overlay.style.cssText = [
            'position:fixed; inset:0; z-index:99999;',
            'background:rgba(0,0,0,0.55);',
            'display:flex; align-items:center; justify-content:center;',
            'padding:20px;',
            'backdrop-filter:blur(2px);',
            'opacity:0; transition:opacity 0.3s ease;',
        ].join('');

        var panel = document.createElement('div');
        panel.id = 'tac-modal-panel';
        panel.style.cssText = [
            'background:var(--bg3,#161b22);',
            'border:1px solid var(--border,#30363d);',
            'border-radius:18px;',
            'padding:28px 24px 20px;',
            'max-width:440px; width:100%;',
            'box-shadow:0 16px 48px rgba(0,0,0,0.35);',
            'text-align:center;',
            'transform:translateY(20px) scale(0.96);',
            'transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1);',
        ].join('');

        panel.innerHTML = ''
            + '<div style="margin-bottom:8px;">'
            +   '<span style="font-size:2rem;">🛡️</span>'
            + '</div>'
            + '<h3 style="margin:0 0 4px;font-size:1.1rem;color:var(--text-bright,#fff);">请完成安全验证</h3>'
            + '<p style="margin:0 0 16px;font-size:0.82rem;color:var(--text-dim,#8b98a6);">按顺序点击图片中的指定文字，以确认您是真人操作</p>'
            + '<div id="tac-modal-body" style="min-height:80px;"></div>'
            + '<div id="tac-modal-error" style="display:none;margin-top:10px;padding:8px 12px;border-radius:8px;font-size:0.82rem;background:rgba(248,81,73,0.15);color:var(--red,#f85149);"></div>'
            + '<button id="tac-modal-close" style="margin-top:14px;background:transparent;border:1px solid var(--border,#30363d);color:var(--text-dim,#8b98a6);padding:6px 16px;border-radius:8px;cursor:pointer;font-size:0.82rem;display:none;">取消</button>';

        overlay.appendChild(panel);

        // 点击遮罩不关闭（防止误触打断验证）
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                if (!window._captchaPassed) return;
                hideModal();
            }
        });

        // 关闭按钮事件
        var closeBtn = document.getElementById('tac-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                hideModal();
                window._captchaPassed = false;
                // 出错时用户手动关闭，清空待办回调
                _pendingCb = null;
            });
        }

        document.body.appendChild(overlay);
        _modalEl = overlay;
        return overlay;
    }

    function showModal() {
        var overlay = buildModal();
        _log('弹窗遮罩已弹出，准备初始化验证码', 'ok');
        overlay.style.display = 'flex';
        // 触发入场动画
        requestAnimationFrame(function() {
            overlay.style.opacity = '1';
            var panel = document.getElementById('tac-modal-panel');
            if (panel) {
                panel.style.transform = 'translateY(0) scale(1)';
            }
        });
        // 初始化验证码
        initCaptchaInModal();
    }

    function hideModal() {
        var overlay = document.getElementById('tac-modal-overlay');
        if (!overlay) return;
        overlay.style.opacity = '0';
        var panel = document.getElementById('tac-modal-panel');
        if (panel) {
            panel.style.transform = 'translateY(20px) scale(0.96)';
        }
        setTimeout(function() { overlay.style.display = 'none'; }, 300);
    }

    function showModalError(msg) {
        var errEl = document.getElementById('tac-modal-error');
        if (!errEl) return;
        errEl.textContent = msg;
        errEl.style.display = 'block';
        // 显示取消按钮（只有出错时才允许关闭）
        var closeBtn = document.getElementById('tac-modal-close');
        if (closeBtn) closeBtn.style.display = 'inline-block';
    }

    function hideModalError() {
        var errEl = document.getElementById('tac-modal-error');
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        var closeBtn = document.getElementById('tac-modal-close');
        if (closeBtn) closeBtn.style.display = 'none';
    }

    /* ═══════════════════════════════════════════════════
       全局 API：其他脚本调用此函数弹出验证
       ═══════════════════════════════════════════════════ */
    window.requireCaptcha = function(callback) {
        if (window._captchaPassed) {
            if (callback) callback(window._captchaToken);
            return;
        }
        _pendingCb = callback;
        showModal();
    };

    /* ═══════════════════════════════════════════════════
       Toast 通知
       ═══════════════════════════════════════════════════ */
    var _toastTimer = null;

    function showToast(msg, type) {
        var old = document.getElementById('tac-toast');
        if (old) old.remove();
        if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }

        var toast = document.createElement('div');
        toast.id = 'tac-toast';
        var bgColor = type === 'error' ? 'rgba(248,81,73,0.95)'
                    : type === 'success' ? 'rgba(63,185,80,0.95)'
                    : 'rgba(255,140,66,0.95)';
        toast.style.cssText = [
            'position:fixed; bottom:30px; left:50%; transform:translateX(-50%);',
            'z-index:100000;',
            'padding:12px 24px; border-radius:12px;',
            'background:' + bgColor + '; color:#fff;',
            'font-size:0.9rem; font-family:system-ui,sans-serif;',
            'box-shadow:0 4px 20px rgba(0,0,0,0.3);',
            'white-space:nowrap; max-width:90vw; overflow:hidden; text-overflow:ellipsis;',
            'animation: tacToastIn 0.3s ease;',
        ].join('');
        toast.textContent = msg;
        document.body.appendChild(toast);

        _toastTimer = setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
            _toastTimer = null;
        }, 4000);
    }

    // 注入 Toast 动画
    if (!document.getElementById('tac-toast-style')) {
        var style = document.createElement('style');
        style.id = 'tac-toast-style';
        style.textContent = '@keyframes tacToastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
        document.head.appendChild(style);
    }

    /* ═══════════════════════════════════════════════════
       TAC 初始化（在弹窗内渲染）
       ═══════════════════════════════════════════════════ */
    function initCaptchaInModal() {
        if (typeof TAC === 'undefined') {
            // 检查是否已超时（30秒）
            if (!window._tacInitStart) window._tacInitStart = Date.now();
            if (Date.now() - window._tacInitStart > 30000) {
                _log('TAC SDK 加载超时（30秒）', 'err');
                showModalError('验证码加载超时，请刷新页面重试');
                return;
            }
            _log('TAC SDK 尚未加载，1秒后重试', 'warn');
            showModalError('验证码 SDK 加载中，请稍候...');
            setTimeout(initCaptchaInModal, 1000);
            return;
        }
        _log('TAC SDK 就绪，开始初始化验证码', 'ok');

        var body = document.getElementById('tac-modal-body');
        if (!body) return;
        body.innerHTML = '';
        hideModalError();

        var config = {
            requestCaptchaDataUrl: TAC_API_BASE + '/tac/get',
            validCaptchaUrl:       TAC_API_BASE + '/tac/check',
            bindEl:               '#tac-modal-body',
            type:                 'WORD_IMAGE_CLICK',

            validSuccess: function(res) {
                _log('验证码校验成功，用户已通过人机验证', 'ok');
                var data = res && res.data;
                var token = data ? (data.captchaToken || data.id) : null;

                window._captchaPassed = true;
                window._captchaToken  = token;
                window._tacToken      = token;

                // 更新抽屉状态
                var st = document.getElementById('tac-status');
                if (st) st.innerHTML = '<span style="color:var(--green);font-weight:500;">✅ 验证通过</span>';

                showToast('✅ 验证通过', 'success');
                hideModal();

                // 执行待办回调
                if (_pendingCb) {
                    var cb = _pendingCb;
                    _pendingCb = null;
                    cb(token);
                }
            },

            validFail: function(res, c, tac) {
                _log('验证码校验失败，用户操作有误', 'warn');
                showModalError('❌ 验证失败，请重新操作');
                if (tac && tac.reloadCaptcha) {
                    setTimeout(function() { tac.reloadCaptcha(); }, 1000);
                }
            }
        };

        try {
            _tacInstance = new TAC(config);
            _tacInstance.init();
            _log('TAC 实例创建并初始化完成', 'ok');
        } catch (e) {
            _log('TAC 初始化异常: ' + (e.message || '未知错误'), 'err');
            console.error('[captcha-verify] TAC init error:', e);
            showModalError('⚠️ 验证码初始化失败: ' + (e.message || '未知错误'));
        }
    }

    /* ═══════════════════════════════════════════════════
       首次加载后自动弹出验证
       ═══════════════════════════════════════════════════ */
    function autoTrigger() {
        if (window._captchaPassed) return;
        _log('页面加载完毕，准备弹出验证码（延迟1.5秒）', 'ok');
        setTimeout(function() {
            showModal();
        }, 1500);
    }

    /* ═══════════════════════════════════════════════════
       加载 CDN 依赖
       ═══════════════════════════════════════════════════ */
    function loadScript(src, callback) {
        var s = document.createElement('script');
        s.src = src;
        s.async = false;
        s.onload = function() {
            _log('CDN 脚本加载成功: ' + src.split('/').pop(), 'ok');
            if (callback) callback();
        };
        s.onerror = function() {
            _log('CDN 脚本加载失败: ' + src, 'err');
            showToast('⚠️ 验证码 SDK 加载失败，请刷新页面重试', 'error');
            showModalError('SDK 网络加载失败，请检查网络后重试');
        };
        document.head.appendChild(s);
    }

    function loadCSS(href) {
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for (var i = 0; i < links.length; i++) {
            if (links[i].href.indexOf(href) !== -1) return;
        }
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href + '?_=' + Date.now();
        document.head.appendChild(link);
    }

    function bootstrap() {
        _log('开始加载 TAC 静态资源（CSS + JS）', 'ok');
        loadCSS(TAC_CDN_BASE + '/css/tac.css');

        if (typeof jQuery === 'undefined') {
            loadScript('https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js', function() {
                loadScript(TAC_CDN_BASE + '/js/tac.min.js', autoTrigger);
            });
        } else {
            loadScript(TAC_CDN_BASE + '/js/tac.min.js', autoTrigger);
        }
    }

    /* ── 启动 ── */
    if (document.readyState === 'complete') {
        setTimeout(bootstrap, 500);
    } else {
        window.addEventListener('load', function() { setTimeout(bootstrap, 600); });
    }

})();
