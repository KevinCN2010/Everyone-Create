(function() {
    'use strict';

    var _topicPopupData = null;
    var _licenseLegalFull = null;
    var _assetDetailBytes = 0;
    var _assetDetailUnit = 'auto';

    function t(key) { return window.t ? window.t(key) : key; }

    // ── 话题标签弹出层 ──
    function showTopicPopup(topicsJson) {
        try {
            var topics = JSON.parse(decodeURIComponent(topicsJson));
            if (!topics || !topics.length) return;
            _topicPopupData = topics;

            var overlay = document.getElementById('topic-popup-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'topic-popup-overlay';
                overlay.innerHTML = '<div id="topic-popup"><div id="topic-popup-header"><span id="topic-popup-title">' + t('repo-topics') + '</span><button id="topic-popup-close" onclick="closeTopicPopup()"><span aria-hidden="true" class="ico ico-x-circle" style="width:16px;height:16px;"></span></button></div><div id="topic-popup-body"></div></div>';
                overlay.addEventListener('click', function(e) { if (e.target === overlay) closeTopicPopup(); });
                document.body.appendChild(overlay);
            }

            var body = document.getElementById('topic-popup-body');
            body.innerHTML = topics.map(function(topic) {
                return '<div class="topic-popup-item"><span class="topic-popup-tag">' + escHtml(topic) + '</span><span class="topic-popup-desc loading" data-topic="' + encodeURIComponent(topic) + '">' + t('loading') + '</span></div>';
            }).join('');

            if (!overlay._topicDelegate) {
                overlay._topicDelegate = true;
                body.addEventListener('click', function(e) {
                    var descEl = e.target.closest('.topic-popup-desc.collapsible');
                    if (!descEl) return;
                    e.stopPropagation();
                    var expanded = descEl.dataset.expanded === 'true';
                    descEl.dataset.expanded = expanded ? 'false' : 'true';
                    descEl.classList.toggle('expanded', !expanded);
                });
            }

            overlay.style.display = 'flex';
            topics.forEach(function(t) { _loadTopicDesc(t); });
        } catch (e) { console.error('[topic-popup]', e); }
    }

    function closeTopicPopup() {
        var overlay = document.getElementById('topic-popup-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    async function _loadTopicDesc(topic) {
        var descEl = document.querySelector('.topic-popup-desc[data-topic="' + encodeURIComponent(topic) + '"]');
        if (!descEl) return;
        try {
            var resp = await fetch('/topic-desc?topic=' + encodeURIComponent(topic));
            var data = await resp.json();
            if (data.description) {
                descEl.innerHTML = sanitizeHtml(data.description);
                if (descEl.scrollHeight > 60) {
                    descEl.classList.add('collapsible');
                    descEl.dataset.expanded = 'false';
                }
            } else { descEl.textContent = '—'; descEl.classList.add('error'); }
        } catch (e) { descEl.textContent = t('load-failed'); descEl.classList.add('error'); }
        descEl.classList.remove('loading');
    }

    // ── 许可证弹出层 ──
    async function showLicensePopup(spdxId) {
        if (!spdxId || spdxId === '—') return;
        try {
            var overlay = document.getElementById('license-popup-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'license-popup-overlay';
                overlay.innerHTML = '<div id="license-popup"><div id="license-popup-header"><span id="license-popup-title">' + t('license-detail') + '</span><button id="license-popup-close" onclick="closeLicensePopup()"><span aria-hidden="true" class="ico ico-x-circle" style="width:18px;height:18px;"></span></button></div><div id="license-popup-body"><div class="license-section" style="text-align:center;padding:30px;"><div class="spinner" style="width:24px;height:24px;border-width:3px;margin:0 auto;"></div><p style="color:var(--text-dim);margin-top:8px;">' + t('loading') + '</p></div></div></div>';
                overlay.addEventListener('click', function(e) { if (e.target === overlay) closeLicensePopup(); });
                document.body.appendChild(overlay);
            } else {
                setHTML('license-popup-body', '<div class="license-section" style="text-align:center;padding:30px;"><div class="spinner" style="width:24px;height:24px;border-width:3px;margin:0 auto;"></div><p style="color:var(--text-dim);margin-top:8px;">' + t('loading') + '</p></div>');
            }
            overlay.style.display = 'flex';
            showPopupHint(overlay);

            var resp = await fetch('/license-info?spdx_id=' + encodeURIComponent(spdxId));
            var data = await resp.json();
            if (data.error) { showNotification(t('load-failed') + ': ' + data.error, 'error'); closeLicensePopup(); return; }

            var tagHtml = function(items, cls) { return items.map(function(i) { return '<span class="license-tag ' + cls + '">' + escHtml(i) + '</span>'; }).join(''); };
            var html = '';
            html += '<div class="license-section"><div class="license-section-title"><span aria-hidden="true" class="ico ico-shield ico-green" style="width:16px;height:16px;"></span>' + escHtml(data.name || spdxId) + '</div><div class="license-section-desc">' + escHtml(data.description || '') + '</div></div>';

            if ((data.permissions && data.permissions.length) || (data.conditions && data.conditions.length) || (data.limitations && data.limitations.length)) {
                html += '<div class="license-section"><div class="license-section-title"><span aria-hidden="true" class="ico ico-tag ico-cyan" style="width:16px;height:16px;"></span>' + t('license-permissions-title') + '</div>';
                if (data.permissions && data.permissions.length) html += '<div style="margin-bottom:4px;"><span style="font-size:0.72rem;color:var(--text-dim);">' + t('permissions') + '</span><div class="license-tags">' + tagHtml(data.permissions, 'permission') + '</div></div>';
                if (data.conditions && data.conditions.length) html += '<div style="margin-bottom:4px;"><span style="font-size:0.72rem;color:var(--text-dim);">' + t('conditions') + '</span><div class="license-tags">' + tagHtml(data.conditions, 'condition') + '</div></div>';
                if (data.limitations && data.limitations.length) html += '<div style="margin-bottom:4px;"><span style="font-size:0.72rem;color:var(--text-dim);">' + t('limitations') + '</span><div class="license-tags">' + tagHtml(data.limitations, 'limitation') + '</div></div>';
                html += '</div>';
            }
            if (data.zh_description) html += '<div class="license-section"><div class="license-section-title"><span aria-hidden="true" class="ico ico-globe ico-blue" style="width:16px;height:16px;"></span>' + t('zh-description') + '</div><div class="license-section-desc">' + escHtml(data.zh_description) + '</div></div>';
            if (data.disclaimer) html += '<div class="license-disclaimer"><span aria-hidden="true" class="ico ico-alert ico-orange" style="width:14px;height:14px;vertical-align:middle;"></span> ' + escHtml(data.disclaimer) + '</div>';

            _licenseLegalFull = null;
            if (data.body) {
                var fullBody = data.body;
                var bodyPreview = fullBody.length > 500 ? fullBody.slice(0, 500) + '\n...' : fullBody;
                _licenseLegalFull = fullBody.length > 500 ? fullBody : null;
                html += '<div class="license-section"><div class="license-section-title"><span aria-hidden="true" class="ico ico-file-text ico-dim" style="width:16px;height:16px;"></span>' + t('license-legal-text') + '</div><div class="license-legal" id="license-legal-text">' + escHtml(bodyPreview) + '</div>' + (_licenseLegalFull ? '<button class="btn-sm" onclick="expandLicenseLegal()" style="margin-top:8px;display:block;width:100%;text-align:center;">' + t('expand-legal') + '</button>' : '') + '<div style="margin-top:6px;font-size:0.7rem;color:var(--text-dim);text-align:right;"><a href="https://opensource.org/licenses/' + encodeURIComponent(spdxId) + '" target="_blank" rel="noopener noreferrer">' + t('view-official-source') + ' <span aria-hidden="true" class="ico ico-external" style="width:10px;height:10px;"></span></a></div></div>';
            }

            setText('license-popup-title', data.name || spdxId);
            setHTML('license-popup-body', html);
        } catch (e) {
            console.error('[license-popup]', e);
            showNotification(t('load-failed-msg').replace('{msg}', e.message), 'error');
            closeLicensePopup();
        }
    }

    function closeLicensePopup() {
        var overlay = document.getElementById('license-popup-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    function expandLicenseLegal() {
        var el = document.getElementById('license-legal-text');
        if (!el) return;
        if (_licenseLegalFull) { el.textContent = _licenseLegalFull; el.style.maxHeight = '800px'; var btn = el.parentElement.querySelector('.btn-sm'); if (btn) btn.style.display = 'none'; }
    }

    // ── 弹出层操作提示 ──
    function showPopupHint(overlay) {
        if (!overlay) return;
        var hint = overlay.querySelector('.popup-hint');
        if (!hint) { hint = document.createElement('div'); hint.className = 'popup-hint'; hint.textContent = t('click-to-close'); overlay.appendChild(hint); }
        hint.classList.remove('popup-hint-hide');
        hint.style.display = 'block';
        void hint.offsetWidth;
        setTimeout(function() { hint.classList.add('popup-hint-hide'); setTimeout(function() { hint.style.display = 'none'; }, 400); }, 2000);
    }

    // ── 语言弹出层 ──
    function closeLanguagePopup() {
        var overlay = document.getElementById('lang-popup-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    async function showLanguagePopup(lang) {
        if (!lang || lang === '—') return;
        try {
            var overlay = document.getElementById('lang-popup-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'lang-popup-overlay';
                overlay.innerHTML = '<div id="lang-popup"><div id="lang-popup-header"><span id="lang-popup-title">' + t('lang-detail') + '</span><button id="lang-popup-close" onclick="closeLanguagePopup()"><span aria-hidden="true" class="ico ico-x-circle" style="width:18px;height:18px;"></span></button></div><div id="lang-popup-body"><div class="license-section" style="text-align:center;padding:30px;"><div class="spinner" style="width:24px;height:24px;border-width:3px;margin:0 auto;"></div><p style="color:var(--text-dim);margin-top:8px;">' + t('loading') + '</p></div></div></div>';
                overlay.addEventListener('click', function(e) { if (e.target === overlay) closeLanguagePopup(); });
                document.body.appendChild(overlay);
            } else {
                setHTML('lang-popup-body', '<div class="license-section" style="text-align:center;padding:30px;"><div class="spinner" style="width:24px;height:24px;border-width:3px;margin:0 auto;"></div><p style="color:var(--text-dim);margin-top:8px;">' + t('loading') + '</p></div>');
            }
            overlay.style.display = 'flex';
            showPopupHint(overlay);
            setText('lang-popup-title', lang + ' - ' + t('lang-detail'));

            var resp = await fetch('/language-info?lang=' + encodeURIComponent(lang));
            var data = await resp.json();
            if (data.error) { showNotification(escHtml(data.error), 'error'); closeLanguagePopup(); return; }

            var html = '';
            html += '<div class="license-section"><div class="license-section-title"><span aria-hidden="true" class="ico ico-code ico-blue" style="width:16px;height:16px;"></span>' + escHtml(data.name || lang) + '</div><div class="license-section-desc">' + escHtml(data.summary || t('no-description-short')) + '</div></div>';
            if (data.detail) html += '<div class="license-section"><div class="license-section-title"><span aria-hidden="true" class="ico ico-file-text ico-dim" style="width:16px;height:16px;"></span>' + t('detail') + '</div><div class="license-section-desc">' + escHtml(data.detail) + '</div></div>';
            if (data.features && data.features.length) html += '<div class="license-section"><div class="license-section-title"><span aria-hidden="true" class="ico ico-star ico-yellow" style="width:16px;height:16px;"></span>' + t('features') + '</div><div class="license-tags">' + data.features.map(function(f) { return '<span class="license-tag permission">' + escHtml(f) + '</span>'; }).join('') + '</div></div>';
            if (data.usage) html += '<div class="license-section"><div class="license-section-title"><span aria-hidden="true" class="ico ico-tools ico-cyan" style="width:16px;height:16px;"></span>' + t('usage') + '</div><div class="license-section-desc">' + escHtml(data.usage) + '</div></div>';
            if (data.website) html += '<div class="license-section" style="border-bottom:none;"><div style="font-size:0.8rem;"><a href="' + escAttr(data.website) + '" target="_blank" rel="noopener noreferrer">' + t('official-website') + ' <span aria-hidden="true" class="ico ico-external" style="width:12px;height:12px;"></span></a></div></div>';
            setHTML('lang-popup-body', html);
        } catch (e) {
            console.error('[language-popup]', e);
            var body = document.getElementById('lang-popup-body');
            if (body) body.innerHTML = '<div class="license-section" style="text-align:center;padding:30px;"><p style="color:var(--red);">' + t('load-failed-generic') + escHtml(e.message) + '</p></div>';
        }
    }

    // ── Release 附件详情弹出层 ──
    function encodeAssetDetail(asset) { return escAttr(encodeURIComponent(JSON.stringify(asset))); }

    function showAssetDetail(assetValue) {
        try {
            var a = typeof assetValue === 'string' ? JSON.parse(decodeURIComponent(assetValue)) : assetValue;
            if (!a || !a.name) return;
            _assetDetailBytes = a.size || 0;
            _assetDetailUnit = 'auto';
            var overlay = document.getElementById('asset-detail-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'asset-detail-overlay';
                overlay.innerHTML = '<div id="asset-detail-popup"><div id="asset-detail-header"><span id="asset-detail-title">' + t('asset-detail-title') + '</span><button id="asset-detail-close" onclick="closeAssetDetail()"><span aria-hidden="true" class="ico ico-x-circle" style="width:18px;height:18px;"></span></button></div><div id="asset-detail-body"></div></div>';
                overlay.addEventListener('click', function(e) { if (e.target === overlay) closeAssetDetail(); });
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'flex';
            showPopupHint(overlay);
            renderAssetDetail(a);
        } catch (e) { console.error('[asset-detail]', e); }
    }

    function renderAssetDetail(a) {
        var body = document.getElementById('asset-detail-body');
        var html = '<div class="license-section" style="border-bottom:none;">';
        html += '<div class="license-section-title"><span aria-hidden="true" class="ico ico-attachment ico-dim" style="width:16px;height:16px;"></span> ' + escHtml(a.name) + '</div>';

        var sizeInfo = formatBytesAuto(_assetDetailBytes);
        var sizeText = _assetDetailUnit === 'auto' ? sizeInfo.text : formatBytes(_assetDetailBytes, _assetDetailUnit);
        var UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
        var unitBtns = UNITS.map(function(u) { return '<button class="btn-sm" onclick="switchAssetUnit(\'' + u + '\',\'' + encodeURIComponent(JSON.stringify(a)) + '\')" style="padding:1px 6px;font-size:0.65rem;' + (_assetDetailUnit === u ? 'background:var(--accent);color:#fff;' : '') + '">' + u + '</button>'; }).join('');

        html += '<div class="token-detail-row"><span class="token-detail-name" style="font-size:0.8rem;color:var(--text-dim);min-width:70px;">' + t('file-size') + '</span><span style="font-size:0.85rem;color:var(--text);">' + sizeText + '</span><span style="margin-left:auto;display:flex;gap:2px;">' + unitBtns + '</span></div>';

        var rows = [
            { label: t('asset-label-filename'), value: a.name },
            { label: t('asset-label-type'), value: a.content_type || '—' },
            { label: t('asset-label-downloads'), value: a.download_count != null ? a.download_count.toLocaleString() : '—' },
            { label: t('asset-label-publish'), value: a.created_at ? formatDate(a.created_at) : '—' }
        ];
        if (a.sha256) rows.push({ label: 'SHA256', value: a.sha256, mono: true });
        rows.forEach(function(r) {
            html += '<div class="token-detail-row"><span class="token-detail-name" style="font-size:0.8rem;color:var(--text-dim);min-width:70px;">' + r.label + '</span><span style="font-size:0.85rem;color:var(--text);' + (r.mono ? 'font-family:monospace;font-size:0.75rem;word-break:break-all;' : '') + '">' + escHtml(r.value) + '</span></div>';
        });

        html += '<div style="margin-top:12px;display:flex;gap:8px;"><a href="' + proxyUrl(a.browser_download_url) + '" class="nav-button" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;font-size:0.85rem;"><span aria-hidden="true" class="ico ico-download ico-gap" style="width:14px;height:14px;"></span>' + t('download') + '</a></div>';
        html += '</div>';
        body.innerHTML = html;
    }

    function switchAssetUnit(unit, assetJson) {
        _assetDetailUnit = unit;
        try { var a = JSON.parse(decodeURIComponent(assetJson)); renderAssetDetail(a); } catch(e) { console.error('[asset-detail]', e); }
    }

    function closeAssetDetail() {
        var overlay = document.getElementById('asset-detail-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    // ── 暴露到 window ──
    window.showTopicPopup = showTopicPopup;
    window.closeTopicPopup = closeTopicPopup;
    window.showLicensePopup = showLicensePopup;
    window.closeLicensePopup = closeLicensePopup;
    window.expandLicenseLegal = expandLicenseLegal;
    window.showLanguagePopup = showLanguagePopup;
    window.closeLanguagePopup = closeLanguagePopup;
    window.showPopupHint = showPopupHint;
    window.showAssetDetail = showAssetDetail;
    window.closeAssetDetail = closeAssetDetail;
    window.renderAssetDetail = renderAssetDetail;
    window.switchAssetUnit = switchAssetUnit;
    window.encodeAssetDetail = encodeAssetDetail;

    // 健康上报：供 /plugins 管理页展示客户端自报状态
    window.__pluginHealth = window.__pluginHealth || {};
    window.__pluginHealth['info-popups'] = { ok: true, stage: '就绪', errors: [] };
})();
