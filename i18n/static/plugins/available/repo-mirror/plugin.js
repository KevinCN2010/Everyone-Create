/**
 * repo-mirror/plugin.js — 仓库镜像浏览插件
 * 在 GitAAP 内部以仪表盘风格浏览任意 GitHub 仓库文件。
 * 通过插件注册表 config 读取配置，调用后端 API 获取仓库文件树。
 */
(function () {
    'use strict';

    var CONFIG = null;

    /* 从 manifest 加载配置 */
    function loadConfig(callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/static/plugins/available/repo-mirror/manifest.json?_=' + Date.now(), true);
        xhr.onload = function () {
            if (xhr.status === 200) {
                try { CONFIG = JSON.parse(xhr.responseText); } catch (e) { CONFIG = null; }
            }
            if (callback) callback(CONFIG);
        };
        xhr.onerror = function () { if (callback) callback(null); };
        xhr.send();
    }

    /* 检测当前页面是否为镜像页 */
    function isMirrorPage() {
        return window.location.pathname === '/repo-mirror';
    }

    /* 获取 URL 参数 */
    function getQueryParam(name) {
        var m = window.location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
        return m ? decodeURIComponent(m[1]) : '';
    }

    /* 初始化镜像页面 */
    function initMirror() {
        if (!isMirrorPage()) return;
        var repo = getQueryParam('repo');
        if (!repo) return;

        // 等待 function.js 加载完成后调用文件树加载
        var waitLoad = function () {
            if (typeof loadFileTree === 'function') {
                loadFileTree(repo, '');
            } else {
                setTimeout(waitLoad, 300);
            }
        };
        setTimeout(waitLoad, 500);
    }

    /* ── 健康上报 ── */
    window.__pluginHealth = window.__pluginHealth || {};
    window.__pluginHealth['repo-mirror'] = { ok: true, stage: '就绪', errors: [] };

    /* 插件启动
     * 依赖: function.js 中的 loadFileTree() 全局函数（运行时轮询等待，非硬依赖）
     */
    loadConfig(function (cfg) {
        if (!cfg || cfg.enabled === false) return;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initMirror);
        } else {
            initMirror();
        }
    });

})();
