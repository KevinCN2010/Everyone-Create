/**
 * traffic-predict/plugin.js — 流量预测插件
 * 在仓库仪表盘中添加流量预测标签页，基于神经网络预测流量趋势。
 */
(function () {
    'use strict';

    if (window.location.pathname !== '/repo') return;

    /* ── 健康上报 ── */
    window.__pluginHealth = window.__pluginHealth || {};
    window.__pluginHealth['traffic-predict'] = { ok: true, stage: '就绪', errors: [] };

    /* 轮询等待 tab-bar 出现后注入预测标签
     * 依赖: function.js 中的 switchTab() / loadPrediction() 全局函数（运行时轮询等待，非硬依赖）
     */
    function tryInject() {
        var tabBar = document.querySelector('.tab-bar');
        if (!tabBar) { setTimeout(tryInject, 100); return; }
        if (document.getElementById('tab-predict')) return;

        // 创建标签按钮
        var btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.setAttribute('data-tab', 'predict');
        btn.onclick = function () {
            if (typeof switchTab === 'function') switchTab('predict');
        };
        btn.innerHTML = '<svg aria-hidden="true" class="ico" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:4px;"><path d="M2.5 2.75a.75.75 0 0 0-1.5 0v18.5c0 .414.336.75.75.75H20a.75.75 0 0 0 0-1.5H2.5V2.75Z"/><path d="M22.28 7.78a.75.75 0 0 0-1.06-1.06l-5.72 5.72-3.72-3.72a.75.75 0 0 0-1.06 0l-6 6a.75.75 0 1 0 1.06 1.06l5.47-5.47 3.72 3.72a.75.75 0 0 0 1.06 0l6.25-6.25Z"/></svg> <span data-i18n="tab-predict">流量预测</span>';

        var modsBtn = tabBar.querySelector('[data-tab="mods"]');
        if (modsBtn) tabBar.insertBefore(btn, modsBtn);
        else tabBar.appendChild(btn);

        // 创建内容面板
        var firstTab = document.querySelector('.tab-content');
        if (!firstTab) { setTimeout(tryInject, 100); return; }
        var parent = firstTab.parentNode;

        var panel = document.createElement('div');
        panel.className = 'tab-content';
        panel.id = 'tab-predict';
        panel.style.display = 'none';
        panel.innerHTML = '<div class="card">'
            + '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">'
            + '<span style="font-weight:600; font-size:1rem;"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:4px;"><path d="M2.5 2.75a.75.75 0 0 0-1.5 0v18.5c0 .414.336.75.75.75H20a.75.75 0 0 0 0-1.5H2.5V2.75Z"/><path d="M22.28 7.78a.75.75 0 0 0-1.06-1.06l-5.72 5.72-3.72-3.72a.75.75 0 0 0-1.06 0l-6 6a.75.75 0 1 0 1.06 1.06l5.47-5.47 3.72 3.72a.75.75 0 0 0 1.06 0l6.25-6.25Z"/></svg> <span data-i18n="predict-title">流量预测（深度学习）</span></span>'
            + '<div style="display:flex; gap:8px; align-items:center;">'
            + '<label style="font-size:0.85rem; color:var(--text-dim);"><span data-i18n="predict-metric">指标</span>: <select id="predict-metric" onchange="loadPrediction()" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:0.85rem;"><option value="clones" data-i18n="chart-clones">Clones</option><option value="views" data-i18n="chart-views">Views</option></select></label>'
            + '<label style="font-size:0.85rem; color:var(--text-dim);"><span data-i18n="predict-days">预测天数</span>: <select id="predict-steps" onchange="loadPrediction()" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:0.85rem;"><option value="7">7</option><option value="14" selected>14</option><option value="30">30</option></select></label>'
            + '<button class="btn-sm" onclick="loadPrediction(true)" style="font-size:0.8rem;"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> <span data-i18n="predict-retrain">重新训练</span></button>'
            + '</div></div>'
            + '<div style="width:100%; max-width:100%; overflow-x:auto;"><canvas id="predict-chart" width="700" height="280" style="width:100%; height:auto; max-width:700px; display:block; margin:0 auto; background:var(--bg2); border-radius:8px;"></canvas></div>'
            + '<div id="predict-status" style="text-align:center; padding:12px; color:var(--text-dim); font-size:0.85rem;" data-i18n="predict-loading">正在加载预测数据...</div>'
            + '<div id="predict-loss-container" style="display:none; margin-top:12px;"><details style="font-size:0.8rem;"><summary style="cursor:pointer; color:var(--text-dim);"><span data-i18n="predict-loss-title">训练损失曲线</span></summary><div style="margin-top:8px;"><canvas id="predict-loss-chart" width="700" height="140" style="width:100%; height:auto; max-width:700px; background:var(--bg2); border-radius:8px;"></canvas></div></details></div>'
            + '</div>';
        parent.appendChild(panel);
    }

    // 立即启动轮询，不依赖任何事件
    setTimeout(tryInject, 50);

})();
