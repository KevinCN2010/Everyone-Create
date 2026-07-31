// ═══════════════════════════════════════════════════
//  i18n 系统 — 按需加载 JSON 语言文件，避免一次性加载多语言
// ═══════════════════════════════════════════════════

let currentLang = localStorage.getItem('gitaap_lang') || 'zh';
// 优先使用 URL 参数中的语言设置（页面刷新时传递）
const langParam = new URLSearchParams(window.location.search).get('lang');
if (langParam === 'zh' || langParam === 'en' || langParam === 'zh-Hant') {
    currentLang = langParam;
    localStorage.setItem('gitaap_lang', currentLang);
}
let langData = {};
let _langReqId = 0;


// 内嵌英文翻译兜底，确保 en.json 文件不可访问时英文仍能正常工作
const FALLBACK_EN = {
  "home": "Home",
  "landing-tagline": "GitHub Repository Traffic & Info Dashboard",
  "landing-desc": "GitAAP continuously collects traffic, release and collaboration data from GitHub repositories, bringing information scattered across many pages into one readable dashboard.",
  "landing-cta-dashboard": "Open Dashboard",
  "landing-cta-docs": "Developer Docs",
  "landing-features-title": "Core Features",
  "feature-traffic-title": "Traffic Trends",
  "feature-traffic-desc": "Collects daily views and clones and keeps the full history, working around GitHub's 14-day retention limit.",
  "feature-browse-title": "Deep Repository Browsing",
  "feature-browse-desc": "Commits, issues, pull requests, releases and the source tree — all readable without leaving for GitHub.",
  "feature-token-title": "Multi-Token Scheduling",
  "feature-token-desc": "Picks the token with the most remaining quota, switches automatically when exhausted, and reports live usage.",
  "feature-predict-title": "Trend Forecasting",
  "feature-predict-desc": "Trains a model on historical traffic to project upcoming views and clones.",
  "feature-plugin-title": "Plugin System",
  "feature-plugin-desc": "Features ship as plugins you enable on demand, optionally scoped to specific repositories.",
  "feature-i18n-title": "Languages & Themes",
  "feature-i18n-desc": "Switch between Simplified Chinese, Traditional Chinese and English, with dark, light and multiple tone options.",
  "landing-overview-title": "Monitoring Overview",
  "landing-stat-repos": "Repositories",
  "landing-stat-stars": "Total Stars",
  "landing-stat-forks": "Total Forks",
  "landing-repos-title": "Quick Access",
  "landing-repos-hint": "The full repository list with search and filters lives in the menu at the top right.",
  "repository": "Repository: ",
  "loading": "Loading...",
  "stars": "Stars",
  "forks": "Forks",
  "open-issues": "Issues",
  "watchers": "Watchers",
  "default-branch": "Default Branch",
  "latest-releases": "Releases",
  "recent-commits": "Recent Commits",
  "open-issues-title": "<span class=\"ico ico-issue ico-green\"></span> Open Issues",
  "open-prs-title": "<span class=\"ico ico-pr ico-blue\"></span> Open Pull Requests",
  "title": "Title",
  "status": "Status",
  "labels": "Labels",
  "updated": "Updated",
  "warning": "Warning: ",
  "no-token-warning": "GITHUB_TOKEN not configured. API rate limited to 60 requests/hour.",
  "no-releases": "No releases yet",
  "no-commits": "No commits yet",
  "no-issues": "No issues",
  "no-prs": "No pull requests",
  "load-failed": "Load failed",
  "no-description": "No description",
  "prerelease": "Pre-release",
  "draft": "Draft",
  "released": "Released",
  "click-to-expand": "Click to expand",
  "collapse": "Collapse",
  "release-detail": "Release Details",
  "by": "By",
  "view-on-github": "View on GitHub",
  "release-notes": "Release Notes",
  "source-code": "Source Code",
  "attachments": "Attachments",
  "back-to-dashboard": "Back to Dashboard",
  "download": "<span class=\"ico ico-download\"></span> Download",
  "downloads": "downloads",
  "size": "Size",
  "open": "Open",
  "archived": "Archived",
  "disabled": "Disabled",
  "pr-detail": "Pull Request Details",
  "additions": "<span class=\"ico ico-plus ico-green\"></span> Additions",
  "deletions": "<span class=\"ico ico-dash ico-red\"></span> Deletions",
  "changed-files": "Changed Files",
  "commits": "Commits",
  "branch-info": "Branch Info",
  "pr-description": "Description",
  "changed-files-list": "Changed Files List",
  "commit-history": "Commit History",
  "reviews": "Reviews",
  "retry": "Retry",
  "merged": "Merged",
  "closed": "Closed",
  "opened": "Open",
  "approved": "Approved",
  "changes-requested": "Changes Requested",
  "commented": "Commented",
  "pending": "Pending",
  "base": "Base Branch",
  "head": "Head Branch",
  "no-files": "No file changes",
  "no-commits-list": "No commits",
  "no-reviews": "No reviews",
  "commit-detail": "<span class=\"ico ico-commit\"></span> Commit Details",
  "commit-message-title": "<span class=\"ico ico-file-code\"></span> Full Commit Message",
  "load-more": "Load More",
  "prev-page": "<span class=\"ico ico-arrow-left ico-gap\"></span>Prev",
  "next-page": "Next<span class=\"ico ico-arrow-right ico-gap\"></span>",
  "file-view": "File View",
  "edit-on-github": "<span class=\"ico ico-paste\"></span> Edit on GitHub",
  "readonly-notice": "<span class=\"ico ico-alert ico-orange\"></span> Read-only: ",
  "edit-hint": "This page is for viewing only. To edit, please visit GitHub.",
  "browser": "<span class=\"ico ico-folder\"></span> File Browser",
  "readme": "<span class=\"ico ico-note\"></span> README",
  "tabs-releases": "<span class=\"ico ico-tag ico-cyan\"></span> Releases",
  "tabs-commits": "<span class=\"ico ico-commit\"></span> Commits",
  "tabs-issues": "<span class=\"ico ico-issue ico-green\"></span> Issues",
  "tabs-prs": "<span class=\"ico ico-pr ico-blue\"></span> Pull Requests",
  "loading-tree": "Loading directory...",
  "no-files-in-dir": "Empty directory",
  "go-to-parent": "<span class=\"ico ico-folder\"></span> .. (Parent)",
  "select-branch": "Select Branch",
  "programming-lang": "Programming Languages",
  "no-lang-data": "No language data",
  "load-failed-short": "Load failed",
  "current-branch": "Current",
  "switch-branch": "Switch",
  "collapse-list": "Collapse",
  "source-code-zip": "Source code (zip)",
  "source-code-tar": "Source code (tar.gz)",
  "img-load-failed": "Image load failed",
  "issues-open": "Open",
  "issues-closed": "Closed",
  "pr-draft": "Draft",
  "loading-file": "Loading...",
  "page-title-dashboard": "GitHub Repository Dashboard",
  "page-title-pr": "PR #{{ number }} - {{ repo }}",
  "js-fallback-title": "Page load failed",
  "js-fallback-desc": "JavaScript failed to start. This may be a network issue or script error.",
  "js-fallback-hint": "Try refreshing the page, or check if the service is running.",
  "file-size": "Size",
  "update-interval": "Auto-refresh every 120s",
  "load-low": "Low",
  "load-medium": "Medium",
  "load-high": "High",
  "load": "Load",
  "past-24h": "Past 24h",
  "requests": "requests",
  "remaining": "Remaining",
  "click-for-detail": "Click for details",
  "timeout-error": "Request timed out. Please check network or server status.",
  "network-error": "Network error: ",
  "preview": "Preview",
  "source": "Source",
  "audio-prev": "Previous",
  "audio-next": "Next",
  "speed": "Speed",
  "translate": "<span class=\"ico ico-globe ico-gap\" style=\"width:14px;height:14px;\"></span> Translate",
  "original": "🔤 Original",
  "translating": "⏳ Translating...",
  "translate-failed": "<span class=\"ico ico-x-circle ico-gap\" style=\"width:14px;height:14px;\"></span> Translation failed",
  "binary-preview-unavailable": "Preview not available for this file type. Please download to view.",
  "page-title-index": "GitHub Mirror Status",
  "page-subtitle-index": "Real-time repository snapshots via API",
  "menu": "Menu",
  "repo-overview": "Repository Overview",
  "appearance": "Appearance",
  "dark": "Dark",
  "light": "Light",
  "system": "System",
  "language": "Language",
  "api-status": "API Status",
  "detail-stats": "Detailed Stats",
  "no-repos-configured": "No repositories configured",
  "set-repos-env": "Please set the REPOS environment variable",
  "latest-release": "Latest release:",
  "archived-short": "Archived",
  "stars-short": "Stars",
  "forks-short": "Forks",
  "issues-short": "Issues",
  "watchers-short": "Watchers",
  "branch-short": "Branch",
  "repo-stats": "Repository Stats",
  "toolbox": "Toolbox",
  "toolbox-open": "Open",
  "personalize": "Personalize",
  "tone": "Tone",
  "browse-tones": "Browse Tones",
  "links": "Links",
  "token-stats": "Token Usage Stats",
  "view-stargazers": "View stargazers",
  "view-forks": "View forks",
  "font-size": "Font Size",
  "font-small": "Small",
  "font-medium": "Medium",
  "font-large": "Large",
  "font-xlarge": "X-Large",
  "text-align": "Text Align",
  "align-left": "Left",
  "align-center": "Center",
  "align-right": "Right",
  "cache-hint": "Cache Hit Hint",
  "cache-hit": "Cache hit <span class=\"ico ico-check ico-gap\" style=\"width:14px;height:14px;\"></span> Faster load",
  "cache-miss": "Cache miss ● Please wait",
  "tab-predict": "Traffic Prediction",
  "predict-title": "Traffic Prediction (Deep Learning)",
  "predict-metric": "Metric",
  "predict-days": "Forecast Days",
  "predict-retrain": "Retrain Model",
  "predict-loading": "Loading prediction data...",
  "predict-loss-title": "Training Loss Curve",
  "page-title-token-stats": "API Usage Statistics",
  "stats-title": "API Usage Statistics",
  "stats-loading": "Loading data...",
  "stats-overview": "Overview",
  "stats-chart": "Load Chart",
  "stats-table": "Detail Table",
  "stats-24h-requests": "Requests in 24h",
  "stats-unique-ips": "Unique IPs",
  "stats-hourly-quota": "Hourly Quota",
  "stats-api-remaining": "API Remaining",
  "stats-auto-refresh": "Auto-refresh",
  "stats-last-update": "Last update:",
  "stats-realtime": "Realtime",
  "stats-24h": "24 Hours",
  "stats-30d": "30 Days",
  "stats-time": "Time",
  "stats-requests": "Requests",
  "stats-change": "Change",
  "stats-ips": "IPs",
  "stats-load": "Load",
  "stats-date": "Date",
  "stats-no-data": "No data",
  "stats-timeout": "Timeout",
  "stats-failed": "Failed",
  "stats-loading-minutes": "Loading minute data...",
  "stats-loading-hours": "Loading hour data...",
  "stats-loading-days": "Loading day data...",
  "stats-chart-realtime": "<span class=\"ico ico-bar-chart ico-cyan ico-gap\" style=\"width:16px;height:16px;\"></span> Realtime Minute Load",
  "stats-chart-24h": "<span class=\"ico ico-bar-chart ico-cyan ico-gap\" style=\"width:16px;height:16px;\"></span> Hourly Load",
  "stats-chart-30d": "<span class=\"ico ico-bar-chart ico-cyan ico-gap\" style=\"width:16px;height:16px;\"></span> Monthly Review",
  "stats-table-realtime": "<span class=\"ico ico-clipboard ico-dim ico-gap\" style=\"width:16px;height:16px;\"></span> Per-minute Details",
  "stats-table-24h": "<span class=\"ico ico-clipboard ico-dim ico-gap\" style=\"width:16px;height:16px;\"></span> Hourly Details",
  "stats-table-30d": "<span class=\"ico ico-clipboard ico-dim ico-gap\" style=\"width:16px;height:16px;\"></span> Daily Summary",
  "stats-subtitle-realtime": "Last 60 minutes, minute by minute",
  "stats-subtitle-24h": "Last 24 hours, hour by hour",
  "stats-subtitle-30d": "Last 30 days, daily total",
  "token-detail": "Token Details",
  "token-fetch-failed": "Failed to fetch token data",
  "token-quota-title": "Hourly Quota · Token Contribution",
  "token-remaining-title": "API Remaining · Token Usage",
  "token-total-quota": "Total Quota",
  "token-total-remaining": "Total Remaining",
  "token-tip": "<span class=\"ico ico-info ico-gap\" style=\"width:14px;height:14px;\"></span> Hourly limit = single limit × token count.<br>Currently {count} tokens, each 5000/h, total <strong>{limit}/h</strong>.",
  "token-config-tip": "<span class=\"ico ico-key ico-gap\" style=\"width:14px;height:14px;\"></span> Token configuration is in <code>.env</code> <code>GITHUB_TOKENS</code>,<br>Format: <code>name=ghp_xxx,name2=ghp_yyy</code>",
  "token-current": "⬅ Current",
  "token-permanent": "<span class=\"ico ico-check ico-dim ico-gap\" style=\"width:14px;height:14px;\"></span> Permanent",
  "token-expired": "<span class=\"ico ico-alert ico-gap\" style=\"width:14px;height:14px;\"></span> Expired",
  "token-count": "{count} tokens",
  "drawer-fetch-failed": "Unable to fetch",
  "drawer-load-failed": "Load failed",
  "drawer-remaining": "Remaining",
  "drawer-more-options": "More Options",
  "drawer-nav-repo": "Repo",
  "drawer-nav-personalize": "Personalize",
  "drawer-nav-display": "Display",
  "drawer-nav-lang": "Language",
  "drawer-nav-tools": "Tools",
  "drawer-nav-admin": "Admin",
  "tone-ocean": "Ocean Blue",
  "tone-forest": "Forest Green",
  "tone-sunset": "Sunset Orange",
  "tone-midnight": "Midnight Purple",
  "tone-sakura": "Sakura Pink",
  "tone-loading": "⏳ Loading...",
  "tone-in-use": "<span class=\"ico ico-check ico-gap\" style=\"width:14px;height:14px;\"></span> In use",
  "tone-load-failed": "<span class=\"ico ico-x-circle ico-gap\" style=\"width:14px;height:14px;\"></span> Load failed",
  "tone-collapse": "▴ Collapse tones",
  "tone-browse": "▾ Browse tones",
  "detail-no-records": "No {type} records",
  "file-empty": "(Empty file)",
  "file-source": "Source",
  "file-preview": "Preview",
  "file-download-title": "Download this file",
  "file-close": "Close",
  "search-placeholder": "Search author or repo...",
  "theme-toggle": "Switch theme",
  "close": "Close",
  "language-zh": "中文",
  "language-en": "English",
  "language-zh-hant": "Traditional Chinese",
  "tone-activated": "已应用",
  "font-applied": "已应用",
  "unknown-short": "Unknown",
  "add-token-title": "手动添加 Token",
  "add-token-desc": "输入你的 GitHub Token 以增加 API 配额，Token 仅保存在内存中，重启后失效。",
  "add-token-placeholder": "ghp_xxx...",
  "add-token-name-placeholder": "名称（可选）",
  "add-token-btn": "添加",
  "issue-detail": "Issue Details",
  "issue-description": "Description",
  "issue-comments": "Comments",
  "assignees": "Assignees",
  "comments": "Comments",
  "reactions": "Reactions",
  "page-title-issue": "Issue #{{ number }} - {{ repo }}",
  "click-lang-detail": "点击查看语言详情",
  "click-license-detail": "点击查看许可证详情",
  "asset-detail-title": "文件详情",
  "asset-label-filename": "文件名",
  "asset-label-type": "类型",
  "asset-label-downloads": "下载次数",
  "asset-label-publish": "发布时间",
  "token-added": "✓ Token 已添加，总配额已更新",
  "license-detail": "许可证详情",
  "load-failed-msg": "加载失败: {msg}",
  "click-to-close": "点击空白区域可关闭",
  "lang-detail": "编程语言详情",
  "502-title": "服务重启中 - GitAAP",
  "502-heading": "服务正在重启",
  "502-desc": "GitAAP 正在重启以应用更新，请稍候片刻后刷新页面。",
  "502-hint": "自动刷新中...",
  "token-input-placeholder": "请输入 Token",
  "token-invalid-format": "Token 格式不正确",
  "token-adding": "添加中...",
  "chart-requests": "请求数",
  "chart-views": "浏览",
  "chart-clones": "克隆",
  "permissions": "允许：",
  "conditions": "条件：",
  "limitations": "限制：",
  "expand-legal": "展开全文",
  "collapse-legal": "收起",
  "chart-load": "负载",
  "chart-change": "环比",
  "license-permissions-title": "权限 · 条件 · 限制",
  "legal-title": "Site Disclaimer",
  "legal-site-notice": "This website is a learning and research project. It does NOT provide proxy, traffic forwarding, or any illegal services.",
  "legal-status-title": "Service Status Notice:",
  "legal-item-1": "Before the official release, no guarantee of service effectiveness, reliability, or availability;",
  "legal-item-2": "Service may be interrupted, modified, or terminated at any time without notice;",
  "legal-item-3": "We do NOT guarantee data security; do not enter sensitive information;",
  "legal-item-4": "By using this site you accept the above terms.",
  "legal-accept": "I Understand & Continue",
  "cookie-text": "This site uses cookies for theme preferences and session state. By continuing you agree to the cookie policy.",
  "cookie-accept": "Got it",
  "admin-login-title": "Admin Login - GitAAP",
  "admin-login-heading": "Admin Login",
  "admin-login-desc": "Enter password to access admin panel.",
  "admin-password-label": "Password",
  "admin-login-btn": "Login",
  "back-to-home": "← Back to Home",
  "admin-manage-title": "Admin Panel - GitAAP",
  "admin-manage-heading": "Admin Panel",
  "admin-logout": "Logout",
  "admin-plugin-manager": "Plugin Manager",
  "admin-plugins-loading": "Loading plugin list...",
  "admin-plugins-loading-list": "Loading...",
  "admin-tips": "Tips",
  "admin-tip-plugin-toggle": "Toggle switches to enable/disable plugins. No restart needed.",
  "admin-tip-password": "Login password is configured in the ADMIN_PASSWORD environment variable.",
  "dev-docs": "Developer Docs",
  "page-title-user": "User Detail - GitAAP",
  "user-detail": "User Detail",
  "loading-user": "Loading user info...",
  "followers": "Followers",
  "following": "Following",
  "repos": "Repos",
  "gists": "Gists",
  "user-repos": "Public Repositories",
  "user-repos-empty": "This user has no public repositories",
  "view-github-profile": "View GitHub Profile",
  "plugins": "Plugin Manager",
  "plugins-status": "Plugin Status",
  "admin": "Admin",
  "admin-login": "Admin Login",
  "captcha": "Captcha",
  "docs-page-title": "Developer Docs - GitAAP",
  "docs-loading": "Loading docs...",
  "docs-case-sensitive": "Case sensitive",
  "docs-title-only": "Title only",
  "docs-search-hint": "Press Enter or click search button after typing",
  "docs-prev": "Previous",
  "docs-next": "Next",
  "docs-title": "Developer Documentation",
  "page-title-plugins": "Plugin Manager - GitAAP",
  "plugins-page-title": "Plugin Manager",
  "plugins-loading-list": "Loading plugin list...",
  "plugins-loading": "Loading...",
  "index-loading": "Loading...",
  "docs-toc-empty": "No table of contents",
  "docs-config-error": "Configuration error",
  "docs-render-error": "Render error",
  "docs-load-failed": "Load failed",
  "docs-refresh": "Refresh page",
  "docs-no-results": "No matching results",
  "admin-no-plugins": "No plugins installed",
  "docs-loading-file": "Loading document...",
  "docs-token-missing": "Document token missing. Please refresh the page.",
  "docs-auth-failed": "Authentication failed. Please refresh the page.",
  "docs-file-not-found": "Document file not found.",
  "docs-render-error-desc": "Markdown render library failed to load. Please check your network.",
  "unknown-error": "Unknown error",
  "docs-refresh-hint": "Try",
  "docs-token-missing-msg": "Document token missing. Please refresh the page.",
  "docs-loading-done": "Done",
  "docs-loading-connecting": "Connecting...",
  "docs-loading-parsing": "Parsing content...",
  "docs-loading-rendering": "Rendering layout...",
  "docs-loading-toc": "Generating navigation...",
  "tone-timeout": "Tone load timeout",
  "applied": "Applied",
  "expand": "Expand",
  "cache-hit-msg": "Cache hit ✓ Faster load",
  "cache-miss-msg": "Cache miss ● Please wait",
  "no-description-short": "No description",
  "repo-topics": "Repository Topics",
  "future-prediction": "Future Prediction",
  "training-model": "Training neural network (please wait)...",
  "predict-failed": "Prediction failed: ",
  "no-comments": "No comments",
  "load-failed-generic": "Load failed: ",
  "view-detail": "View Details",
  "token-added-msg": "✓ Added",
  "official-website": "Official Website",
  "license-no-data": "No license information available",
  "predict-status-msg": "History {h} days · Predicted {p} days · Model trained",
  "view-official-source": "View Original",
  "page-title-commit": "Commit {{ sha }} - {{ repo }}",
  "page-title-file": "File - {{ path }} - {{ repo }}",
  "page-title-release": "Release Details - {{ repo }}",
  "page-title-repo-mirror": "Repo Mirror - {{ repo }}",
  "tab-mods": "Mod Store",
  "mods-title": "Mindustry Mod Store",
  "mods-loading": "Loading mod list...",
  "mods-load-failed": "Load failed",
  "mods-no-results": "No matching mods found",
  "mods-count": "{n} mods",
  "mods-search-placeholder": "Search by name, author or description...",
  "mods-sort-default": "Default",
  "mods-sort-stars": "Stars",
  "mods-sort-name": "Name A-Z",
  "mods-sort-updated": "Last Updated",
  "mods-page": "Page {n} / {t}",
  "mods-by": "by",
  "mods-game-version": "Game Version",
  "mods-mod-version": "Mod Version",
  "mods-last-updated": "Last Updated",
  "mods-view-repo": "View Repo",
  "mods-all": "All",
  "mods-has-icon": "Has Icon",
  "mods-has-scripts": "Has Scripts",
  "mods-has-java": "Has Java",
  "mods-no-scripts": "No Scripts",
  "mods-unknown": "Unknown",
  "prev-page-label": "Previous page",
  "next-page-label": "Next page",
  "zh-description": "Chinese Description (for reference only)",
  "license-legal-text": "Legal Text",
  "detail": "Details",
  "features": "Features",
  "usage": "Typical Usage",
  "just-now": "Updated just now",
  "minutes-ago": "minutes ago",
  "hours-ago": "hours ago",
  "days-ago": "days ago",
  "days": "d",
  "docs-font-dec": "Decrease font size",
  "docs-font-reset": "Reset font size",
  "docs-font-inc": "Increase font size",
  "docs-search-btn": "Search docs (Ctrl+F)",
  "docs-top-btn": "Back to top",
  "user-search-placeholder": "Enter a GitHub username...",
  "joined-github": "Joined",
  "view-github": "GitHub",
  "fork": "Fork",
  "last-pushed": "Last pushed",
  "owned-stars": "Stars on owned repositories",
  "owned-forks": "Forks on owned repositories",
  "created": "Created",
  "closed-on": "Closed",
  "admin-password-required": "Password is required",
  "admin-login-verifying": "Verifying...",
  "admin-login-failed": "Login failed",
};

async function loadLang(lang) {
    const reqId = ++_langReqId;
    let timeoutId = null;
    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 5000);
        // 加时间戳防浏览器缓存旧的语言文件
        const resp = await fetch(`/static/lang/${lang}.json?_=${Date.now()}`, { signal: controller.signal });
        if (resp.ok) {
            const data = await resp.json();
            clearTimeout(timeoutId);
            // 只应用最新请求的结果，防止快速切换时乱序覆盖
            if (reqId === _langReqId) langData = data;
        } else {
            clearTimeout(timeoutId);
            console.warn(`[i18n] Failed to load ${lang}.json, falling back to embedded fallback`);
            if (reqId === _langReqId) {
                langData = lang === 'en' ? Object.assign({}, FALLBACK_EN) : {};
            }
        }
    } catch (e) {
        clearTimeout(timeoutId);
        console.error(`[i18n] Error loading ${lang}.json:`, e);
        if (reqId === _langReqId) {
            langData = lang === 'en' ? Object.assign({}, FALLBACK_EN) : {};
        }
    }
}

function t(key) {
    return langData[key] || key;
}

// 外观工具插件加载前的最小通知兼容层；插件加载后会接管完整实现。
function showNotification(text, type) {
    const old = document.getElementById('app-notify-bar');
    if (old) old.remove();
    clearTimeout(_notifyTimer);
    const bar = document.createElement('div');
    bar.id = 'app-notify-bar';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:99999;padding:10px 20px;border-radius:8px;background:' + (type === 'error' ? '#9a2a2a' : '#1a7f2a') + ';color:#fff;';
    bar.textContent = text;
    document.body.appendChild(bar);
    _notifyTimer = setTimeout(function() { if (bar.parentNode) bar.remove(); }, 3000);
}

window.showNotification = showNotification;

function interpolateI18n(value, argsText, escapeArgs) {
    let result = String(value);
    if (!argsText) return result;
    try {
        const args = JSON.parse(argsText);
        Object.keys(args).forEach(key => {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let replacement = String(args[key] == null ? '' : args[key]);
            if (escapeArgs) replacement = escHtml(replacement);
            result = result.replace(
                new RegExp('\\{\\{\\s*' + escapedKey + '\\s*\\}\\}|\\{' + escapedKey + '\\}', 'g'),
                () => replacement
            );
        });
    } catch (e) {
        console.error('i18n args:', e, argsText);
    }
    return result;
}

function applyI18n() {
    // 如果 langData 为空（加载失败），保留模板中的默认文本，不做替换
    if (Object.keys(langData).length === 0) {
        const label = document.getElementById('i18n-label');
        if (label) {
            if (currentLang === 'zh') label.textContent = 'English';
            else if (currentLang === 'zh-Hant') label.textContent = 'English';
            else label.textContent = t('language-zh');
        }
        localStorage.setItem('gitaap_lang', currentLang);
        return;
    }
    document.querySelectorAll('[data-i18n]').forEach(el => {
        try {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const translated = interpolateI18n(t(key), el.getAttribute('data-i18n-args'), true);
                el.innerHTML = sanitizeHtml(translated);
            }
        } catch(e) { console.error('i18n apply:', e, el); }
    });
    // 翻译 data-i18n-title 属性（tooltip）
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        try {
            const key = el.getAttribute('data-i18n-title');
            if (key) el.setAttribute('title', t(key));
        } catch(e) { console.error('i18n title apply:', e, el); }
    });
    // 翻译无障碍名称，供图标按钮在语言切换后保持可读。
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        try {
            const key = el.getAttribute('data-i18n-aria-label');
            if (key) el.setAttribute('aria-label', t(key));
        } catch(e) { console.error('i18n aria-label apply:', e, el); }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        try {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) el.setAttribute('placeholder', interpolateI18n(t(key), el.getAttribute('data-i18n-args'), false));
        } catch(e) { console.error('i18n placeholder apply:', e, el); }
    });
    const label = document.getElementById('i18n-label');
    if (label) {
        if (currentLang === 'zh') label.textContent = 'English';
        else if (currentLang === 'zh-Hant') label.textContent = 'English';
        else label.textContent = t('language-zh');
    }
    localStorage.setItem('gitaap_lang', currentLang);
}

async function toggleI18n() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('gitaap_lang', currentLang);
    // 用 URL 参数传递语言，确保页面刷新后正确加载
    const url = new URL(window.location.href);
    url.searchParams.set('lang', currentLang);
    window.location.href = url.toString();
}

// ═══════════════════════════════════════════════════
//  主题切换
// ═══════════════════════════════════════════════════

// Cookie 工具函数
function getCookie(name) {
    var escaped = String(name).replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
    var match = document.cookie.match(new RegExp('(^| )' + escaped + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}
function setCookie(name, value, days) {
    var expires = '';
    if (days) {
        var d = new Date();
        d.setTime(d.getTime() + days * 86400000);
        expires = '; expires=' + d.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
}
function removeCookie(name) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
}

// 初始化主题：优先读取 Cookie，无配置则根据本地时间自动判定
(function() {
    var theme = getCookie('site-theme');
    if (theme !== 'light' && theme !== 'dark') {
        var hour = new Date().getHours();
        theme = (hour >= 7 && hour < 19) ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);
})();
var currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    setCookie('site-theme', theme, 365);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.innerHTML = theme === 'dark' ? '<span aria-hidden="true" class="ico ico-moon"></span>' : '<span aria-hidden="true" class="ico ico-sun"></span>';
    }
}

function _runThemeTransition(updateTheme, trigger) {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const source = trigger || document.getElementById('theme-toggle');

    if (!document.startViewTransition || reduceMotion || !source) {
        updateTheme();
        return;
    }

    const rect = source.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.style.setProperty('--theme-reveal-x', x + 'px');
    root.style.setProperty('--theme-reveal-y', y + 'px');
    root.style.setProperty('--theme-reveal-radius', radius + 'px');
    // 羽化遮罩的起止半径：起点略大于 0，保证首帧就有可见的柔边而非硬点；
    // 终点放大到 1.35 倍，让最外圈的半透明过渡带也完全扫出视口。
    root.style.setProperty('--theme-reveal-r0', (rect.width / 2 || 8) + 'px');
    root.style.setProperty('--theme-reveal-r1', (radius * 1.35) + 'px');
    root.classList.add('theme-reveal-transition');

    const transition = document.startViewTransition(updateTheme);
    transition.finished.finally(function() {
        root.classList.remove('theme-reveal-transition');
        root.style.removeProperty('--theme-reveal-x');
        root.style.removeProperty('--theme-reveal-y');
        root.style.removeProperty('--theme-reveal-radius');
        root.style.removeProperty('--theme-reveal-r0');
        root.style.removeProperty('--theme-reveal-r1');
    });
}

function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    _runThemeTransition(function() {
        applyTheme(newTheme);
        highlightThemeBtn();
        _updateHljsTheme();
    }, document.getElementById('theme-toggle'));
}

// ── CSRF Token 管理 ──
var _csrfToken = '';
var _csrfRetries = 0;
var _csrfMaxRetries = 5;

function fetchCsrfToken() {
    fetch('/csrf-token')
        .then(function(r) { return r.json(); })
        .then(function(data) { _csrfToken = data.token || ''; _csrfRetries = 0; })
        .catch(function() {
            _csrfToken = '';
            _csrfRetries++;
            if (_csrfRetries < _csrfMaxRetries) {
                setTimeout(fetchCsrfToken, 1000 * Math.min(_csrfRetries, 4));
            }
        });
}

function csrfTokensReady() {
    return !!_csrfToken;
}

function csrfHeaders(extra) {
    var h = Object.assign({}, extra || {});
    if (_csrfToken) h['X-CSRF-Token'] = _csrfToken;
    return h;
}

fetchCsrfToken();

// ── 浮窗：显示作者用户详情 ──
function showAuthorFloat(username) {
    if (!username) return;
    var overlay = document.getElementById('author-float');
    if (overlay) { overlay.style.display = 'flex'; return; }
    overlay = document.createElement('div');
    overlay.id = 'author-float';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.style.display = 'none'; });
    var panel = document.createElement('div');
    panel.style.cssText = 'background:var(--bg3);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:380px;width:100%;';
    panel.innerHTML = '<div style="text-align:center;padding:12px 0;" id="author-float-body"><div class="spinner" style="width:24px;height:24px;border-width:3px;margin:0 auto;"></div></div>';
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    // 异步加载用户信息
    fetch('/user-info?user=' + encodeURIComponent(username))
    .then(function(r) { return r.json(); })
    .then(function(data) {
        var body = document.getElementById('author-float-body');
        if (!body) return;
        if (data.error) {
            body.innerHTML = '<p style="color:var(--red);">' + t('load-failed') + ': ' + escHtml(data.error) + '</p>';
            return;
        }
        body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;">'
            + '<img src="' + escAttr(data.avatar_url || '') + '" alt="" style="width:72px;height:72px;border-radius:50%;border:2px solid var(--border);object-fit:cover;">'
            + '<div style="font-weight:600;font-size:1.1rem;">' + escHtml(data.name || data.login) + '</div>'
            + '<div style="color:var(--text-dim);font-size:0.85rem;">@' + escHtml(data.login || '') + '</div>'
            + (data.bio ? '<div style="font-size:0.82rem;color:var(--text-dim);line-height:1.5;max-width:300px;">' + escHtml(data.bio) + '</div>' : '')
            + '<div style="display:flex;gap:16px;font-size:0.85rem;">'
            +   '<span><span aria-hidden="true" class="ico ico-users ico-gap" style="width:13px;height:13px;"></span>' + (data.followers || 0) + ' ' + t('followers') + '</span>'
            +   '<span><span aria-hidden="true" class="ico ico-package ico-gap" style="width:13px;height:13px;"></span>' + (data.public_repos || 0) + ' ' + t('repos') + '</span>'
            + '</div>'
            + '<div style="display:flex;gap:8px;margin-top:4px;">'
            +   '<a class="btn-sm" href="/user?user=' + encodeURIComponent(username) + '" style="text-decoration:none;"><span aria-hidden="true" class="ico ico-file-text ico-gap" style="width:13px;height:13px;"></span>' + t('user-detail') + '</a>'
            +   '<a class="btn-sm" href="' + escAttr(data.html_url || '') + '" target="_blank" rel="noopener" style="text-decoration:none;"><span class="ico ico-github" style="width:14px;height:14px;"></span> GitHub</a>'
            + '</div>'
            + '</div>';
    })
    .catch(function(err) {
        var body = document.getElementById('author-float-body');
        if (body) body.innerHTML = '<p style="color:var(--red);">' + t('load-failed') + '</p>';
    });
}

// ═══════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// ── 自定义仓库下拉菜单 ──
let _repoFilterTimer = null;
let _drawerFilterTimer = null;

function toggleRepoDropdown() {
    const dd = document.getElementById('repo-dropdown');
    const btn = document.getElementById('repo-select-btn');
    if (!dd || !btn) return;
    const isOpen = dd.style.display === 'block';
    dd.style.display = isOpen ? 'none' : 'block';
    btn.classList.toggle('open', !isOpen);
    if (!isOpen) {
        const input = document.getElementById('repo-dropdown-input');
        if (input) { input.value = ''; input.focus(); }
        filterRepoDropdown('');
    }
}

function filterRepoDropdown(query) {
    if (_repoFilterTimer) clearTimeout(_repoFilterTimer);
    _repoFilterTimer = setTimeout(() => {
        _repoFilterTimer = null;
        const list = document.getElementById('repo-dropdown-list');
        if (!list) return;
        const q = query.trim().toLowerCase();
        list.querySelectorAll('.repo-dropdown-item').forEach(item => {
            const repo = item.getAttribute('data-repo') || '';
            item.classList.toggle('hidden', q && !repo.toLowerCase().includes(q));
        });
    }, 150);
}

function selectRepoDropdown(repo) {
    if (!repo) return;
    const sel = document.getElementById('repo');
    const label = document.getElementById('repo-select-label');
    const dd = document.getElementById('repo-dropdown');
    const btn = document.getElementById('repo-select-btn');
    if (sel) sel.value = repo;
    if (label) label.textContent = repo;
    if (dd) dd.style.display = 'none';
    if (btn) btn.classList.remove('open');
    // 高亮选中项
    document.querySelectorAll('.repo-dropdown-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-repo') === repo);
    });
    onRepoChange();
}

// 点击外部关闭下拉菜单
document.addEventListener('click', function(e) {
    const wrap = document.querySelector('.repo-select-wrap');
    const dd = document.getElementById('repo-dropdown');
    if (!wrap || !dd) return;
    if (!wrap.contains(e.target) && dd.style.display === 'block') {
        dd.style.display = 'none';
        const btn = document.getElementById('repo-select-btn');
        if (btn) btn.classList.remove('open');
    }
});

function onRepoChange() {
    var el = document.getElementById("repo");
    if (!el) return;
    const repo = el.value;
    // 保留当前 URL 中的 lang 参数，避免切换仓库后丢失语言设置
    const url = new URL(window.location.href);
    url.searchParams.set('repo', repo);
    if (window.location.pathname === '/repo') {
        window.history.replaceState(null, '', url.toString());
        // 切换仓库时清空所有缓存与板块加载标记
        releasesCache = {};
        commitsCache = {};
        issuesCache = {};
        pullsCache = {};
        window._loadedRepoTabs = new Set();
        window._loadingRepoTabs = new Set();
        releasesPage = 1;
        commitsPage = 1;
        issuesPage = 1;
        pullsPage = 1;
        // 重置仓库相关的全局状态，防止切换仓库后使用旧数据
        window._fileTreeLoaded = false;
        window._currentBranch = '';
        loadAll();
    } else {
        window.location.href = url.toString();
    }
}

async function requestJson(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    let res;
    const startTime = performance.now();
    try {
        res = await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(t('timeout-error'));
        }
        throw new Error(t('network-error') + error.message);
    }
    const elapsed = performance.now() - startTime;
    // 缓存命中提示（如果启用）
    if (localStorage.getItem('gitaap_cache_hint') === 'on') {
        const isHit = elapsed < 300;
        showCacheNotification(isHit);
    }
    let text;
    try {
        text = await res.text();
        clearTimeout(timeoutId);
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(t('timeout-error'));
        }
        throw new Error(t('network-error') + error.message);
    }
    let data;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (error) {
            // 非 JSON 响应 — 用 HTTP 状态码构造错误
            throw new Error(`HTTP ${res.ok ? '200' : res.status}: ${text.trim().slice(0, 200)}`);
        }
    }
    if (!res.ok) {
        const message = (data && (data.detail || data.message || data.error)) || `${res.status} ${res.statusText}`;
        throw new Error(`HTTP ${res.status}: ${message}`);
    }
    if (data && data.error) {
        throw new Error(data.error);
    }
    // 空响应体（如 204 No Content）返回空对象，避免调用方 crash
    return data == null ? {} : data;
}

function formatBytes(bytes, unit) {
    if (bytes === null || bytes === undefined || bytes < 0) return '—';
    const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (unit && UNITS.includes(unit)) {
        const idx = UNITS.indexOf(unit);
        const divisor = Math.pow(1024, idx);
        const val = bytes / divisor;
        const decimals = idx <= 1 ? 0 : idx === 2 ? 1 : 2;
        return val.toFixed(decimals) + ' ' + unit;
    }
    // 自动选择最佳单位
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes < 1024 * 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    return (bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2) + ' TB';
}

function formatBytesAuto(bytes) {
    // 返回 {value, unit, text} 方便用户切换单位
    if (bytes === null || bytes === undefined || bytes < 0) return { value: 0, unit: 'B', text: '—' };
    const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
    let idx = 0;
    let val = bytes;
    while (val >= 1024 && idx < UNITS.length - 1) {
        val /= 1024;
        idx++;
    }
    const decimals = idx <= 1 ? 0 : idx === 2 ? 1 : 2;
    return { value: val, unit: UNITS[idx], text: val.toFixed(decimals) + ' ' + UNITS[idx] };
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    } catch (e) {
        return '—';
    }
}

// ═══════════════════════════════════════════════════
//  动画：IntersectionObserver 渐入（复用单例 Observer）
// ═══════════════════════════════════════════════════

let _animationObserver = null;
let _animInitDone = false;

function observeAnimations(root) {
    if (!_animationObserver) {
        _animationObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    _animationObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px 50px 0px' });
    }
    const container = root || document;
    container.querySelectorAll('.animate-in').forEach(el => {
        if (!el.classList.contains('visible')) {
            // 对于已经在视口中的元素，直接标记为可见
            const rect = el.getBoundingClientRect();
            const winHeight = window.innerHeight || document.documentElement.clientHeight;
            if (rect.top < winHeight - 50 && rect.bottom > 0) {
                el.classList.add('visible');
            } else {
                _animationObserver.observe(el);
            }
        }
    });
    _animInitDone = true;
}

// ═══════════════════════════════════════════════════
//  仓库概览
// ═══════════════════════════════════════════════════

let _repoInfoReqId = 0;

async function loadRepoInfo(repo) {
    const reqId = ++_repoInfoReqId;
    const encoded = encodeURIComponent(repo);
    try {
        const info = await requestJson(`/repo-info?repo=${encoded}`);
        // 请求 ID 防竞态：只应用最新一次请求的结果
        if (reqId !== _repoInfoReqId) return;
        setText('repo-name', info.repo || repo);
        // 从 "owner/repo" 中提取作者名
        var owner = (info.repo || repo).split('/')[0];
        var authorLink = document.getElementById('author-link');
        if (authorLink && owner) {
            authorLink.textContent = owner;
            authorLink.onclick = function() { showAuthorFloat(owner); };
        }
        setText('repo-description', info.description || t('no-description'));
        // 数据存在分支：正常彩色标签；空值占位分支：灰色描边空心标签
        var langEl = document.getElementById('repo-language');
        if (info.language) {
            setText('repo-language', info.language);
            langEl.className = 'badge';
            langEl.style.cursor = 'pointer';
            langEl.title = t('click-lang-detail');
            langEl.onclick = function() { showLanguagePopup(info.language); };
        } else {
            setText('repo-language', t('unknown-short'));
            langEl.className = 'badge-empty';
            langEl.style.cursor = 'default';
            langEl.title = '';
            langEl.onclick = null;
        }
        var licenseEl = document.getElementById('repo-license');
        if (info.license) {
            setText('repo-license', info.license);
            licenseEl.className = 'badge';
            licenseEl.style.cursor = 'pointer';
            licenseEl.title = t('click-license-detail');
            licenseEl.onclick = function() { showLicensePopup(info.license); };
        } else {
            setText('repo-license', t('unknown-short'));
            licenseEl.className = 'badge-empty';
            licenseEl.style.cursor = 'default';
            licenseEl.title = '';
            licenseEl.onclick = null;
        }
        // 直接写入抽屉统计
        const ds = (id, val) => {
            const el = document.getElementById('drawer-stat-' + id);
            if (el) el.textContent = val != null ? val.toLocaleString() : '—';
        };
        ds('stars', info.stars);
        ds('forks', info.forks);
        ds('issues', info.open_issues);
        ds('watchers', info.watchers);
        const branchVal = info.default_branch || '—';
        const branchEl = document.getElementById('drawer-stat-branch');
        if (branchEl) branchEl.textContent = branchVal;

        const topicsEl = document.getElementById('repo-topics');
        if (info.topics && info.topics.length > 0) {
            const allTopics = info.topics;
            const maxShow = 3;
            const visible = allTopics.slice(0, maxShow);
            let html = visible.map(t =>
                `<span class="badge badge-topic">${escHtml(t)}</span>`
            ).join('');
            // 总是显示"..."按钮，点击弹出所有话题+描述
            html += `<button class="topic-more-btn" onclick="showTopicPopup('${escAttr(encodeURIComponent(JSON.stringify(allTopics)))}')" title="查看所有话题标签"><span aria-hidden="true" class="ico ico-dash" style="width:12px;height:12px;"></span></button>`;
            topicsEl.innerHTML = html;
        } else {
            topicsEl.innerHTML = '';
        }

        if (info.archived) {
            document.getElementById('repo-overview').style.borderColor = '#ff8c42';
            const nameEl = document.getElementById('repo-name');
            if (nameEl) {
                // 先移除旧的归档/禁用标记，再追加新标记，防止重复
                nameEl.textContent = nameEl.textContent.replace(/\s*\([^)]*(?:归档|禁用|archived|disabled)[^)]*\)/gi, '');
                nameEl.textContent += ` (${t('archived')})`;
            }
        }
        if (info.disabled) {
            document.getElementById('repo-overview').style.borderColor = '#ff5338';
            const nameEl = document.getElementById('repo-name');
            if (nameEl) {
                nameEl.textContent = nameEl.textContent.replace(/\s*\([^)]*(?:归档|禁用|archived|disabled)[^)]*\)/gi, '');
                nameEl.textContent += ` (${t('disabled')})`;
            }
        }
        observeAnimations();
    } catch (error) {
        console.error('loadRepoInfo:', error);
        setText('repo-description', `${t('load-failed')}: ${error.message}`);
    }
}

/**
 * 加载仓库语言占比
 */
async function loadRepoLanguages(repo) {
    const barEl = document.getElementById('drawer-lang-bar');
    const listEl = document.getElementById('drawer-lang-list');
    if (!barEl || !listEl) return;
    try {
        const data = await requestJson(`/repo-languages?repo=${encodeURIComponent(repo)}`);
        if (!Array.isArray(data) || data.length === 0) {
            barEl.innerHTML = '<div class="lang-bar-empty" style="color:var(--text-dim);">' + t('no-lang-data') + '</div>';
            listEl.innerHTML = '';
            return;
        }
        // 进度条
        barEl.innerHTML = data.map(l => {
            const width = Math.max(l.percentage, 1);
            return `<div class="lang-bar-seg" style="width:${width}%;background:${l.color};" title="${l.name}: ${l.percentage}%"></div>`;
        }).join('');
        // 语言列表
        listEl.innerHTML = data.map(l => `
            <div class="lang-item">
                <span class="lang-dot" style="background:${l.color};"></span>
                <span class="lang-name">${escHtml(l.name)}</span>
                <span class="lang-pct">${l.percentage}%</span>
            </div>
        `).join('');
        observeAnimations();
    } catch (e) {
        console.error('loadRepoLanguages:', e);
        barEl.innerHTML = '<div class="lang-bar-empty" style="color:var(--text-dim);">' + t('load-failed-short') + '</div>';
    }
}

// ═══════════════════════════════════════════════════
//  分支选择器
// ═══════════════════════════════════════════════════

let currentBranchRepo = '';

async function loadBranchList(repo) {
    const listEl = document.getElementById('branch-list');
    if (!listEl) return;
    listEl.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-dim);font-size:0.85rem;"><div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto;"></div></div>';
    try {
        const data = await requestJson(`/branches?repo=${encodeURIComponent(repo)}`);
        if (!Array.isArray(data) || data.length === 0) {
            listEl.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-dim);font-size:0.85rem;">' + t('load-failed-short') + '</div>';
            return;
        }
        const branchStat = byId('drawer-stat-branch');
        const current = branchStat ? branchStat.textContent : '';
        listEl.innerHTML = data.map(b => {
            const isCurrent = b.name === current;
            return `<div class="branch-item" data-branch="${escAttr(b.name)}" style="display:flex; align-items:center; gap:8px; padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border); font-size:0.85rem; transition:background 0.15s; ${isCurrent ? 'background:rgba(35,134,134,0.12);' : ''}"
                onclick="selectBranch('${escAttr(repo)}','${escAttr(b.name)}')" onmouseover="this.style.background='rgba(35,134,134,0.08)'" onmouseout="this.style.background='${isCurrent ? 'rgba(35,134,134,0.12)' : 'transparent'}'">
                <span aria-hidden="true" class="ico ico-git-branch ico-dim" style="width:14px;height:14px;flex-shrink:0;"></span>
                <span style="flex:1; font-family:monospace; font-weight:${isCurrent?'600':'400'}; color:${isCurrent?'var(--cyan)':'var(--text)'};">${escHtml(b.name)}</span>
                ${isCurrent ? '<span class="badge" style="font-size:0.65rem;padding:1px 6px;background:#238686;">' + t('current-branch') + '</span>' : ''}
            </div>`;
        }).join('');
    } catch (e) {
        listEl.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-dim);font-size:0.85rem;">' + t('load-failed-short') + '</div>';
    }
}

// ═══════════════════════════════════════════════════
//  统计面板折叠切换
// ═══════════════════════════════════════════════════

function toggleStatsPanel() {
    const panel = document.getElementById('stats-panel');
    const toggle = document.querySelector('.stats-toggle');
    if (!panel || !toggle) return;
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    toggle.classList.toggle('active', !isOpen);
    // 展开时触发动画
    if (!isOpen) {
        requestAnimationFrame(() => observeAnimations());
    }
}

// ═══════════════════════════════════════════════════
//  Star/Fork 用户详情弹窗
// ═══════════════════════════════════════════════════

let _detailPopup = null;

function closeDetailPopup() {
    if (_detailPopup) {
        _detailPopup.remove();
        _detailPopup = null;
    }
}

// ═══════════════════════════════════════════════════
//  右侧抽屉
// ═══════════════════════════════════════════════════

function toggleDrawer() {
    const overlay = document.getElementById('side-drawer');
    if (!overlay) return;
    if (overlay.style.display === 'block') {
        closeDrawer();
    } else {
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
        // 高亮当前主题按钮
        highlightThemeBtn();
        // 高亮当前语言按钮
        highlightLangBtn();
        // 加载 Token 状态到抽屉
        loadDrawerTokenStatus();
        // 初始化仓库搜索和作者过滤
        initDrawerFilter();
        // 默认仓库分区已显示时才请求语言统计。
        const repoPanel = document.getElementById('dpanel-repo');
        if (repoPanel && repoPanel.classList.contains('active')) {
            const repo = document.getElementById('repo');
            if (repo && repo.value) loadRepoLanguages(repo.value);
        }
    }
}

function closeDrawer() {
    const overlay = document.getElementById('side-drawer');
    if (!overlay) return;
    overlay.style.display = 'none';
    document.body.style.overflow = '';
}

// 桌面宽屏抽屉常驻时由 CSS 控制显示；仅关闭实际以弹层方式打开的抽屉。
document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;
    const overlay = document.getElementById('side-drawer');
    if (overlay && overlay.style.display === 'block') closeDrawer();
});

/**
 * 切换侧边栏分类面板
 * 高亮对应的导航按钮，显示对应面板，隐藏其他面板
 */
function switchDrawerPanel(panelId) {
    // 切换导航按钮高亮
    const navBtns = document.querySelectorAll('.drawer-nav-btn');
    navBtns.forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.panel === panelId);
    });
    // 切换面板显示
    const panels = document.querySelectorAll('.drawer-panel-content');
    panels.forEach(function(panel) {
        panel.classList.toggle('active', panel.id === 'dpanel-' + panelId);
    });

    // 仓库语言统计只在用户查看仓库面板时请求，避免首屏无效请求。
    if (panelId === 'repo') {
        const repo = document.getElementById('repo');
        if (repo && repo.value) loadRepoLanguages(repo.value);
    }
}

async function loadDrawerTokenStatus() {
    const el = document.getElementById('drawer-token-status');
    if (!el) return;
    try {
        const data = await requestJson('/rate-limit');
        if (data.error) {
            el.innerHTML = '<span aria-hidden="true" class="ico ico-hourglass ico-dim ico-gap"></span>' + t('drawer-fetch-failed') + '';
            return;
        }
        const pct = data.limit > 0 ? Math.round((data.remaining / data.limit) * 100) : 0;
        let color = '#3fb950';
        if (pct < 10) color = '#f85149';
        else if (pct < 25) color = '#ff8c42';
        const tokenInfo = data.tokens && data.tokens.length > 0
            ? data.tokens.map(t => {
                const expiryHtml = _formatExpiry(t.expires_at);
                return '<span style="font-size:0.75rem;color:var(--text-dim);display:block;line-height:1.6;">'
                    + escHtml(t.name) + ' ' + escHtml(t.remaining) + '/' + escHtml(t.limit)
                    + ' <span style="font-size:0.7rem;">' + expiryHtml + '</span>'
                    + '</span>';
              }).join('')
            : '';
        el.innerHTML = '<div><span aria-hidden="true" class="ico ico-hourglass ico-dim ico-gap"></span>' + t('drawer-remaining') + ' <strong style="color:' + color + ';">' + data.remaining + '</strong>/' + data.limit + ' (' + pct + '%)</div>'
            + (tokenInfo ? '<div style="margin-top:4px;padding-left:22px;">' + tokenInfo + '</div>' : '');
    } catch (e) {
        el.innerHTML = '<span aria-hidden="true" class="ico ico-hourglass ico-dim ico-gap"></span>' + t('drawer-load-failed') + '';
    }
}

// ── 抽屉仓库搜索与作者过滤 ──
function filterDrawerRepos() {
    if (_drawerFilterTimer) clearTimeout(_drawerFilterTimer);
    _drawerFilterTimer = setTimeout(() => {
        _drawerFilterTimer = null;
        const input = document.getElementById('repo-search-input');
        const list = document.getElementById('drawer-repo-list');
        if (!input || !list) return;
        const query = input.value.trim().toLowerCase();
        const items = list.querySelectorAll('.drawer-repo-item');
        let visibleCount = 0;

        // 收集所有匹配的作者
        const authors = new Set();
        items.forEach(item => {
            const author = (item.getAttribute('data-author') || '').toLowerCase();
            const repo = (item.getAttribute('data-repo') || '').toLowerCase();
            const full = author + '/' + repo;
            const match = !query || full.includes(query) || author.includes(query) || repo.includes(query);
            item.style.display = match ? '' : 'none';
            if (match) {
                visibleCount++;
                authors.add(item.getAttribute('data-author'));
            }
        });

        // 渲染作者过滤标签
        renderAuthorChips(authors, query);
    }, 150);
}

function renderAuthorChips(authors, query) {
    const container = document.getElementById('author-filter-chips');
    if (!container) return;
    // 只显示当前搜索匹配到的作者
    const sorted = Array.from(authors).sort();
    if (sorted.length <= 1) {
        container.innerHTML = '';
        return;
    }
    const activeAuthor = container.getAttribute('data-active') || '';
    container.innerHTML = sorted.map(a => {
        const active = a === activeAuthor ? 'active' : '';
        return `<span class="author-chip ${active}" data-author="${escAttr(a)}" onclick="filterByAuthor('${escAttr(a)}')">${escHtml(a)}</span>`;
    }).join('');
}

function filterByAuthor(author) {
    const container = document.getElementById('author-filter-chips');
    const input = document.getElementById('repo-search-input');
    const list = document.getElementById('drawer-repo-list');
    if (!container || !list) return;

    const current = container.getAttribute('data-active') || '';
    // 点击已选中的作者取消过滤
    const newActive = current === author ? '' : author;
    container.setAttribute('data-active', newActive);

    // 高亮当前选中的作者
    container.querySelectorAll('.author-chip').forEach(chip => {
        chip.classList.toggle('active', chip.getAttribute('data-author') === newActive);
    });

    // 过滤列表
    const items = list.querySelectorAll('.drawer-repo-item');
    items.forEach(item => {
        const itemAuthor = item.getAttribute('data-author') || '';
        if (!newActive || itemAuthor === newActive) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });

    // 搜索框联动：清空搜索词
    if (input) input.value = '';
}

function initDrawerFilter() {
    // 构建作者标签
    const list = document.getElementById('drawer-repo-list');
    const container = document.getElementById('author-filter-chips');
    if (!list || !container) return;
    const authors = new Set();
    list.querySelectorAll('.drawer-repo-item').forEach(item => {
        const author = item.getAttribute('data-author');
        if (author) authors.add(author);
    });
    if (authors.size > 1) {
        const sorted = Array.from(authors).sort();
        container.innerHTML = sorted.map(a =>
            `<span class="author-chip" data-author="${escAttr(a)}" onclick="filterByAuthor('${escAttr(a)}')">${escHtml(a)}</span>`
        ).join('');
    }
}

function syncDrawerStats() {
    const ids = ['stars', 'forks', 'issues', 'watchers', 'branch'];
    ids.forEach(id => {
        const src = document.getElementById('stat-' + id);
        const dst = document.getElementById('drawer-stat-' + id);
        if (src && dst) dst.textContent = src.textContent;
    });
}

function highlightThemeBtn() {
    var raw = getCookie('site-theme');
    var theme = raw || 'system';
    document.querySelectorAll('.drawer-theme-btn[data-theme]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

function _updateHljsTheme() {
    // 动态切换 hljs 语法高亮 CSS 以匹配当前主题
    // 使用 currentTheme 而非 localStorage（system 模式下 localStorage 已清除）
    var hljsTheme = currentTheme === 'light' ? 'github' : 'github-dark';
    var href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/' + hljsTheme + '.min.css';
    var link = document.getElementById('hljs-theme-link');
    if (link) {
        link.href = href;
    } else {
        link = document.createElement('link');
        link.id = 'hljs-theme-link';
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }
}

function highlightLangBtn() {
    const lang = localStorage.getItem('gitaap_lang') || 'zh';
    document.querySelectorAll('.drawer-lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
}

function setTheme(theme) {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : document.getElementById('theme-toggle');
    _runThemeTransition(function() {
        if (theme === 'system') {
            removeCookie('site-theme');
            var hour = new Date().getHours();
            var resolved = (hour >= 7 && hour < 19) ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', resolved);
            // 同步 currentTheme 防止 toggleTheme 使用旧值
            currentTheme = resolved;
            // 更新按钮图标
            const btn = document.getElementById('theme-toggle');
            if (btn) btn.innerHTML = resolved === 'dark' ? '<span aria-hidden="true" class="ico ico-moon"></span>' : '<span aria-hidden="true" class="ico ico-sun"></span>';
            _updateHljsTheme();
        } else {
            applyTheme(theme);
        }
        highlightThemeBtn();
        _updateHljsTheme();
    }, trigger);
}

// ── 字体大小控制 ──
const FONT_SIZE_MAP = { small: '14px', medium: '16px', large: '18px', xlarge: '20px' };

function setFontSize(size) {
    if (!FONT_SIZE_MAP[size]) return;
    localStorage.setItem('gitaap_font_size', size);
    applyFontSize(size);
    // 高亮当前按钮
    document.querySelectorAll('.font-size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === size);
    });
    const names = { small: t('font-small'), medium: t('font-medium'), large: t('font-large'), xlarge: t('font-xlarge') };
    showNotification((names[size] || size) + ' ' + (t('font-applied') || '已应用'), 'success');
}

function applyFontSize(size) {
    const px = FONT_SIZE_MAP[size] || '16px';
    document.documentElement.style.fontSize = px;
}

function initFontSize() {
    const saved = localStorage.getItem('gitaap_font_size') || 'medium';
    applyFontSize(saved);
    document.querySelectorAll('.font-size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === saved);
    });
}

// ── 文本对齐控制 ──
const ALIGN_MAP = { left: 'left', center: 'center', right: 'right' };

function setTextAlign(align) {
    if (!ALIGN_MAP[align]) return;
    localStorage.setItem('gitaap_align', align);
    applyTextAlign(align);
    document.querySelectorAll('.align-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === align);
    });
}

function applyTextAlign(align) {
    const val = ALIGN_MAP[align] || 'center';
    const container = document.querySelector('.container');
    if (container) container.style.setProperty('text-align', val);
}

function initTextAlign() {
    const saved = localStorage.getItem('gitaap_align') || 'center';
    applyTextAlign(saved);
    document.querySelectorAll('.align-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === saved);
    });
}

// ── 文字展开/折叠 ──
function toggleDesc(el) {
    const desc = el.previousElementSibling;
    if (desc) {
        desc.classList.toggle('expanded');
        el.textContent = desc.classList.contains('expanded') ? (t('collapse') || t('collapse-legal')) : (t('click-to-expand') || '展开');
    }
}

// ── 缓存命中提示 ──
let _cacheHintTimer = null;
let _cacheHintCount = 0;
let _cacheHintType = null; // true = hit, false = miss
let _cacheHintDebounceTimer = null;

function toggleCacheHint() {
    const cb = document.getElementById('cache-hint-toggle');
    if (!cb) return;
    localStorage.setItem('gitaap_cache_hint', cb.checked ? 'on' : 'off');
}

function initCacheHint() {
    const cb = document.getElementById('cache-hint-toggle');
    if (!cb) return;
    cb.checked = localStorage.getItem('gitaap_cache_hint') === 'on';
}

function showCacheNotification(isHit) {
    if (_cacheHintDebounceTimer) {
        clearTimeout(_cacheHintDebounceTimer);
    }
    // 同类型 → 累加计数，延迟显示
    if (_cacheHintType === isHit) {
        _cacheHintCount++;
        _cacheHintDebounceTimer = setTimeout(() => {
            _cacheHintDebounceTimer = null;
            _flushCacheNotification(isHit);
        }, 200);
        return;
    }
    // 不同类型 → 立即刷新显示旧的，再切换到新类型
    _cacheHintDebounceTimer = setTimeout(() => {
        _cacheHintDebounceTimer = null;
        _cacheHintType = isHit;
        _cacheHintCount = 1;
        _flushCacheNotification(isHit);
    }, 200);
    // 如果已有旧类型正在显示，立即清除
    if (_cacheHintTimer) {
        clearTimeout(_cacheHintTimer);
        _cacheHintTimer = null;
        const oldBar = document.getElementById('cache-hint-bar');
        if (oldBar) oldBar.remove();
    }
    _cacheHintType = isHit;
    _cacheHintCount = 1;
}


// ── 安全 DOM 操作辅助函数 ──
function byId(id) { return document.getElementById(id); }
function setText(id, val) { const el = byId(id); if (el) el.textContent = val; }
function setHTML(id, val) { const el = byId(id); if (el) el.innerHTML = val; }

// 统一加载骨架屏 — 替代 6 处重复的 spinner HTML
function showLoading(el, text) {
    if (!el) return;
    el.innerHTML = '<div style="padding:20px;text-align:center;"><div class="spinner" style="margin:0 auto;"></div><p style="color:var(--text-dim);margin-top:8px;">' + (text || t('loading')) + '</p></div>';
}

function _flushCacheNotification(isHit) {
    const hitText = t('cache-hit') || '缓存命中 ✓ 加载速度增快';
    const missText = t('cache-miss') || '未命中 ● 请稍后等待';

    // 移除旧的提示条
    if (_cacheHintTimer) {
        clearTimeout(_cacheHintTimer);
        _cacheHintTimer = null;
    }
    const oldBar = document.getElementById('cache-hint-bar');
    if (oldBar) oldBar.remove();

    const bar = document.createElement('div');
    bar.id = 'cache-hint-bar';
    bar.style.cssText = `
        position:fixed; bottom:20px; left:20px; z-index:99999;
        padding:10px 20px; font-size:0.85rem; font-family:system-ui,sans-serif;
        display:flex; align-items:center; justify-content:space-between; gap:12px;
        border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
        ${isHit ? 'background:#1a7f2a; color:#fff;' : 'background:#9a6a00; color:#fff;'}
    `;
    const countDisplay = _cacheHintCount > 1 ? ` <span style="font-weight:600;">×${_cacheHintCount}</span>` : '';
    bar.innerHTML = `
        <span>
            <span class="cache-hint-text">${isHit ? '<span aria-hidden="true" class="ico ico-check ico-white" style="width:14px;height:14px;vertical-align:middle;"></span> ' + hitText : '<span aria-hidden="true" class="ico ico-dot ico-white" style="width:8px;height:8px;vertical-align:middle;"></span> ' + missText}</span>
            <span class="cache-hint-count">${countDisplay}</span>
        </span>
        <span onclick="this.parentElement.remove();_cacheHintTimer=null;" style="cursor:pointer;padding:0 4px;opacity:0.8;"><span aria-hidden="true" class="ico ico-x" style="width:14px;height:14px;"></span></span>
    `;
    document.body.appendChild(bar);
    _cacheHintTimer = setTimeout(() => {
        _cacheHintTimer = null;
        _cacheHintCount = 0;
        _cacheHintType = null;
        const el = document.getElementById('cache-hint-bar');
        if (el) el.remove();
    }, 3000);
}

// ── 抽屉折叠/展开 ──
function toggleCollapse(titleEl) {
    const content = titleEl.nextElementSibling;
    const arrow = titleEl.querySelector('.collapse-arrow');
    if (!content) return;
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? '' : 'none';
    if (arrow) arrow.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
}

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('gitaap_lang', lang);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    window.location.href = url.toString();
}

async function showRepoDetail(repo, type) {
    closeDetailPopup();
    const label = type === 'stargazers' ? 'Star' : 'Fork';
    // 创建弹窗
    const overlay = document.createElement('div');
    overlay.className = 'detail-overlay';
    overlay.innerHTML = `<div class="detail-popup">
        <div class="detail-popup-header">
            <span class="detail-popup-title">${escHtml(label)} ${t('click-for-detail')} — ${escHtml(repo)}</span>
            <button class="detail-popup-close" onclick="closeDetailPopup()"><span aria-hidden="true" class="ico ico-x" style="width:16px;height:16px;"></span></button>
        </div>
        <div class="detail-popup-body" id="detail-popup-body">
            <div style="text-align:center;padding:30px;color:var(--text-dim);">
                <div class="spinner" style="width:24px;height:24px;border-width:3px;margin:0 auto;"></div>
                <p style="margin-top:8px;">' + t('loading') + '</p>
            </div>
        </div>
    </div>`;
    document.body.appendChild(overlay);
    _detailPopup = overlay;
    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeDetailPopup();
    });

    try {
        const data = await requestJson(`/repo-detail-list?repo=${encodeURIComponent(repo)}&detail_type=${encodeURIComponent(type)}`);
        const body = document.getElementById('detail-popup-body');
        if (!body) return;
        if (data.error || !Array.isArray(data.list)) {
            const errMsg = data.error || t('load-failed');
            body.innerHTML = `<p style="color:var(--text-dim);text-align:center;padding:20px;">${escHtml(errMsg)}</p>`;
            return;
        }
        if (data.list.length === 0) {
            body.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:20px;">' + t('detail-no-records').replace('{type}', label) + '</p>';
            return;
        }
        body.innerHTML = `<div class="detail-user-grid">${data.list.map(u => {
            const login = escHtml(u.login || '?');
            const avatar = escAttr(u.avatar || '');
            const url = escAttr(u.html_url || '#');
            const extra = type === 'forks' ? `<div style="font-size:0.75rem;color:var(--text-dim);">${escHtml(u.full_name || '')}</div>` : '';
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="detail-user-item">
                <img class="detail-user-avatar" src="${avatar}" alt="${login}" onerror="this.style.display='none'" loading="lazy">
                <div class="detail-user-info">
                    <div class="detail-user-login">${login}</div>
                    ${extra}
                </div>
            </a>`;
        }).join('')}</div>`;
    } catch (e) {
        const body = document.getElementById('detail-popup-body');
        if (body) body.innerHTML = `<p style="color:var(--text-dim);text-align:center;padding:20px;">${escHtml(e.message || t('load-failed'))}</p>`;
    }
}

function toggleBranchList() {
    const picker = document.getElementById('branch-picker');
    const btn = document.getElementById('branch-toggle-btn');
    if (!picker) return;
    if (picker.style.display === 'block') {
        picker.style.display = 'none';
        if (btn) btn.querySelector('.branch-btn-text').textContent = t('switch-branch');
    } else {
        picker.style.display = 'block';
        if (btn) btn.querySelector('.branch-btn-text').textContent = t('collapse-list');
        const repo = document.getElementById('repo').value;
        if (repo && repo !== currentBranchRepo) {
            currentBranchRepo = repo;
            loadBranchList(repo);
        }
    }
}

function selectBranch(repo, branch) {
    const branchEl = document.getElementById('drawer-stat-branch');
    if (branchEl) branchEl.textContent = branch;
    window._currentBranch = branch;
    // 关闭选择器
    const picker = document.getElementById('branch-picker');
    const btn = document.getElementById('branch-toggle-btn');
    if (picker) picker.style.display = 'none';
    if (btn) btn.querySelector('.branch-btn-text').textContent = t('switch-branch');
    // 重新加载文件树使用新分支
    const path = fileTreePath || '';
    loadFileTree(repo, path);
    loadReadme(repo);
}

// ═══════════════════════════════════════════════════
//  Releases — 分页（左右箭头 + 页码，缓存优先）
// ═══════════════════════════════════════════════════

var releasesPage = 1;
var releasesCache = {};  // {page: data}

// 通用缓存清理：移除过期条目 + 超限时淘汰最旧条目
function _trimCache(cache, maxSize) {
    var now = Date.now();
    var keys = Object.keys(cache);
    // 先清理所有过期条目
    keys.forEach(function(k) { if (cache[k].expiry <= now) delete cache[k]; });
    // 若仍超限，淘汰尚未过期的条目（按 expiry 升序）
    keys = Object.keys(cache);
    while (keys.length > maxSize) {
        var oldest = keys.reduce(function(a, b) { return cache[a].expiry < cache[b].expiry ? a : b; });
        delete cache[oldest];
        keys = Object.keys(cache);
    }
}

async function loadReleases(repo, page, propagateError) {
    const encoded = encodeURIComponent(repo);
    const el = document.getElementById('releases-list');
    const paginator = document.getElementById('releases-paginator');
    if (!el || !paginator) return;
    releasesPage = page || 1;

    showLoading(el);

    try {
        // 缓存优先（键包含 repo 名，防止切换仓库后数据错乱）
        const cacheKey = 'releases_' + repo + '_' + releasesPage;
        const cached = releasesCache[cacheKey];
        let data;
        if (cached && cached.expiry > Date.now()) {
            data = cached.data;
        } else {
            data = await requestJson(`/releases?repo=${encoded}&limit=10&page=${releasesPage}`);
            // 存入缓存
            releasesCache[cacheKey] = { data, expiry: Date.now() + 120000 };
            _trimCache(releasesCache, 5);
        }

        if (!isActiveRepo(repo)) return false;

        if (!Array.isArray(data) || data.length === 0) {
            el.innerHTML = `<p style="color:#8b98a6;text-align:center;padding:20px;">${t('no-releases')}</p>`;
            paginator.style.display = 'none';
            return;
        }
        const html = data.map((r, idx) => {
            const date = formatDate(r.published_at);
            const tag = r.tag_name || '';
            const name = escHtml(r.name || tag);
            const badge = r.prerelease ? `<span class="badge" style="background:#ff8c42;">${t('prerelease')}</span>` : r.draft ? `<span class="badge" style="background:#8b98a6;">${t('draft')}</span>` : `<span class="badge" style="background:var(--green);color:var(--on-green);">${t('released')}</span>`;
            const body = r.body || '';
            const bodyId = `release-body-${releasesPage}-${idx}`;
            const hasBody = body.length > 0;
            const titleLink = `/release?repo=${encoded}&tag=${encodeURIComponent(tag)}`;
            return `<div class="release-item" style="padding:10px 0; border-bottom:1px solid var(--border);">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <a href="${titleLink}" class="release-title" style="color:var(--cyan); font-weight:600; text-decoration:none;"
                       onclick="event.preventDefault(); loadReleaseDetailInline('${escAttr(repo)}','${escAttr(tag)}');">${name}</a>
                    ${badge}
                    <span style="color:var(--text-dim); font-size:0.85rem;">${date}</span>
                </div>
                ${hasBody ? `
                <div style="margin-top:6px;">
                    <button class="btn-collapse" onclick="toggleReleaseBody('${bodyId}')" data-i18n="click-to-expand">${t('click-to-expand')}</button>
                    <div id="${bodyId}" class="release-body-collapse">
                        <pre class="release-body-text">${escHtml(body.slice(0, 500))}${body.length > 500 ? '...' : ''}</pre>
                    </div>
                </div>` : ''}
            </div>`;
        }).join('');
        el.innerHTML = html;

        // 更新分页器
        const prevBtn = document.getElementById('releases-prev');
        const nextBtn = document.getElementById('releases-next');
        const pageInfo = document.getElementById('releases-page-info');
        if (prevBtn) prevBtn.disabled = releasesPage <= 1;
        if (nextBtn) nextBtn.disabled = data.length < 10;
        if (pageInfo) pageInfo.textContent = `${releasesPage}`;
        paginator.style.display = 'flex';

        // 批量渲染后一次性处理动画
        requestAnimationFrame(() => {
            observeAnimations();
        });
    } catch (error) {
        if (!isActiveRepo(repo)) return false;
        console.error('loadReleases:', error);
        el.innerHTML = `<p style="color:#8b98a6;text-align:center;padding:20px;">${t('load-failed')}</p>`;
        if (propagateError) throw error;
    }
}

function goReleasePage(page) {
    const repoEl = document.getElementById("repo");
    if (!repoEl) return;
    const repo = repoEl.value;
    if (repo) loadReleases(repo, page);
}

function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escAttr(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function githubRawUrl(repo, path, ref) {
    const encodedRepo = String(repo || '').split('/').map(encodeURIComponent).join('/');
    const encodedPath = String(path || '').replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
    const branch = ref === undefined ? (window._currentBranch || '') : ref;
    const url = `/github-raw/${encodedRepo}/${encodedPath}`;
    return branch ? `${url}?ref=${encodeURIComponent(branch)}` : url;
}

/**
 * 安全地渲染 Markdown：先用 marked 解析，再消毒 HTML 防止 XSS。
 * 移除 script 标签、事件处理属性、javascript: 链接等。
 */
function sanitizeHtml(html) {
    if (!html) return '';
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    html = html.replace(/\s+on\w+[\s\n\r\t]*=[\s\n\r\t]*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    html = html.replace(/(<[^>]*?)\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '$1');
    html = html.replace(/(?:href|src|action|formaction)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (match) => {
        if (/javascript\s*:/i.test(match) || /&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;/i.test(match)) {
            return match.replace(/(javascript\s*:)/gi, 'blocked:');
        }
        return match;
    });
    html = html.replace(/(?:href|src|action|formaction)\s*=\s*"data:text\/html[^"]*"/gi, 'href="#blocked"');
    html = html.replace(/(?:href|src|action|formaction)\s*=\s*'data:text\/html[^']*'/gi, "href='#blocked'");
    html = html.replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '');
    html = html.replace(/<iframe\b[^>]*\/>/gi, '');
    html = html.replace(/<object\b[^>]*>.*?<\/object>/gi, '');
    html = html.replace(/<embed\b[^>]*\/?>/gi, '');
    html = html.replace(/<base\b[^>]*\/?>/gi, '');
    html = html.replace(/<meta\b[^>]*http-equiv\s*=\s*['\"]?refresh[^>]*\/?>/gi, '');
    html = html.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');
    html = html.replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, '');
    html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '');
    return html;
}

function safeMarked(content) {
    if (typeof marked !== 'undefined' && content) {
        return sanitizeHtml(marked.parse(content));
    }
    return escHtml(content || '');
}

// 对 Markdown 渲染后的 DOM 中的代码块应用语法高亮
function highlightCodeBlocks(root) {
    if (typeof hljs === 'undefined') return;
    root.querySelectorAll('pre code').forEach(block => {
        // 跳过已经高亮过的代码块
        if (block.classList.contains('hljs')) return;
        try {
            hljs.highlightElement(block);
        } catch (e) {
            // 高亮失败时静默处理
        }
    });
}

function toggleReleaseBody(id) {
    const el = document.getElementById(id);
    if (!el) return;
    // 找前一个兄弟元素中的 btn-collapse 按钮
    let btn = el.previousElementSibling;
    while (btn && !btn.classList.contains('btn-collapse')) {
        btn = btn.previousElementSibling;
    }
    if (!btn) return;
    const isOpen = el.classList.toggle('open');
    btn.textContent = isOpen ? t('collapse') : t('click-to-expand');
}

// ═══════════════════════════════════════════════════
//  Commits — 分页（箭头+页码，缓存优先）
// ═══════════════════════════════════════════════════

var commitsPage = 1;
var commitsCache = {};

async function loadCommits(repo, page, propagateError) {
    const encoded = encodeURIComponent(repo);
    const el = document.getElementById('commits-list');
    const paginator = document.getElementById('commits-paginator');
    if (!el || !paginator) return;
    commitsPage = page || 1;
    showLoading(el);

    try {
        const cacheKey = 'commits_' + repo + '_' + commitsPage;
        const cached = commitsCache[cacheKey];
        let data;
        if (cached && cached.expiry > Date.now()) {
            data = cached.data;
        } else {
            data = await requestJson(`/commits?repo=${encoded}&limit=10&page=${commitsPage}`);
            commitsCache[cacheKey] = { data, expiry: Date.now() + 120000 };
            _trimCache(commitsCache, 5);
        }

        if (!isActiveRepo(repo)) return false;

        if (!Array.isArray(data) || data.length === 0) {
            el.innerHTML = `<p style="color:#8b98a6;text-align:center;padding:20px;">${t('no-commits')}</p>`;
            paginator.style.display = 'none';
            return;
        }
        const html = data.map(c => {
            const date = formatDate(c.date);
            return `<div class="commit-item" style="padding:8px 0; border-bottom:1px solid var(--border); display:flex; gap:8px; align-items:flex-start;">
                <a href="/commit?repo=${encoded}&sha=${c.sha}" target="_blank" rel="noopener noreferrer">
                    <code style="color:#79ffe1; font-size:0.8rem; white-space:nowrap; min-width:55px; cursor:pointer;">${c.sha || ''}</code>
                </a>
                <div style="flex:1;">
                    <a href="/commit?repo=${encoded}&sha=${c.sha}" style="color:#c9d1d9; text-decoration:none;">${escHtml(c.message || '?')}</a>
                    <div style="font-size:0.8rem; color:#8b98a6; margin-top:2px;">${c.author || '?'} · ${date}</div>
                </div>
            </div>`;
        }).join('');
        el.innerHTML = html;

        const prevBtn = document.getElementById('commits-prev');
        const nextBtn = document.getElementById('commits-next');
        const pageInfo = document.getElementById('commits-page-info');
        if (prevBtn) prevBtn.disabled = commitsPage <= 1;
        if (nextBtn) nextBtn.disabled = data.length < 10;
        if (pageInfo) pageInfo.textContent = `${commitsPage}`;
        paginator.style.display = 'flex';

        requestAnimationFrame(() => { observeAnimations(); });
    } catch (error) {
        if (!isActiveRepo(repo)) return false;
        console.error('loadCommits:', error);
        el.innerHTML = `<p style="color:#8b98a6;text-align:center;padding:20px;">${t('load-failed')}</p>`;
        if (propagateError) throw error;
    }
}

function goCommitPage(page) {
    const repoEl = document.getElementById("repo");
    if (!repoEl) return;
    const repo = repoEl.value;
    if (repo) loadCommits(repo, page);
}

// ═══════════════════════════════════════════════════
//  Issues — 分页（箭头+页码，缓存优先）
// ═══════════════════════════════════════════════════

var issuesPage = 1;
var issuesCache = {};
var issuesState = 'open';
var _issuesReqId = 0;

async function loadIssues(repo, page, state, propagateError) {
    const reqId = ++_issuesReqId;
    const encoded = encodeURIComponent(repo);
    const tbody = document.getElementById('issues-body');
    const paginator = document.getElementById('issues-paginator');
    if (!tbody || !paginator) return;
    issuesPage = page || 1;
    if (state) issuesState = state;

    document.querySelectorAll('.issues-state-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.state === issuesState);
    });

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;"><div class="spinner" style="margin:0 auto;width:24px;height:24px;border-width:3px;"></div><p style="color:var(--text-dim);margin-top:8px;">' + t('loading') + '</p></td></tr>';

    try {
        const cacheKey = 'issues_' + repo + '_' + issuesPage + '_' + issuesState;
        const cached = issuesCache[cacheKey];
        let data;
        if (cached && cached.expiry > Date.now()) {
            data = cached.data;
        } else {
            data = await requestJson(`/issues?repo=${encoded}&limit=10&page=${issuesPage}&state=${issuesState}`);
            // 请求 ID 防竞态：只应用最新一次请求的结果
            if (reqId !== _issuesReqId) return;
            issuesCache[cacheKey] = { data, expiry: Date.now() + 120000 };
            _trimCache(issuesCache, 8);
        }

        if (!isActiveRepo(repo)) return false;

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);">${t('no-issues')}</td></tr>`;
            paginator.style.display = 'none';
            return;
        }
        tbody.innerHTML = data.map(i => {
            const date = formatDate(i.updated_at);
            const labels = (i.labels || []).map(l => `<span class="badge" style="font-size:0.7rem;padding:2px 6px;">${escHtml(l)}</span>`).join(' ');
            const stateColor = i.state === 'closed' ? '#f85149' : '#238636';
            const stateText = i.state === 'closed' ? t('closed') : t('open');
            return `<tr>
                <td data-label="#">${i.number ? `<a href="/issue?repo=${encoded}&number=${i.number}" style="color:var(--cyan);font-weight:500;">#${i.number}</a>` : '—'}</td>
                <td data-label="${t('title')}"><a href="/issue?repo=${encoded}&number=${i.number}" style="color:var(--text);text-decoration:none;word-break:break-word;">${escHtml(i.title)}</a></td>
                <td data-label="${t('status')}" style="white-space:nowrap;"><span class="badge" style="background:${stateColor};">${stateText}</span></td>
                <td data-label="${t('labels')}" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${labels || '—'}</td>
                <td data-label="${t('updated')}" style="font-size:0.85rem;color:var(--text-dim);white-space:nowrap;">${date}</td>
            </tr>`;
        }).join('');

        const prevBtn = document.getElementById('issues-prev');
        const nextBtn = document.getElementById('issues-next');
        const pageInfo = document.getElementById('issues-page-info');
        if (prevBtn) prevBtn.disabled = issuesPage <= 1;
        if (nextBtn) nextBtn.disabled = data.length < 10;
        if (pageInfo) pageInfo.textContent = `${issuesPage}`;
        paginator.style.display = 'flex';

        requestAnimationFrame(() => { observeAnimations(); });
    } catch (error) {
        if (!isActiveRepo(repo)) return false;
        if (reqId !== _issuesReqId) return;
        console.error('loadIssues:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);">${t('load-failed')}</td></tr>`;
        if (propagateError) throw error;
    }
}

function goIssuePage(page) {
    const repoEl = document.getElementById("repo");
    if (!repoEl) return;
    const repo = repoEl.value;
    if (repo) loadIssues(repo, page);
}

// ═══════════════════════════════════════════════════
//  Pull Requests — 分页（箭头+页码，缓存优先）
// ═══════════════════════════════════════════════════

var pullsPage = 1;
var pullsCache = {};
var pullsState = 'open';
var _pullsReqId = 0;

async function loadPulls(repo, page, state, propagateError) {
    const reqId = ++_pullsReqId;
    const encoded = encodeURIComponent(repo);
    const tbody = document.getElementById('pulls-body');
    const paginator = document.getElementById('pulls-paginator');
    if (!tbody || !paginator) return;
    pullsPage = page || 1;
    if (state) pullsState = state;

    document.querySelectorAll('.pulls-state-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.state === pullsState);
    });

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;"><div class="spinner" style="margin:0 auto;width:24px;height:24px;border-width:3px;"></div><p style="color:#8b98a6;margin-top:8px;">' + t('loading') + '</p></td></tr>';

    try {
        const cacheKey = 'pulls_' + repo + '_' + pullsPage + '_' + pullsState;
        const cached = pullsCache[cacheKey];
        let data;
        if (cached && cached.expiry > Date.now()) {
            data = cached.data;
        } else {
            data = await requestJson(`/pulls?repo=${encoded}&limit=10&page=${pullsPage}&state=${pullsState}`);
            // 请求 ID 防竞态：只应用最新一次请求的结果
            if (reqId !== _pullsReqId) return;
            pullsCache[cacheKey] = { data, expiry: Date.now() + 120000 };
            _trimCache(pullsCache, 8);
        }

        if (!isActiveRepo(repo)) return false;

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#8b98a6;">${t('no-prs')}</td></tr>`;
            paginator.style.display = 'none';
            return;
        }
        tbody.innerHTML = data.map(pr => {
            const date = formatDate(pr.updated_at);
            const labels = (pr.labels || []).map(l => `<span class="badge" style="font-size:0.7rem;padding:2px 6px;">${escHtml(l)}</span>`).join(' ');
            const draftBadge = pr.draft ? `<span class="badge" style="background:#8b98a6;">${t('draft')}</span>` : '';
            const prLink = `/pull?repo=${encoded}&number=${pr.number}`;
            return `<tr>
                <td data-label="#">${pr.number ? `<a href="${prLink}" style="color:#79ffe1;font-weight:500;">#${pr.number}</a>` : '—'}</td>
                <td data-label="${t('title')}"><a href="${prLink}" style="color:var(--text);text-decoration:none;font-weight:500;word-break:break-word;">${escHtml(pr.title)}</a></td>
                <td data-label="${t('status')}" style="white-space:nowrap;"><span class="badge" style="background:${pr.merged ? '#8957e5' : pr.state === 'closed' ? '#f85149' : '#238636'};">${pr.merged ? t('merged') : pr.state === 'closed' ? t('closed') : t('open')}</span>${draftBadge}</td>
                <td data-label="${t('labels')}" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${labels || '—'}</td>
                <td data-label="${t('updated')}" style="font-size:0.85rem;color:#8b98a6;white-space:nowrap;">${date}</td>
            </tr>`;
        }).join('');

        const prevBtn = document.getElementById('pulls-prev');
        const nextBtn = document.getElementById('pulls-next');
        const pageInfo = document.getElementById('pulls-page-info');
        if (prevBtn) prevBtn.disabled = pullsPage <= 1;
        if (nextBtn) nextBtn.disabled = data.length < 10;
        if (pageInfo) pageInfo.textContent = `${pullsPage}`;
        paginator.style.display = 'flex';

        requestAnimationFrame(() => { observeAnimations(); });
    } catch (error) {
        if (!isActiveRepo(repo)) return false;
        if (reqId !== _pullsReqId) return;
        console.error('loadPulls:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#8b98a6;">${t('load-failed')}</td></tr>`;
        if (propagateError) throw error;
    }
}

function goPullPage(page) {
    const repoEl = document.getElementById("repo");
    if (!repoEl) return;
    const repo = repoEl.value;
    if (repo) loadPulls(repo, page, pullsState);
}

function proxyUrl(url) {
    if (!url) return 'javascript:void(0)';
    try {
        var parsed = new URL(url);
        var host = parsed.hostname;
        if (parsed.protocol !== 'https:') return 'javascript:void(0)';
        if (host !== 'github.com' && host !== 'api.github.com' && !host.endsWith('.github.com') && !host.endsWith('.githubusercontent.com') && !host.endsWith('.s3.amazonaws.com') && !host.endsWith('.amazonaws.com.cn')) return 'javascript:void(0)';
    } catch (_) {
        return 'javascript:void(0)';
    }
    return '/release-proxy?url=' + encodeURIComponent(url);
}

// ═══════════════════════════════════════════════════
//  Release 详情页（独立页面）
// ═══════════════════════════════════════════════════

async function loadReleaseDetail() {
    const repo = getQueryParam('repo');
    const tag = getQueryParam('tag');
    if (!repo || !tag) {
        showError('Missing repo or tag parameter');
        return;
    }
    setText('release-tag', tag);

    try {
        const data = await requestJson(`/release-detail?repo=${encodeURIComponent(repo)}&tag=${encodeURIComponent(tag)}`);
        if (data.error) {
            showError(data.error);
            return;
        }

        const loadingEl = document.getElementById('release-loading');
        const contentEl = document.getElementById('release-content');
        if (!contentEl) return;
        if (loadingEl) loadingEl.style.display = 'none';
        contentEl.style.display = 'block';

        // 基本信息
        setText('release-name', data.name || data.tag_name);
        setText('release-tag-badge', data.tag_name);
        document.getElementById('release-tag-badge').className = 'badge';
        setText('release-date', formatDate(data.published_at));
        setText('release-author', data.author || '—');
        document.getElementById('release-github-link').href = data.html_url || '#';

        const statusBadge = document.getElementById('release-status-badge');
        if (statusBadge) {
            if (data.prerelease) {
                statusBadge.textContent = t('prerelease');
                statusBadge.style.background = '#ff8c42';
                statusBadge.style.display = 'inline-block';
            } else if (data.draft) {
                statusBadge.textContent = t('draft');
                statusBadge.style.background = '#8b98a6';
                statusBadge.style.display = 'inline-block';
            } else {
                statusBadge.style.display = 'none';
            }
        }

        // 发布说明（Markdown 渲染）
        const bodyEl = document.getElementById('release-body');
        if (data.body) {
            if (typeof marked !== 'undefined') {
                bodyEl.innerHTML = safeMarked(data.body);
                bodyEl.querySelectorAll('table').forEach(t => t.classList.add('data-table'));
                highlightCodeBlocks(bodyEl);
                bodyEl.querySelectorAll('img').forEach(img => {
                    const src = img.getAttribute('src') || '';
                    if (src && !src.startsWith('http') && !src.startsWith('/github-raw') && !src.startsWith('data:')) {
                        img.src = githubRawUrl(repo, src, '');
                    }
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '6px';
                });
                bodyEl.querySelectorAll('pre code').forEach(b => {
                    b.style.background = 'rgba(0,0,0,0.2)';
                    b.style.padding = '12px';
                    b.style.borderRadius = '6px';
                    b.style.display = 'block';
                    b.style.overflowX = 'auto';
                });
            } else {
                bodyEl.innerHTML = '<pre class="release-body-full">' + escHtml(data.body) + '</pre>';
            }
        } else {
            bodyEl.innerHTML = '<p style="color:#8b98a6;">—</p>';
        }

        // 源码包
        const sourceEl = document.getElementById('release-source');
        let sourceHtml = '';
        if (data.zipball_url) {
            const srcInfo = { name: 'source-code.zip', size: 0, content_type: 'application/zip', browser_download_url: data.zipball_url, sha256: null, is_source: true };
            sourceHtml += `<div class="asset-item" style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--bg-dim); border:1px solid var(--border); border-radius:8px; margin-bottom:6px;">
                <span aria-hidden="true" class="ico ico-package ico-cyan" style="flex-shrink:0;width:18px;height:18px;"></span>
                <span class="asset-name" style="flex:1; min-width:0; font-size:0.85rem;">${t('source-code-zip')}</span>
                <button class="btn-sm" data-asset="${encodeAssetDetail(srcInfo)}" onclick="showAssetDetail(this.dataset.asset)" style="padding:2px 6px; font-size:0.7rem; flex-shrink:0;" title="${t('view-detail')}">
                    <span aria-hidden="true" class="ico ico-info" style="width:14px;height:14px;"></span>
                </button>
                <a href="${proxyUrl(data.zipball_url)}" class="btn-sm" target="_blank" rel="noopener noreferrer" style="padding:2px 8px; font-size:0.7rem; flex-shrink:0; text-decoration:none;" title="${t('download')}">
                    <span aria-hidden="true" class="ico ico-download" style="width:14px;height:14px;"></span>
                </a>
            </div>`;
        }
        if (data.tarball_url) {
            const srcInfo = { name: 'source-code.tar.gz', size: 0, content_type: 'application/gzip', browser_download_url: data.tarball_url, sha256: null, is_source: true };
            sourceHtml += `<div class="asset-item" style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--bg-dim); border:1px solid var(--border); border-radius:8px; margin-bottom:6px;">
                <span aria-hidden="true" class="ico ico-package ico-cyan" style="flex-shrink:0;width:18px;height:18px;"></span>
                <span class="asset-name" style="flex:1; min-width:0; font-size:0.85rem;">${t('source-code-tar')}</span>
                <button class="btn-sm" data-asset="${encodeAssetDetail(srcInfo)}" onclick="showAssetDetail(this.dataset.asset)" style="padding:2px 6px; font-size:0.7rem; flex-shrink:0;" title="${t('view-detail')}">
                    <span aria-hidden="true" class="ico ico-info" style="width:14px;height:14px;"></span>
                </button>
                <a href="${proxyUrl(data.tarball_url)}" class="btn-sm" target="_blank" rel="noopener noreferrer" style="padding:2px 8px; font-size:0.7rem; flex-shrink:0; text-decoration:none;" title="${t('download')}">
                    <span aria-hidden="true" class="ico ico-download" style="width:14px;height:14px;"></span>
                </a>
            </div>`;
        }
        sourceEl.innerHTML = sourceHtml || `<p style="color:#8b98a6;">—</p>`;

        // 附件资源
        const assetsEl = document.getElementById('release-assets');
        if (data.assets && data.assets.length > 0) {
            assetsEl.innerHTML = data.assets.map((a, idx) => {
                return `
                <div class="asset-item" style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--bg-dim); border:1px solid var(--border); border-radius:8px; margin-bottom:6px;">
                    <span aria-hidden="true" class="ico ico-attachment ico-dim" style="flex-shrink:0;width:18px;height:18px;"></span>
                    <span class="asset-name" style="flex:1; min-width:0; word-break:break-all; font-size:0.85rem;">${escHtml(a.name)}</span>
                    <span class="asset-meta" style="font-size:0.75rem; color:var(--text-dim); white-space:nowrap;">${formatBytes(a.size)}</span>
                    <button class="btn-sm" data-asset="${encodeAssetDetail(a)}" onclick="showAssetDetail(this.dataset.asset)" style="padding:2px 6px; font-size:0.7rem; flex-shrink:0;" title="${t('view-detail')}">
                        <span aria-hidden="true" class="ico ico-info" style="width:14px;height:14px;"></span>
                    </button>
                    <a href="${proxyUrl(a.browser_download_url)}" class="btn-sm" target="_blank" rel="noopener noreferrer" style="padding:2px 8px; font-size:0.7rem; flex-shrink:0; text-decoration:none;" title="${t('download')}">
                        <span aria-hidden="true" class="ico ico-download" style="width:14px;height:14px;"></span>
                    </a>
                </div>`;
            }).join('');
        } else {
            assetsEl.innerHTML = '<p style="color:#8b98a6;">—</p>';
        }

        observeAnimations();
    } catch (error) {
        showError(error.message);
    }
}

/**
 * 在仪表盘内联加载 Release 详情（带动画切换标签）
 */
async function loadReleaseDetailInline(repo, tag) {
    if (!repo || !tag) return;
    // 设置面包屑
    const bc = document.getElementById('release-detail-breadcrumb');
    if (bc) bc.textContent = repo + ' / ' + tag;
    // 切换到 release-detail 标签
    switchTab('release-detail');

    // 显示加载中
    const loading = document.getElementById('release-loading');
    const content = document.getElementById('release-content');
    const error = document.getElementById('release-error');
    if (loading) loading.style.display = 'block';
    if (content) content.style.display = 'none';
    if (error) error.style.display = 'none';

    try {
        const data = await requestJson(`/release-detail?repo=${encodeURIComponent(repo)}&tag=${encodeURIComponent(tag)}`);
        if (data.error) {
            if (error) {
                error.style.display = 'block';
                const msg = document.getElementById('release-error-message');
                if (msg) msg.textContent = `${t('load-failed')}: ${data.error}`;
            }
            if (loading) loading.style.display = 'none';
            return;
        }

        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';

        // 基本信息
        const nameEl = document.getElementById('release-name');
        if (nameEl) nameEl.textContent = data.name || data.tag_name;
        const tagBadge = document.getElementById('release-tag-badge');
        if (tagBadge) { tagBadge.textContent = data.tag_name; tagBadge.className = 'badge'; }
        const dateEl = document.getElementById('release-date');
        if (dateEl) dateEl.textContent = formatDate(data.published_at);
        const authorEl = document.getElementById('release-author');
        if (authorEl) authorEl.textContent = data.author || '—';
        const ghLinkTop = document.getElementById('release-detail-github-link-top');
        if (ghLinkTop) ghLinkTop.href = data.html_url || '#';

        const statusBadge = document.getElementById('release-status-badge');
        if (statusBadge) {
            if (data.prerelease) {
                statusBadge.textContent = t('prerelease');
                statusBadge.style.background = '#ff8c42';
                statusBadge.style.display = 'inline-block';
            } else if (data.draft) {
                statusBadge.textContent = t('draft');
                statusBadge.style.background = '#8b98a6';
                statusBadge.style.display = 'inline-block';
            } else {
                statusBadge.textContent = t('released');
                statusBadge.style.background = 'var(--green)';
                statusBadge.style.color = 'var(--on-green)';
                statusBadge.style.display = 'inline-block';
            }
        }

        // 发布说明（Markdown 渲染）
        const bodyEl = document.getElementById('release-body');
        window._releaseOriginalBody = data.body || '';
        window._releaseTranslatedBody = '';
        if (bodyEl) {
            if (data.body) {
                if (typeof marked !== 'undefined') {
                    bodyEl.innerHTML = safeMarked(data.body);
                    bodyEl.querySelectorAll('table').forEach(t => t.classList.add('data-table'));
                    highlightCodeBlocks(bodyEl);
                    bodyEl.querySelectorAll('img').forEach(img => {
                        const src = img.getAttribute('src') || '';
                        if (src && !src.startsWith('http') && !src.startsWith('/github-raw') && !src.startsWith('data:')) {
                            img.src = githubRawUrl(repo, src, '');
                        }
                        img.style.maxWidth = '100%';
                        img.style.borderRadius = '6px';
                    });
                    bodyEl.querySelectorAll('pre code').forEach(b => {
                        b.style.background = 'rgba(0,0,0,0.2)';
                        b.style.padding = '12px';
                        b.style.borderRadius = '6px';
                        b.style.display = 'block';
                        b.style.overflowX = 'auto';
                    });
                } else {
                    bodyEl.innerHTML = '<pre class="release-body-full">' + escHtml(data.body) + '</pre>';
                }
            } else {
                bodyEl.innerHTML = '<p style="color:var(--text-dim);">—</p>';
            }
        }

        // 翻译按钮状态
        const translateBtn = document.getElementById('release-translate-btn');
        if (translateBtn) {
            translateBtn.style.display = window._releaseOriginalBody ? 'inline-flex' : 'none';
            translateBtn.dataset.translated = 'false';
            translateBtn.textContent = t('translate');
            window._releaseTranslatedBody = '';
        }

        // 源码包
        const sourceEl = document.getElementById('release-source');
        if (sourceEl) {
            let sourceHtml = '';
            if (data.zipball_url) {
                const srcInfo = { name: 'source-code.zip', size: 0, content_type: 'application/zip', browser_download_url: data.zipball_url, sha256: null, is_source: true };
                sourceHtml += `<div class="asset-item" style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--bg-dim); border:1px solid var(--border); border-radius:8px; margin-bottom:6px;">
                    <span aria-hidden="true" class="ico ico-package ico-cyan" style="flex-shrink:0;width:18px;height:18px;"></span>
                    <span class="asset-name" style="flex:1; min-width:0; font-size:0.85rem;">${t('source-code-zip')}</span>
                    <button class="btn-sm" data-asset="${encodeAssetDetail(srcInfo)}" onclick="showAssetDetail(this.dataset.asset)" style="padding:2px 6px; font-size:0.7rem; flex-shrink:0;" title="${t('view-detail')}">
                        <span aria-hidden="true" class="ico ico-info" style="width:14px;height:14px;"></span>
                    </button>
                    <a href="${proxyUrl(data.zipball_url)}" class="btn-sm" target="_blank" rel="noopener noreferrer" style="padding:2px 8px; font-size:0.7rem; flex-shrink:0; text-decoration:none;" title="${t('download')}">
                        <span aria-hidden="true" class="ico ico-download" style="width:14px;height:14px;"></span>
                    </a>
                </div>`;
            }
            if (data.tarball_url) {
                const srcInfo = { name: 'source-code.tar.gz', size: 0, content_type: 'application/gzip', browser_download_url: data.tarball_url, sha256: null, is_source: true };
                sourceHtml += `<div class="asset-item" style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--bg-dim); border:1px solid var(--border); border-radius:8px; margin-bottom:6px;">
                    <span aria-hidden="true" class="ico ico-package ico-cyan" style="flex-shrink:0;width:18px;height:18px;"></span>
                    <span class="asset-name" style="flex:1; min-width:0; font-size:0.85rem;">${t('source-code-tar')}</span>
                    <button class="btn-sm" data-asset="${encodeAssetDetail(srcInfo)}" onclick="showAssetDetail(this.dataset.asset)" style="padding:2px 6px; font-size:0.7rem; flex-shrink:0;" title="${t('view-detail')}">
                        <span aria-hidden="true" class="ico ico-info" style="width:14px;height:14px;"></span>
                    </button>
                    <a href="${proxyUrl(data.tarball_url)}" class="btn-sm" target="_blank" rel="noopener noreferrer" style="padding:2px 8px; font-size:0.7rem; flex-shrink:0; text-decoration:none;" title="${t('download')}">
                        <span aria-hidden="true" class="ico ico-download" style="width:14px;height:14px;"></span>
                    </a>
                </div>`;
            }
            sourceEl.innerHTML = sourceHtml || '<p style="color:var(--text-dim);">—</p>';
        }

        // 附件资源
        const assetsEl = document.getElementById('release-assets');
        if (assetsEl) {
            if (data.assets && data.assets.length > 0) {
                assetsEl.innerHTML = data.assets.map(a => {
                    return `
                    <div class="asset-item" style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--bg-dim); border:1px solid var(--border); border-radius:8px; margin-bottom:6px;">
                        <span aria-hidden="true" class="ico ico-attachment ico-dim" style="flex-shrink:0;width:18px;height:18px;"></span>
                        <span class="asset-name" style="flex:1; min-width:0; word-break:break-all; font-size:0.85rem;">${escHtml(a.name)}</span>
                        <span class="asset-meta" style="font-size:0.75rem; color:var(--text-dim); white-space:nowrap;">${formatBytes(a.size)}</span>
                        <button class="btn-sm" data-asset="${encodeAssetDetail(a)}" onclick="showAssetDetail(this.dataset.asset)" style="padding:2px 6px; font-size:0.7rem; flex-shrink:0;" title="${t('view-detail')}">
                            <span aria-hidden="true" class="ico ico-info" style="width:14px;height:14px;"></span>
                        </button>
                        <a href="${proxyUrl(a.browser_download_url)}" class="btn-sm" target="_blank" rel="noopener noreferrer" style="padding:2px 8px; font-size:0.7rem; flex-shrink:0; text-decoration:none;" title="${t('download')}">
                            <span aria-hidden="true" class="ico ico-download" style="width:14px;height:14px;"></span>
                        </a>
                    </div>`;
                }).join('');
            } else {
                assetsEl.innerHTML = '<p style="color:var(--text-dim);">—</p>';
            }
        }

        observeAnimations();
    } catch (err) {
        if (loading) loading.style.display = 'none';
        if (error) {
            error.style.display = 'block';
            const msg = document.getElementById('release-error-message');
            if (msg) msg.textContent = `${t('load-failed')}: ${err.message}`;
        }
    }
}

/**
 * 翻译 Release 正文（中英文切换）
 */
async function translateReleaseBody() {
    const btn = document.getElementById('release-translate-btn');
    const bodyEl = document.getElementById('release-body');
    if (!btn || !bodyEl) return;
    const isTranslated = btn.dataset.translated === 'true';

    if (isTranslated) {
        // 切回原文
        if (typeof marked !== 'undefined') {
            bodyEl.innerHTML = safeMarked(window._releaseOriginalBody || '');
        } else {
            bodyEl.innerHTML = '<pre class="release-body-full">' + escHtml(window._releaseOriginalBody || '') + '</pre>';
        }
        btn.dataset.translated = 'false';
        btn.textContent = t('translate');
        return;
    }

    // 如果已缓存翻译结果，直接显示
    if (window._releaseTranslatedBody) {
        if (typeof marked !== 'undefined') {
            bodyEl.innerHTML = safeMarked(window._releaseTranslatedBody);
        } else {
            bodyEl.innerHTML = '<pre class="release-body-full">' + escHtml(window._releaseTranslatedBody) + '</pre>';
        }
        btn.dataset.translated = 'true';
        btn.textContent = t('original');
        return;
    }

    // 调用后端翻译接口
    btn.textContent = t('translating');
    btn.disabled = true;
    try {
        const textToTranslate = window._releaseOriginalBody || '';
        if (!textToTranslate) { btn.textContent = t('translate'); btn.disabled = false; return; }
        const result = await requestJson('/translate?text=' + encodeURIComponent(textToTranslate.slice(0, 1000)));
        if (result.error) {
            btn.textContent = t('translate-failed');
            setTimeout(() => { btn.textContent = t('translate'); btn.disabled = false; }, 2000);
            return;
        }
        window._releaseTranslatedBody = result.translated;
        if (typeof marked !== 'undefined') {
            bodyEl.innerHTML = safeMarked(result.translated);
        } else {
            bodyEl.innerHTML = '<pre class="release-body-full">' + escHtml(result.translated) + '</pre>';
        }
        btn.dataset.translated = 'true';
        btn.textContent = t('original');
        btn.disabled = false;
    } catch (e) {
        btn.textContent = t('translate-failed');
        setTimeout(() => { btn.textContent = t('translate'); btn.disabled = false; }, 2000);
    }
}

function showError(msg) {
    const loadingEl = document.getElementById('release-loading');
    if (loadingEl) loadingEl.style.display = 'none';
    const errEl = document.getElementById('release-error');
    if (!errEl) return;
    errEl.style.display = 'block';
    const msgEl = document.getElementById('release-error-message');
    if (msgEl) msgEl.textContent = `${t('load-failed')}: ${msg}`;
}

// ═══════════════════════════════════════════════════
//  PR 详情页（独立页面）
// ═══════════════════════════════════════════════════

async function loadPullDetail() {
    const repo = getQueryParam('repo');
    const number = getQueryParam('number');
    if (!repo || !number) { showPullError('Missing repo or number'); return; }
    try {
        const data = await requestJson(`/pull-detail?repo=${encodeURIComponent(repo)}&number=${number}`);
        if (data.error) { showPullError(data.error); return; }
        document.getElementById('pr-skeleton').style.display = 'none';
        document.getElementById('pr-content').style.display = 'block';

        setText('pr-title', data.title || '?');
        const stateBadge = document.getElementById('pr-state-badge');
        if (data.merged) { stateBadge.innerHTML = '<span aria-hidden="true" class="ico ico-check ico-white ico-gap"></span>' + t('merged'); stateBadge.style.background = '#8957e5'; }
        else if (data.state === 'closed') { stateBadge.innerHTML = '<span aria-hidden="true" class="ico ico-x ico-white ico-gap"></span>' + t('closed'); stateBadge.style.background = '#f85149'; }
        else { stateBadge.innerHTML = '<span aria-hidden="true" class="ico ico-pr ico-white ico-gap"></span>' + t('open'); stateBadge.style.background = '#238636'; }
        const draftBadge = document.getElementById('pr-draft-badge');
        if (data.draft) { draftBadge.style.display = 'inline-block'; } else { draftBadge.style.display = 'none'; }
        const labelsEl = document.getElementById('pr-labels');
        if (data.labels && data.labels.length) { labelsEl.innerHTML = data.labels.map(l => `<span class="badge" style="font-size:0.7rem;">${escHtml(l)}</span>`).join(''); }
        setText('pr-author', data.user || '?');
        setHTML('pr-meta-dates', `<span aria-hidden="true" class="ico ico-clock ico-dim ico-gap"></span>${data.created_at ? formatDate(data.created_at) : '?'}`);
        if (data.updated_at) {
            const metaEl = document.getElementById('pr-meta-dates');
            metaEl.innerHTML += ` | ${t('updated')}: ${formatDate(data.updated_at)}`;
        }
        document.getElementById('pr-github-link').href = data.html_url || '#';
        setText('pr-additions', data.additions || 0);
        setText('pr-deletions', data.deletions || 0);
        setText('pr-changed-files', data.changed_files || 0);
        setText('pr-commits-count', data.commits_count || 0);

        // 分支信息
        const branchEl = document.getElementById('pr-branch-detail');
        if (branchEl) {
            branchEl.innerHTML = `
                <div style="display:flex;gap:12px;flex-wrap:wrap;padding:8px 0;">
                    <div style="flex:1;min-width:200px;"><span style="color:#8b98a6;">${t('base')}:</span> <code style="color:#79c0ff;">${data.base_ref || '?'}</code> <span style="font-size:0.8rem;color:#8b98a6;">${data.base_repo ? '('+data.base_repo+')' : ''}</span></div>
                    <div style="flex:1;min-width:200px;"><span style="color:#8b98a6;">${t('head')}:</span> <code style="color:#79c0ff;">${data.head_ref || '?'}</code> <span style="font-size:0.8rem;color:#8b98a6;">${data.head_repo ? '('+data.head_repo+')' : ''}</span></div>
                </div>
                ${data.assignees && data.assignees.length ? `<div style="margin-top:4px;"><span aria-hidden="true" class="ico ico-person ico-dim ico-gap"></span>Assignees: ${data.assignees.map(a => `<span class="badge" style="font-size:0.75rem;">${escHtml(a)}</span>`).join(' ')}</div>` : ''}
                ${data.requested_reviewers && data.requested_reviewers.length ? `<div style="margin-top:4px;"><span aria-hidden="true" class="ico ico-eye ico-dim ico-gap"></span>Reviewers: ${data.requested_reviewers.map(r => `<span class="badge" style="font-size:0.75rem;background:#1f6feb;">${escHtml(r)}</span>`).join(' ')}</div>` : ''}
            `;
        }

        // PR 正文（Markdown 渲染）
        const bodyEl = document.getElementById('pr-body');
        if (data.body) {
            if (typeof marked !== 'undefined') {
                bodyEl.innerHTML = safeMarked(data.body);
                bodyEl.querySelectorAll('table').forEach(t => t.classList.add('data-table'));
                highlightCodeBlocks(bodyEl);
                bodyEl.querySelectorAll('img').forEach(img => {
                    const src = img.getAttribute('src') || '';
                    if (src && !src.startsWith('http') && !src.startsWith('/github-raw') && !src.startsWith('data:')) {
                        img.src = githubRawUrl(repo, src, '');
                    }
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '6px';
                });
                bodyEl.querySelectorAll('pre code').forEach(b => {
                    b.style.background = 'rgba(0,0,0,0.2)';
                    b.style.padding = '12px';
                    b.style.borderRadius = '6px';
                    b.style.display = 'block';
                    b.style.overflowX = 'auto';
                });
            } else {
                bodyEl.innerHTML = '<pre class="release-body-full">' + escHtml(data.body) + '</pre>';
            }
        } else {
            bodyEl.innerHTML = '<p style="color:#8b98a6;">—</p>';
        }

        // 变更文件列表（可展开显示 diff）
        const filesEl = document.getElementById('pr-files-list');
        if (data.files && data.files.length) {
            filesEl.innerHTML = data.files.map((f, idx) => {
                let bg = f.status === 'added' ? '#0d2818' : f.status === 'removed' ? '#2d0f0f' : '#0d1b2a';
                let tc = f.status === 'added' ? '#3fb950' : f.status === 'removed' ? '#f85149' : '#79c0ff';
                const hasPatch = f.patch && f.patch.length > 0;
                const diffId = `pr-diff-${idx}`;
                return `<div class="asset-item" style="flex-direction:column; align-items:stretch; padding:0; background:${bg}; border-color:${tc}33; cursor:default;">
                    <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; cursor:pointer;" onclick="toggleDiff('${diffId}')">
                        <span aria-hidden="true" class="ico ico-file-code ico-gap" style="color:${tc};"></span>
                        <span class="asset-name" style="font-family:monospace;font-size:0.85rem;color:${tc};">${escHtml(f.filename)}</span>
                        <span class="badge" style="background:${tc};font-size:0.7rem;color:#fff;">${f.status}</span>
                        <span class="asset-meta" style="color:#3fb950;font-weight:600;">+${f.additions}</span>
                        <span class="asset-meta" style="color:#f85149;font-weight:600;">-${f.deletions}</span>
                        ${hasPatch ? '<span class="asset-meta" style="font-size:0.7rem;color:var(--text-dim);margin-left:auto;"><span aria-hidden="true" class="ico ico-chevron-down" style="width:10px;height:10px;"></span> diff</span>' : ''}
                    </div>
                    ${hasPatch ? `<div id="${diffId}" class="diff-content" style="display:none; border-top:1px solid var(--border);">
                        <pre class="diff-pre">${renderDiff(f.patch)}</pre>
                    </div>` : ''}
                </div>`;
            }).join('');
        } else { filesEl.innerHTML = '<p style="color:#8b98a6;">' + t('no-files') + '</p>'; }

        // Commits
        const commitsEl = document.getElementById('pr-commits-list');
        if (data.commits && data.commits.length) {
            commitsEl.innerHTML = data.commits.map(c => {
                const dt = c.date ? formatDate(c.date) : '';
                return `<div class="commit-item" style="padding:6px 0;border-bottom:1px solid var(--border);display:flex;gap:8px;">
                    <code style="color:#79ffe1;font-size:0.8rem;min-width:50px;">${c.sha || ''}</code>
                    <div style="flex:1;"><span style="color:#c9d1d9;">${escHtml(c.message || '?')}</span><div style="font-size:0.8rem;color:#8b98a6;">${escHtml(c.author || '?')} · ${dt}</div></div>
                </div>`;
            }).join('');
        } else { commitsEl.innerHTML = '<p style="color:#8b98a6;">' + t('no-commits-list') + '</p>'; }

        // Reviews
        const reviewsEl = document.getElementById('pr-reviews-list');
        if (data.reviews && data.reviews.length) {
            reviewsEl.innerHTML = data.reviews.map(r => {
                const dt = r.submitted_at ? formatDate(r.submitted_at) : '';
                const stateColor = r.state === 'APPROVED' ? '#3fb950' : r.state === 'CHANGES_REQUESTED' ? '#f85149' : '#8b98a6';
                return `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
                    <div style="display:flex;gap:8px;align-items:center;"><span style="color:#79ffe1;">${r.user || '?'}</span><span class="badge" style="background:${stateColor};font-size:0.7rem;">${r.state || '?'}</span><span style="color:#8b98a6;font-size:0.8rem;">${dt}</span></div>
                    ${r.body ? '<p style="margin:4px 0 0;font-size:0.85rem;color:#c9d1d9;">' + escHtml(r.body.slice(0,300)) + '</p>' : ''}
                </div>`;
            }).join('');
        } else { reviewsEl.innerHTML = '<p style="color:#8b98a6;">' + t('no-reviews') + '</p>'; }

        observeAnimations();
    } catch (e) { showPullError(e.message); }
}
function showPullError(msg) {
    const skeleton = document.getElementById('pr-skeleton');
    if (skeleton) skeleton.style.display = 'none';
    const el = document.getElementById('pr-error');
    const msgEl = document.getElementById('pr-error-message');
    if (el) {
        el.style.display = 'block';
        if (msgEl) msgEl.textContent = `${t('load-failed')}: ${msg}`;
    }
}

// ═══════════════════════════════════════════════════
//  Issue 详情页（独立页面）
// ═══════════════════════════════════════════════════

async function loadIssueDetail() {
    const repo = getQueryParam('repo');
    const number = getQueryParam('number');
    if (!repo || !number) { showIssueError('Missing repo or number'); return; }
    try {
        const data = await requestJson(`/issue-detail?repo=${encodeURIComponent(repo)}&number=${number}`);
        if (data.error) { showIssueError(data.error); return; }
        document.getElementById('issue-skeleton').style.display = 'none';
        document.getElementById('issue-content').style.display = 'block';

        setText('issue-title', data.title || `#${data.number}`);
        setText('issue-author', data.user || '?');

        // 状态徽章
        const stateBadge = document.getElementById('issue-state-badge');
        if (data.state === 'closed') {
            stateBadge.style.background = '#f85149';
            stateBadge.textContent = t('closed') || 'Closed';
        } else {
            stateBadge.style.background = '#238636';
            stateBadge.textContent = t('open') || 'Open';
        }

        // 标签
        const labelsEl = document.getElementById('issue-labels');
        if (data.labels && data.labels.length > 0) {
            labelsEl.innerHTML = data.labels.map(l =>
                `<span class="badge" style="background:#${l.color || '555'}; font-size:0.75rem; padding:2px 8px;">${escHtml(l.name)}</span>`
            ).join('');
        }

        // 日期
        const datesEl = document.getElementById('issue-meta-dates');
        let datesHtml = '';
        if (data.created_at) {
            datesHtml += `<span data-i18n="created">创建于</span> ${formatDate(data.created_at)}`;
        }
        if (data.closed_at) {
            datesHtml += ` · <span data-i18n="closed">关闭于</span> ${formatDate(data.closed_at)}`;
        }
        datesEl.innerHTML = datesHtml;

        // GitHub 链接
        if (data.html_url) {
            document.getElementById('issue-github-link').href = data.html_url;
        }

        // 统计卡片
        const assignees = data.assignees && data.assignees.length > 0 ? data.assignees.join(', ') : '—';
        setText('issue-assignees', assignees);
        setText('issue-comments-count', data.comments_count || 0);
        setText('issue-reactions', data.reactions || 0);

        // 评论数徽章
        const badge = document.getElementById('issue-comments-badge');
        if (badge) badge.textContent = data.comments_count || 0;

        // Issue 正文（Markdown 渲染）
        const bodyEl = document.getElementById('issue-body');
        if (data.body) {
            if (typeof marked !== 'undefined') {
                bodyEl.innerHTML = safeMarked(data.body);
                bodyEl.querySelectorAll('table').forEach(t => t.classList.add('data-table'));
                highlightCodeBlocks(bodyEl);
                bodyEl.querySelectorAll('img').forEach(img => {
                    const src = img.getAttribute('src') || '';
                    if (src && !src.startsWith('http') && !src.startsWith('/github-raw') && !src.startsWith('data:')) {
                        img.setAttribute('src', githubRawUrl(repo, src.replace(/^\//, ''), ''));
                    }
                });
            } else {
                bodyEl.textContent = data.body;
            }
        } else {
            bodyEl.innerHTML = '<p style="color:var(--text-dim);" data-i18n="no-description">没有描述</p>';
        }

        // 评论列表
        const commentsEl = document.getElementById('issue-comments-list');
        if (data.comments && data.comments.length > 0) {
            commentsEl.innerHTML = data.comments.map(c => {
                const avatar = c.user_avatar ? `<img src="${c.user_avatar}" alt="" style="width:28px;height:28px;border-radius:50%;flex-shrink:0;" onerror="this.style.display='none'" loading="lazy">` : '<span aria-hidden="true" class="ico ico-person" style="width:28px;height:28px;flex-shrink:0;"></span>';
                let bodyHtml = '';
                if (c.body) {
                    if (typeof marked !== 'undefined') {
                        bodyHtml = safeMarked(c.body);
                    } else {
                        bodyHtml = '<pre style="white-space:pre-wrap;">' + escHtml(c.body) + '</pre>';
                    }
                }
                return `<div class="asset-item" style="flex-direction:column;align-items:stretch;gap:8px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        ${avatar}
                        <span style="font-weight:600;font-size:0.9rem;">${escHtml(c.user || '?')}</span>
                        <span style="color:var(--text-dim);font-size:0.8rem;">${c.created_at ? formatDate(c.created_at) : ''}</span>
                        ${c.reactions ? `<span style="margin-left:auto;font-size:0.8rem;color:var(--text-dim);"><span aria-hidden="true" class="ico ico-heart ico-red" style="width:12px;height:12px;"></span> ${c.reactions}</span>` : ''}
                    </div>
                    <div style="font-size:0.9rem;line-height:1.6;word-break:break-word;">${bodyHtml}</div>
                </div>`;
            }).join('');
        } else {
            commentsEl.innerHTML = '<p style="color:var(--text-dim);padding:16px;text-align:center;" data-i18n="no-comments">暂无评论</p>';
        }

        requestAnimationFrame(() => { observeAnimations(); });
    } catch (e) {
        showIssueError(e.message);
    }
}

function showIssueError(msg) {
    const skeleton = document.getElementById('issue-skeleton');
    if (skeleton) skeleton.style.display = 'none';
    const el = document.getElementById('issue-error');
    const msgEl = document.getElementById('issue-error-message');
    if (el) {
        el.style.display = 'block';
        if (msgEl) msgEl.textContent = `${t('load-failed')}: ${msg}`;
    }
}

// ═══════════════════════════════════════════════════
//  Commit 详情页（独立页面）
// ═══════════════════════════════════════════════════

async function loadCommitDetail() {
    const repo = getQueryParam('repo');
    const sha = getQueryParam('sha');
    if (!repo || !sha) {
        showCommitError('Missing repo or sha parameter');
        return;
    }

    try {
        const data = await requestJson(`/commit-detail?repo=${encodeURIComponent(repo)}&sha=${sha}`);
        if (data.error) {
            showCommitError(data.error);
            return;
        }

        const skeletonEl = document.getElementById('commit-skeleton');
        const contentEl = document.getElementById('commit-content');
        if (!contentEl) return;
        if (skeletonEl) skeletonEl.style.display = 'none';
        contentEl.style.display = 'block';

        setText('commit-message', data.message.split('\n')[0] || '?');
        setText('commit-sha', data.short_sha || data.sha);
        setText('commit-author', data.author_name || data.author_username || '?');
        setText('commit-date', formatDate(data.date));
        document.getElementById('commit-github-link').href = data.html_url || '#';
        setText('commit-additions', data.stats && data.stats.additions != null ? data.stats.additions : 0);
        setText('commit-deletions', data.stats && data.stats.deletions != null ? data.stats.deletions : 0);
        setText('commit-files-count', (data.files || []).length);

        // 完整提交信息
        const bodyEl = document.getElementById('commit-full-message');
        if (data.message) {
            bodyEl.innerHTML = escHtml(data.message);
        } else {
            bodyEl.innerHTML = '<p style="color:#8b98a6;">—</p>';
        }

        // 变更文件列表（可展开显示 diff）
        const filesEl = document.getElementById('commit-files-list');
        if (data.files && data.files.length > 0) {
            filesEl.innerHTML = data.files.map((f, idx) => {
                let bgColor, textColor, badgeBg;
                if (f.status === 'added') {
                    bgColor = '#0d2818';   textColor = '#3fb950';  badgeBg = '#2ea043';
                } else if (f.status === 'removed') {
                    bgColor = '#2d0f0f';   textColor = '#f85149';  badgeBg = '#da3633';
                } else {
                    bgColor = '#0d1b2a';   textColor = '#79c0ff';  badgeBg = '#1f6feb';
                }
                const hasPatch = f.patch && f.patch.length > 0;
                const diffId = `commit-diff-${idx}`;
                return `<div class="asset-item" style="flex-direction:column; align-items:stretch; padding:0; background:${bgColor}; border-color:${textColor}33; cursor:default;">
                    <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; cursor:pointer;" onclick="toggleDiff('${diffId}')">
                        <span aria-hidden="true" class="ico ico-file-code ico-gap" style="color:${textColor};"></span>
                        <span class="asset-name" style="font-family:monospace;font-size:0.85rem;color:${textColor};">${escHtml(f.filename)}</span>
                        <span class="badge" style="background:${badgeBg};font-size:0.7rem;color:#fff;">${f.status}</span>
                        <span class="asset-meta" style="color:#3fb950;font-weight:600;">+${f.additions}</span>
                        <span class="asset-meta" style="color:#f85149;font-weight:600;">-${f.deletions}</span>
                        ${hasPatch ? '<span class="asset-meta" style="font-size:0.7rem;color:var(--text-dim);margin-left:auto;"><span aria-hidden="true" class="ico ico-chevron-down" style="width:10px;height:10px;"></span> diff</span>' : ''}
                    </div>
                    ${hasPatch ? `<div id="${diffId}" class="diff-content" style="display:none; border-top:1px solid var(--border);">
                        <pre class="diff-pre">${renderDiff(f.patch)}</pre>
                    </div>` : ''}
                </div>`;
            }).join('');
        } else {
            filesEl.innerHTML = `<p style="color:#8b98a6;">${t('no-files')}</p>`;
        }

        observeAnimations();
    } catch (error) {
        showCommitError(error.message);
    }
}

function showCommitError(msg) {
    document.getElementById('commit-skeleton').style.display = 'none';
    const errEl = document.getElementById('commit-error');
    if (errEl) {
        errEl.style.display = 'block';
        setText('commit-error-message', `${t('load-failed')}: ${msg}`);
    }
}

// ═══════════════════════════════════════════════════
//  Diff 渲染工具
// ═══════════════════════════════════════════════════

function renderDiff(patch) {
    if (!patch) return '';
    const lines = patch.split('\n');
    return lines.map(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
            return `<div class="diff-line diff-add">${escHtml(line)}</div>`;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            return `<div class="diff-line diff-del">${escHtml(line)}</div>`;
        } else if (line.startsWith('@@')) {
            return `<div class="diff-line diff-hunk">${escHtml(line)}</div>`;
        } else if (line.startsWith('\\')) {
            return `<div class="diff-line diff-info">${escHtml(line)}</div>`;
        } else {
            return `<div class="diff-line diff-ctx">${escHtml(line)}</div>`;
        }
    }).join('');
}

function toggleDiff(id) {
    const el = document.getElementById(id);
    if (el) {
        const isOpen = el.style.display === 'block';
        el.style.display = isOpen ? 'none' : 'block';
        // 更新箭头
        const arrow = el.previousElementSibling ? el.previousElementSibling.querySelector('.asset-meta:last-child') : null;
        if (arrow) arrow.innerHTML = isOpen ? '<span aria-hidden="true" class="ico ico-chevron-down" style="width:10px;height:10px;"></span> diff' : '<span aria-hidden="true" class="ico ico-chevron-up" style="width:10px;height:10px;"></span> diff';
    }
}

// ═══════════════════════════════════════════════════
//  文件内容查看页
// ═══════════════════════════════════════════════════

async function loadFileContent() {
    const repo = getQueryParam('repo');
    const path = getQueryParam('path');
    if (!repo || !path) { showFileError('Missing repo or path'); return; }
    try {
        const data = await requestJson(`/file-content?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`);
        if (data.error) { showFileError(data.error); return; }
        document.getElementById('file-skeleton').style.display = 'none';
        document.getElementById('file-content').style.display = 'block';

        // 面包屑
        const bc = document.getElementById('file-breadcrumb');
        if (bc) {
            const parts = path.split('/');
            let html = `<span class="crumb-item" onclick="window.location.href='/repo?repo=${encodeURIComponent(repo)}&tab=browser'"><span aria-hidden="true" class="ico ico-repo ico-gap"></span>${escHtml(repo)}</span>`;
            let cum = '';
            for (let i = 0; i < parts.length; i++) {
                const p = parts[i];
                cum = cum ? cum + '/' + p : p;
                html += `<span class="crumb-sep">/</span>`;
                if (i === parts.length - 1) {
                    html += `<span class="crumb-item crumb-current"><span aria-hidden="true" class="ico ico-file ico-gap"></span>${escHtml(p)}</span>`;
                } else {
                    html += `<span class="crumb-item" onclick="window.location.href='/repo?repo=${encodeURIComponent(repo)}&tab=browser&path=${encodeURIComponent(cum)}'"><span aria-hidden="true" class="ico ico-folder ico-gap"></span>${escHtml(p)}</span>`;
                }
            }
            bc.innerHTML = html;
        }

        setText('file-name', data.name || path);
        const sz = data.size || 0;
        setText('file-size', `${t('file-size')}: ${sz < 1024 ? sz+'B' : (sz/1024).toFixed(1)+'KB'}`);
        document.getElementById('file-github-link').href = data.html_url || '#';
        document.getElementById('file-edit-link').href = data.html_url ? data.html_url.replace('/blob/','/edit/') : '#';
        document.getElementById('file-edit-notice').style.display = 'block';
        const bodyEl = document.getElementById('file-body');
        if (bodyEl) bodyEl.textContent = data.content || t('file-empty');
        observeAnimations();
    } catch (e) { showFileError(e.message); }
}
function showFileError(msg) {
    document.getElementById('file-skeleton').style.display = 'none';
    const el = document.getElementById('file-error');
    if (el) { el.style.display = 'block'; setText('file-error-message', `${t('load-failed')}: ${msg}`); }
}

// ═══════════════════════════════════════════════════
//  文件浏览 + README
// ═══════════════════════════════════════════════════

let fileTreePath = '';

function renderBreadcrumb(repo, path) {
    const el = document.getElementById('file-breadcrumb');
    if (!el) return;
    const parts = path ? path.split('/') : [];
    let html = `<span class="crumb-item" onclick="loadFileTree('${escAttr(repo)}','')"><span aria-hidden="true" class="ico ico-repo ico-gap"></span>${escHtml(repo)}</span>`;
    let cum = '';
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        cum = cum ? cum + '/' + p : p;
        html += `<span class="crumb-sep">/</span>`;
        const isLast = (i === parts.length - 1);
        if (isLast) {
            // 最后一级可能是目录或文件，统一用文件夹图标（文件树中只显示目录路径）
            html += `<span class="crumb-item crumb-current"><span aria-hidden="true" class="ico ico-folder ico-gap"></span>${escHtml(p)}</span>`;
        } else {
            html += `<span class="crumb-item" onclick="loadFileTree('${escAttr(repo)}','${escAttr(cum)}')"><span aria-hidden="true" class="ico ico-folder ico-gap"></span>${escHtml(p)}</span>`;
        }
    }
    el.innerHTML = html;
}

async function loadFileTree(repo, path, propagateError) {
    const el = document.getElementById('file-tree-list');
    if (!el) return;
    fileTreePath = path || '';
    renderBreadcrumb(repo, path);
    showLoading(el, t('loading-tree'));
    try {
        const ref = window._currentBranch || '';
        const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : '';
        const data = await requestJson(`/repo-tree?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path||'')}${refParam}`);
        if (!isActiveRepo(repo)) return false;
        if (!Array.isArray(data)) {
            el.innerHTML = `<p style="color:var(--text-dim);padding:24px;text-align:center;">${t('load-failed')}</p>`;
            return false;
        }
        if (data.length===0) { el.innerHTML = `<p style="color:var(--text-dim);padding:24px;text-align:center;">${t('no-files-in-dir')}</p>`; return; }
        const dirs = data.filter(i=>i.type==='dir');
        const files = data.filter(i=>i.type==='file');
        let html = '';
        // 目录
        for (const d of dirs)
            html += `<div class="file-tree-item file-tree-dir" onclick="loadFileTree('${escAttr(repo)}','${escAttr(d.path)}')">
                <span aria-hidden="true" class="ico ico-folder ico-blue ico-gap"></span><span class="file-name">${escHtml(d.name)}</span><span class="file-meta">dir</span>
            </div>`;
        // 文件
        for (const f of files) {
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            const icon = ['jpg','jpeg','png','gif','svg','webp','ico','bmp','tiff','psd','ai'].includes(ext) ? '<span aria-hidden="true" class="ico ico-image ico-green ico-gap"></span>' :
                        ['mp3','wav','ogg','flac','aac','wma','m4a','mid','midi'].includes(ext) ? '<span aria-hidden="true" class="ico ico-music ico-purple ico-gap"></span>' :
                        ['mp4','avi','mkv','mov','wmv','flv','webm','m4v','3gp'].includes(ext) ? '<span aria-hidden="true" class="ico ico-video ico-pink ico-gap"></span>' :
                        ['zip','tar','gz','gzip','rar','7z','bz2','xz','zst','tgz','z'].includes(ext) ? '<span aria-hidden="true" class="ico ico-file-zip ico-orange ico-gap"></span>' :
                        ['js','ts','tsx','jsx','mjs','cjs'].includes(ext) ? '<span aria-hidden="true" class="ico ico-file-code ico-blue ico-gap"></span>' :
                        ['py','pyw','pyc','pyd','ipynb'].includes(ext) ? '<span aria-hidden="true" class="ico ico-terminal ico-green ico-gap"></span>' :
                        ['java','kt','kts','scala','groovy','clj'].includes(ext) ? '<span aria-hidden="true" class="ico ico-coffee ico-orange ico-gap"></span>' :
                        ['rs','go','zig','nim','crystal','ex','exs'].includes(ext) ? '<span aria-hidden="true" class="ico ico-zap ico-cyan ico-gap"></span>' :
                        ['c','cpp','h','hpp','cxx','cc','hh','hxx','c++','h++'].includes(ext) ? '<span aria-hidden="true" class="ico ico-cpu ico-blue ico-gap"></span>' :
                        ['cs','vb','fs','fsx'].includes(ext) ? '<span aria-hidden="true" class="ico ico-server ico-purple ico-gap"></span>' :
                        ['swift','m','mm','pl','pm','r','rb','rake','php','phtml','lua'].includes(ext) ? '<span aria-hidden="true" class="ico ico-terminal ico-dim ico-gap"></span>' :
                        ['md','markdown','rst','adoc','asciidoc','rdoc','wiki'].includes(ext) ? '<span aria-hidden="true" class="ico ico-book ico-cyan ico-gap"></span>' :
                        ['txt','text','log','csv','tsv'].includes(ext) ? '<span aria-hidden="true" class="ico ico-file-text ico-dim ico-gap"></span>' :
                        ['json','xml','yaml','yml','toml','ini','cfg','conf','cnf','env'].includes(ext) ? '<span aria-hidden="true" class="ico ico-gear ico-dim ico-gap"></span>' :
                        ['sql','db','sqlite','sqlite3','mdb','accdb'].includes(ext) ? '<span aria-hidden="true" class="ico ico-database ico-cyan ico-gap"></span>' :
                        ['html','htm','xhtml','vue','svelte','astro','ejs','hbs','mustache'].includes(ext) ? '<span aria-hidden="true" class="ico ico-globe ico-blue ico-gap"></span>' :
                        ['css','scss','sass','less','styl','postcss'].includes(ext) ? '<span aria-hidden="true" class="ico ico-palette ico-pink ico-gap"></span>' :
                        ['sh','bash','zsh','fish','bat','cmd','ps1'].includes(ext) ? '<span aria-hidden="true" class="ico ico-terminal ico-dim ico-gap"></span>' :
                        ['dockerfile','dockerignore','compose'].includes(ext) ? '<span aria-hidden="true" class="ico ico-box ico-blue ico-gap"></span>' :
                        ['pdf','epub','mobi','azw3'].includes(ext) ? '<span aria-hidden="true" class="ico ico-book ico-red ico-gap"></span>' :
                        ['doc','docx','odt','xls','xlsx','ppt','pptx'].includes(ext) ? '<span aria-hidden="true" class="ico ico-clipboard ico-dim ico-gap"></span>' :
                        '<span aria-hidden="true" class="ico ico-file ico-dim ico-gap"></span>';
            html += `<div class="file-tree-item file-tree-file" data-path="${escAttr(f.path)}" onclick="openFileViewer('${escAttr(repo)}','${escAttr(f.path)}')">
                ${icon}
                <span class="file-name">${escHtml(f.name)}</span>
                <span class="file-meta">${(f.size||0)<1024?(f.size||0)+'B':((f.size||0)/1024).toFixed(1)+'KB'}</span>
            </div>`;
        }
        el.innerHTML = html;
        observeAnimations();
    } catch(e) {
        if (!isActiveRepo(repo)) return false;
        console.error(e);
        el.innerHTML = `<p style="color:#8b98a6;padding:24px;text-align:center;">${t('load-failed')}</p>`;
        if (propagateError) throw e;
    }
}

// ═══════════════════════════════════════════════════
//  内嵌文件查看器（浏览器 tab 内，替代跳转独立页面）
// ═══════════════════════════════════════════════════

let _currentFileRepo = '';
let _currentFilePath = '';
let _currentFileContent = '';
let _currentFileIsMarkdown = false;
let _renderingSource = true; // true=source view, false=rendered view

const MARKDOWN_EXTS = ['md', 'markdown', 'mdx'];
const CODE_EXTS = ['js','ts','jsx','tsx','py','java','rs','go','c','cpp','h','hpp','cs','rb','php',
                   'swift','kt','scala','html','css','scss','less','vue','svelte',
                   'json','xml','yaml','yml','toml','ini','cfg','conf','sh','bash','zsh','bat','properties',
                   'sql','r','m','mm','pl','pm','lua','dart','groovy','gradle',
                   'ps1','cmd','tex','fs','fsx'];
const IMAGE_EXTS = ['jpg','jpeg','png','gif','svg','webp','ico','bmp','avif'];
const AUDIO_EXTS = ['mp3','wav','ogg','flac','aac','wma','m4a','opus'];
const VIDEO_EXTS = ['mp4','avi','mkv','mov','webm','flv','wmv','m4v'];
const BINARY_EXTS = ['zip','tar','gz','rar','7z','exe','dll','so','bin','dat','pdf',
                     'doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp',
                     'iso','img','dmg','deb','rpm','apk','ipa',
                     'ttf','otf','woff','woff2','eot',
                     'pyc','class','o','obj','lib','a','dylib'];

function isBinaryFile(ext) {
    return BINARY_EXTS.includes(ext);
}

// 后端已把 GBK/Big5 等非 UTF-8 源文件转码为正确文本，这里显式告知用户
// 检测到的原始编码；UTF-8（含 BOM 变体）属常态，不打扰用户。
function renderFileEncodingNotice(detected) {
    const box = document.getElementById('file-encoding-notice');
    if (!box) return;
    const textEl = document.getElementById('file-encoding-text');
    const enc = String(detected || '').toLowerCase();
    if (!enc || enc === 'utf-8' || enc === 'utf-8-sig' || enc === 'text') {
        box.hidden = true;
        return;
    }
    const label = { 'gb18030': 'GB18030 / GBK', 'big5': 'Big5',
                    'shift_jis': 'Shift_JIS', 'euc-kr': 'EUC-KR',
                    'utf-16': 'UTF-16', 'utf-32': 'UTF-32',
                    'latin-1': 'Latin-1' }[enc] || detected;
    if (textEl) {
        const tpl = t('file-encoding-converted');
        textEl.textContent = (tpl && tpl !== 'file-encoding-converted')
            ? tpl.replace('{encoding}', label)
            : `该文件原始编码为 ${label}，已自动转换为 UTF-8 显示。`;
    }
    box.hidden = false;
}

function getFileLang(ext) {
    const map = {
        'js':'javascript','ts':'typescript','jsx':'javascript','tsx':'typescript',
        'py':'python','java':'java','rs':'rust','go':'go','c':'c','cpp':'cpp',
        'h':'c','hpp':'cpp','cs':'csharp','rb':'ruby','php':'php',
        'swift':'swift','kt':'kotlin','scala':'scala',
        'html':'html','css':'css','scss':'scss','less':'less',
        'json':'json','xml':'xml','yaml':'yaml','yml':'yaml',
        'sh':'bash','bash':'bash','zsh':'bash','bat':'batch',
        'sql':'sql','r':'r','lua':'lua','dart':'dart',
        'md':'markdown','mdx':'markdown',
        'gradle':'groovy','groovy':'groovy',
        'm':'objectivec','mm':'objectivec',
        'pl':'perl','pm':'perl',
        'properties':'properties',
        'vue':'vue','svelte':'svelte',
        'ps1':'powershell','cmd':'batch',
        'tex':'latex','fs':'fsharp','fsx':'fsharp',
    };
    return map[ext] || '';
}

async function openFileViewer(repo, path) {
    _currentFileRepo = repo;
    _currentFilePath = path;
    _currentFileIsMarkdown = false;
    _renderingSource = true;

    const ext = path.split('.').pop().toLowerCase();
    _currentFileIsMarkdown = MARKDOWN_EXTS.includes(ext);

    // 显示查看器，滚动到它
    const viewer = document.getElementById('file-viewer');
    const loading = document.getElementById('fview-loading');
    const codeEl = document.getElementById('fview-code');
    const renderedEl = document.getElementById('fview-rendered');
    const mediaEl = document.getElementById('fview-media');
    const imgEl = document.getElementById('fview-image');
    const audioPlayerEl = document.getElementById('fview-audio-player');
    const videoPlayerEl = document.getElementById('fview-video-player');
    const videoEl = document.getElementById('fview-video');
    const errorEl = document.getElementById('fview-error');
    const filenameEl = document.getElementById('fview-filename');
    const sizeEl = document.getElementById('fview-filesize');
    const renderToggle = document.getElementById('fview-render-toggle');

    if (!viewer) return;
    if (codeEl) codeEl.style.display = 'none';
    if (renderedEl) renderedEl.style.display = 'none';
    if (mediaEl) mediaEl.style.display = 'none';
    if (imgEl) imgEl.style.display = 'none';
    if (audioPlayerEl) audioPlayerEl.style.display = 'none';
    if (videoPlayerEl) videoPlayerEl.style.display = 'none';
    if (videoEl && typeof videoEl.pause === 'function') videoEl.pause();
    if (errorEl) errorEl.style.display = 'none';
    if (loading) loading.style.display = 'block';
    // 移除内联 display:none，让 CSS 类控制显示
    viewer.style.display = 'block';
    if (filenameEl) filenameEl.textContent = path.split('/').pop();
    if (renderToggle) {
        renderToggle.style.display = _currentFileIsMarkdown ? 'inline-block' : 'none';
        renderToggle.textContent = t('preview');
    }

    // 平滑滚动到查看器
    viewer.style.display = 'block';
    setTimeout(() => {
        viewer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // 添加 visible 类触发过渡动画
        viewer.classList.add('fview-visible');
    }, 50);

    // 高亮当前文件树项
    document.querySelectorAll('.file-tree-file').forEach(el => el.classList.remove('active'));
    const treeItems = document.querySelectorAll('.file-tree-file');
    for (const item of treeItems) {
        if (item.dataset.path === path) {
            item.classList.add('active');
        }
    }

    try {
        const ref = window._currentBranch || '';
        const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : '';
        const data = await requestJson(`/file-content?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}${refParam}`);
        if (data.error) {
            showNotification(`${t('load-failed-short')}: ${data.error}`, 'error');
            errorEl.style.display = 'none';
            loading.style.display = 'none';
            return;
        }

        _currentFileContent = data.content || '';
        const sz = data.size || 0;
        sizeEl.textContent = sz < 1024 ? sz+'B' : (sz/1024).toFixed(1)+'KB';

        loading.style.display = 'none';

        // ── 图片 ──
        if (IMAGE_EXTS.includes(ext)) {
            mediaEl.style.display = 'block';
            imgEl.style.display = 'block';
            imgEl.alt = path.split('/').pop() || t('file-preview');
            imgEl.src = githubRawUrl(repo, path, ref);
            imgEl.onerror = () => { imgEl.style.display = 'none'; errorEl.textContent=t('img-load-failed'); errorEl.style.display='block'; };
            observeAnimations(); return;
        }

        // ── 音频 ──
        if (AUDIO_EXTS.includes(ext)) {
            mediaEl.style.display = 'block';
            audioPlayerEl.style.display = 'block';
            buildAudioPlayer(audioPlayerEl, repo, path, ext);
            observeAnimations(); return;
        }

        // ── 视频 ──
        if (VIDEO_EXTS.includes(ext)) {
            mediaEl.style.display = 'block';
            videoPlayerEl.style.display = 'block';
            const videoSrc = githubRawUrl(repo, path, ref);
            videoEl.src = videoSrc;
            videoEl.load();
            observeAnimations(); return;
        }

        const lang = getFileLang(ext);
        // 判断是否为文本文件：排除已知的二进制/图片/音频/视频类型后，其余按文本处理
        // 后端按内容嗅探（NUL 字节）判定的二进制，优先于扩展名判断：
        // 无扩展名或扩展名伪装的二进制文件，过去会把乱码当正文渲染。
        const isText = !data.is_binary && !isBinaryFile(ext) && !IMAGE_EXTS.includes(ext)
            && !AUDIO_EXTS.includes(ext) && !VIDEO_EXTS.includes(ext);

        // ── 不可预览的二进制文件 ──
        if (!isText) {
            showNotification(`${t('load-failed-short')}: ${t('binary-preview-unavailable')}`, 'error');
            errorEl.style.display = 'none';
            observeAnimations(); return;
        }

        // 非 UTF-8 源文件（GBK/Big5 等）已由后端转码，这里提示真实编码，
        // 避免用户误以为站点显示错误。
        renderFileEncodingNotice(data.detected_encoding);

        if (_currentFileIsMarkdown) {
            // Markdown 文件 — 显示渲染视图
            renderedEl.style.display = 'block';
            if (_currentFileIsMarkdown && typeof marked !== 'undefined') {
                renderedEl.innerHTML = safeMarked(_currentFileContent);
                // 代理图片 URL
                renderedEl.querySelectorAll('img').forEach(img => {
                    const src = img.getAttribute('src') || '';
                    if (src && !src.startsWith('http') && !src.startsWith('/github-raw') && !src.startsWith('data:')) {
                        const basePath = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
                        img.src = githubRawUrl(repo, basePath + src, ref);
                    }
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '6px';
                });
                highlightCodeBlocks(renderedEl);
            } else {
                renderedEl.innerHTML = '<pre style="margin:0;font-size:0.85rem;white-space:pre-wrap;word-break:break-all;">'+escHtml(_currentFileContent)+'</pre>';
            }
            if (_currentFileIsMarkdown) {
                // 一次性设置 display 状态，避免闪烁
                codeEl.textContent = _currentFileContent;
                codeEl.style.display = _renderingSource ? 'block' : 'none';
                renderedEl.style.display = _renderingSource ? 'none' : 'block';
                renderToggle.textContent = _renderingSource ? t('preview') : t('source');
            }
        } else {
            // 代码文件 — 语法高亮
            codeEl.style.display = 'block';
            codeEl.textContent = _currentFileContent;
            if (lang && typeof hljs !== 'undefined') {
                codeEl.className = '';
                codeEl.classList.add('fview-code', 'hljs');
                try {
                    const highlighted = hljs.highlight(_currentFileContent, { language: lang });
                    codeEl.innerHTML = highlighted.value;
                } catch(e) {
                    codeEl.textContent = _currentFileContent;
                }
            }
        }

        // 回到顶部
        const bodyEl = document.getElementById('fview-body');
        if (bodyEl) bodyEl.scrollTop = 0;
        observeAnimations();
    } catch (e) {
        loading.style.display = 'none';
        showNotification(`${t('load-failed-short')}: ${e.message}`, 'error');
    }
}

function closeFileViewer() {
    const viewer = document.getElementById('file-viewer');
    if (viewer) {
        viewer.classList.remove('fview-visible');
        viewer.style.display = 'none';
    }
    // 停止音频播放
    const audio = document.getElementById('fview-audio-el');
    if (audio) { audio.pause(); audio.src = ''; audio.load(); }
    // 停止视频播放
    const video = document.getElementById('fview-video');
    if (video) { video.pause(); video.src = ''; video.load(); }
    document.querySelectorAll('.file-tree-file').forEach(el => el.classList.remove('active'));
    _currentFileRepo = '';
    _currentFilePath = '';
    _currentFileContent = '';
}

function toggleFileRender() {
    const codeEl = document.getElementById('fview-code');
    const renderedEl = document.getElementById('fview-rendered');
    const toggle = document.getElementById('fview-render-toggle');
    if (!codeEl || !renderedEl || !toggle) return;
    _renderingSource = !_renderingSource;
    codeEl.style.display = _renderingSource ? 'block' : 'none';
    renderedEl.style.display = _renderingSource ? 'none' : 'block';
    toggle.textContent = _renderingSource ? t('preview') : t('source');
}

function downloadCurrentFile() {
    if (!_currentFilePath) return;
    const filename = _currentFilePath.split('/').pop() || 'file';
    // 对于图片/音频/视频/二进制文件，通过代理 URL 直接下载
    const ext = filename.split('.').pop().toLowerCase();
    const binaryExts = [...IMAGE_EXTS, ...AUDIO_EXTS, ...VIDEO_EXTS, ...BINARY_EXTS];
    if (binaryExts.includes(ext) && _currentFileRepo && _currentFilePath) {
        const a = document.createElement('a');
        a.href = githubRawUrl(_currentFileRepo, _currentFilePath);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
    }
    if (!_currentFileContent) return;
    const blob = new Blob([_currentFileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════
//  音频播放器构建
// ═══════════════════════════════════════════════════

function buildAudioPlayer(container, repo, path, ext) {
    const audioUrl = githubRawUrl(repo, path);
    container.innerHTML = `
        <div class="audio-player-inner">
            <div class="audio-player-info">
                <span aria-hidden="true" class="ico ico-music ico-purple" style="width:20px;height:20px;"></span>
                <span class="audio-player-filename">${escHtml(path.split('/').pop())}</span>
            </div>
            <audio id="fview-audio-el" class="fview-audio-el" style="display:none;" src="${audioUrl}" preload="auto"></audio>
            <div class="audio-controls">
                <button class="audio-btn" onclick="audioPrev()" title="${t('audio-prev')}"><span aria-hidden="true" class="ico ico-arrow-left" style="width:16px;height:16px;"></span></button>
                <button class="audio-btn audio-play-btn" onclick="audioPlayPause()" id="audio-play-btn">
                    <span aria-hidden="true" class="ico ico-play" style="width:20px;height:20px;"></span>
                </button>
                <button class="audio-btn" onclick="audioNext()" title="${t('audio-next')}"><span aria-hidden="true" class="ico ico-arrow-right" style="width:16px;height:16px;"></span></button>
                <div class="audio-progress-wrap">
                    <input type="range" class="audio-progress" id="audio-progress" value="0" min="0" max="100" oninput="audioSeek(this.value)" />
                    <div class="audio-time">
                        <span id="audio-current">0:00</span>
                        <span class="audio-sep">/</span>
                        <span id="audio-duration">0:00</span>
                    </div>
                </div>
                <div class="audio-speed-wrap">
                    <label class="audio-speed-label">${t('speed')}</label>
                    <select class="audio-speed-select" id="audio-speed" onchange="audioChangeSpeed(this.value)">
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1" selected>1x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2x</option>
                    </select>
                </div>
                <div class="audio-volume-wrap">
                    <span aria-hidden="true" class="ico ico-speaker" style="width:14px;height:14px;filter:brightness(0.6);"></span>
                    <input type="range" class="audio-volume" id="audio-volume" value="80" min="0" max="100" oninput="audioChangeVolume(this.value)" />
                </div>
            </div>
        </div>`;

    // 绑定音频事件（先移除旧监听器，防止累积泄漏）
    const audio = document.getElementById('fview-audio-el');
    if (!audio) return;
    audio.removeEventListener('timeupdate', audioTimeUpdate);
    audio.removeEventListener('loadedmetadata', audioMetaLoaded);
    audio.removeEventListener('ended', audioNext);
    audio.addEventListener('timeupdate', audioTimeUpdate);
    audio.addEventListener('loadedmetadata', audioMetaLoaded);
    audio.addEventListener('ended', audioNext);
    audio.volume = 0.8;
}

// 全局音频控制函数

function audioPlayPause() {
    const audio = document.getElementById('fview-audio-el');
    const btn = document.getElementById('audio-play-btn');
    if (!audio) return;
    if (audio.paused) {
        audio.play().catch(() => {});
        if (btn) btn.innerHTML = '<span aria-hidden="true" class="ico ico-pause" style="width:20px;height:20px;"></span>';
    } else {
        audio.pause();
        if (btn) btn.innerHTML = '<span aria-hidden="true" class="ico ico-play" style="width:20px;height:20px;"></span>';
    }
}

function audioSeek(val) {
    const audio = document.getElementById('fview-audio-el');
    if (audio && audio.duration) {
        audio.currentTime = (val / 100) * audio.duration;
    }
}

function audioTimeUpdate() {
    const audio = document.getElementById('fview-audio-el');
    const progress = document.getElementById('audio-progress');
    const currentEl = document.getElementById('audio-current');
    if (!audio || !progress || !currentEl) return;
    if (audio.duration) {
        progress.value = (audio.currentTime / audio.duration) * 100;
    }
    currentEl.textContent = formatTime(audio.currentTime);
}

function audioMetaLoaded() {
    const audio = document.getElementById('fview-audio-el');
    const durEl = document.getElementById('audio-duration');
    if (audio && durEl && audio.duration) {
        durEl.textContent = formatTime(audio.duration);
    }
}

function audioChangeSpeed(val) {
    const audio = document.getElementById('fview-audio-el');
    if (audio) audio.playbackRate = parseFloat(val);
}

function audioChangeVolume(val) {
    const audio = document.getElementById('fview-audio-el');
    if (audio) audio.volume = parseFloat(val) / 100;
}

// 在文件树中查找当前活动的音频文件索引
function _findActiveAudioIndex(treeItems) {
    for (let i = 0; i < treeItems.length; i++) {
        const nameEl = treeItems[i].querySelector('.file-name');
        const name = nameEl ? nameEl.textContent : '';
        const ext = name.split('.').pop().toLowerCase();
        if (AUDIO_EXTS.includes(ext) && treeItems[i].classList.contains('active')) {
            return i;
        }
    }
    return -1;
}

function _findAudioByDirection(treeItems, startIdx, direction) {
    const step = direction > 0 ? 1 : -1;
    for (let i = startIdx + step; i >= 0 && i < treeItems.length; i += step) {
        const nameEl = treeItems[i].querySelector('.file-name');
        const name = nameEl ? nameEl.textContent : '';
        const ext = name.split('.').pop().toLowerCase();
        if (AUDIO_EXTS.includes(ext)) return i;
    }
    return -1;
}

function audioPrev() {
    const treeItems = document.querySelectorAll('.file-tree-file');
    if (!treeItems.length) return;
    const found = _findActiveAudioIndex(treeItems);
    if (found < 0) return;
    const prevIdx = _findAudioByDirection(treeItems, found, -1);
    if (prevIdx >= 0 && prevIdx < treeItems.length) {
        treeItems[prevIdx].click();
    }
}

function audioNext() {
    const treeItems = document.querySelectorAll('.file-tree-file');
    if (!treeItems.length) return;
    const found = _findActiveAudioIndex(treeItems);
    if (found < 0) return;
    const nextIdx = _findAudioByDirection(treeItems, found, 1);
    if (nextIdx >= 0 && nextIdx < treeItems.length) {
        treeItems[nextIdx].click();
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

async function loadReadme(repo, propagateError) {
    const el = document.getElementById('readme-content');
    if (!el) return;
    showLoading(el);
    try {
        const ref = window._currentBranch || '';
        const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : '';
        const baseUrl = `/file-content?repo=${encodeURIComponent(repo)}&path=`;
        // 并行尝试常见 README 文件名，取第一个成功的
        const readmePaths = ['README.md', 'README.markdown', 'README.rst', 'README.txt', 'README'];
        const results = await Promise.all(readmePaths.map(p =>
            requestJson(`${baseUrl}${encodeURIComponent(p)}${refParam}`).then(
                value => ({ status: 'fulfilled', value }),
                reason => ({ status: 'rejected', reason })
            )
        ));
        let data = { error: true };
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value && !r.value.error) {
                data = r.value;
                break;
            }
        }
        if (!isActiveRepo(repo)) return false;
        if (data.error) { el.innerHTML = '<p style="color:#8b98a6;padding:20px;text-align:center;">—</p>'; return; }
        if (typeof marked !== 'undefined') {
            el.innerHTML = safeMarked(data.content || '');
            el.querySelectorAll('table').forEach(t => t.classList.add('data-table'));
            // 重写图片 URL 为本地代理，避免客户端直连 GitHub
            el.querySelectorAll('img').forEach(img => {
                const src = img.getAttribute('src') || '';
                if (src && !src.startsWith('http') && !src.startsWith('/github-raw') && !src.startsWith('data:')) {
                    img.src = githubRawUrl(repo, src, ref);
                }
                if (src && src.startsWith('http') && !src.startsWith('/github-raw')) {
                    // 对于绝对 URL 也尝试代理
                    const match = src.match(/github\.com\/([^/]+\/[^/]+)\/raw\/([^/]+)\/(.+)/);
                    if (match) {
                        img.src = githubRawUrl(match[1], match[3], match[2]);
                    }
                }
                img.style.maxWidth = '100%';
                img.style.borderRadius = '6px';
            });
            highlightCodeBlocks(el);
        } else {
            el.innerHTML = '<pre style="padding:16px;overflow-x:auto;">'+escHtml((data.content||'').slice(0,3000))+'</pre>';
        }
        observeAnimations();
    } catch(e) {
        if (!isActiveRepo(repo)) return false;
        el.innerHTML = '<p style="color:#8b98a6;padding:20px;text-align:center;">—</p>';
        if (propagateError) throw e;
    }
}

// ═══════════════════════════════════════════════════
//  标签切换
// ═══════════════════════════════════════════════════

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => {
        if (el.id !== 'tab-' + tab) {
            el.style.display = 'none';
            el.classList.remove('visible');
        }
    });
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('tab-' + tab);
    if (target) {
        target.style.display = 'block';
        if (!target.classList.contains('visible')) {
            target.classList.add('visible');
        }
        requestAnimationFrame(() => {
            target.classList.add('visible');
        });
    }
    const btn = document.querySelector(`.tab-btn[data-tab="${tab.replace(/[^a-z0-9-]/gi, '')}"]`);
    if (btn) btn.classList.add('active');

    // 每个数据板块只在首次打开时请求，避免首屏并发占用 GitHub 配额。
    const repo = document.getElementById('repo');
    if (repo && repo.value) loadTabData(tab, repo.value);
    setTimeout(() => observeAnimations(target || document), 100);
}

function isActiveRepo(repo) {
    const repoEl = document.getElementById('repo');
    return Boolean(repoEl && repoEl.value === repo);
}

function loadTabData(tab, repo) {
    const loaded = window._loadedRepoTabs || (window._loadedRepoTabs = new Set());
    const loading = window._loadingRepoTabs || (window._loadingRepoTabs = new Set());
    if (loaded.has(tab) || loading.has(tab)) return;
    const panel = document.getElementById('tab-' + tab);
    if (panel) {
        panel.classList.remove('lazy-content-enter');
        requestAnimationFrame(function() { panel.classList.add('lazy-content-enter'); });
    }
    const loaders = {
        releases: () => loadReleases(repo, undefined, true),
        commits: () => loadCommits(repo, undefined, true),
        issues: () => loadIssues(repo, 1, issuesState, true),
        prs: () => loadPulls(repo, 1, pullsState, true),
        browser: () => {
            window._fileTreeLoaded = true;
            return loadFileTree(repo, getQueryParam('path') || '', true);
        },
        readme: () => loadReadme(repo, true)
    };
    if (!loaders[tab]) return;
    loading.add(tab);
    Promise.resolve(loaders[tab]())
        .then(function(success) {
            if (success !== false && isActiveRepo(repo)) loaded.add(tab);
        })
        .catch(function(error) {
            console.error('tab load:', tab, error);
            loaded.delete(tab);
        })
        .finally(function() { loading.delete(tab); });
}

// ═══════════════════════════════════════════════════
//  Rate Limit 配额显示
// ═══════════════════════════════════════════════════

async function loadRateLimit() {
    const badge = document.getElementById('rate-limit-badge');
    if (!badge) return;
    try {
        const data = await requestJson('/rate-limit');
        if (data.error) { badge.innerHTML = '<span aria-hidden="true" class="ico ico-hourglass ico-gap"></span>?'; return; }
        const limit = Number(data.limit) || 0;
        const remaining = data.remaining == null ? 0 : Number(data.remaining);
        const pct = limit > 0 ? Math.round((remaining / limit) * 100) : 0;
        let color = '#3fb950'; // green
        if (pct < 10) color = '#f85149'; // red
        else if (pct < 25) color = '#ff8c42'; // orange
        badge.innerHTML = `<span aria-hidden="true" class="ico ico-hourglass ico-gap"></span>${escHtml(remaining)}/${escHtml(limit)}`;
        badge.style.color = color;
        badge.style.borderColor = color + '44';
    } catch (e) {
        badge.innerHTML = '<span aria-hidden="true" class="ico ico-hourglass ico-gap"></span>?';
    }
}

// ═══════════════════════════════════════════════════
//  PAT 过期时间格式化
// ═══════════════════════════════════════════════════

function _formatExpiry(expiresAt) {
    if (!expiresAt) {
        return '<span style="color:var(--text-dim);font-size:0.75rem;">' + t('token-permanent') + '</span>';
    }
    try {
        const expiry = new Date(expiresAt);
        const now = new Date();
        if (isNaN(expiry.getTime())) {
            return '<span style="color:var(--text-dim);font-size:0.75rem;">—</span>';
        }
        const diffMs = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const dateStr = expiry.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });

        if (diffDays <= 0) {
            return `<span style="color:#f85149;font-size:0.75rem;" title="${escAttr(dateStr)}"><span aria-hidden="true" class="ico ico-alert ico-gap" style="width:12px;height:12px;"></span>${t("token-expired")}</span>`;
        } else if (diffDays <= 7) {
            return `<span style="color:#f85149;font-size:0.75rem;" title="${escAttr(dateStr)}"><span aria-hidden="true" class="ico ico-alert ico-gap" style="width:12px;height:12px;"></span>${diffDays}${t('days')}</span>`;
        } else if (diffDays <= 30) {
            return `<span style="color:#ff8c42;font-size:0.75rem;" title="${escAttr(dateStr)}"><span aria-hidden="true" class="ico ico-hourglass ico-gap" style="width:12px;height:12px;"></span>${diffDays}${t('days')}</span>`;
        } else {
            return `<span style="color:#3fb950;font-size:0.75rem;" title="${escAttr(dateStr)}"><span aria-hidden="true" class="ico ico-check ico-gap" style="width:12px;height:12px;"></span>${diffDays}${t('days')}</span>`;
        }
    } catch (e) {
        return '<span style="color:var(--text-dim);font-size:0.75rem;">—</span>';
    }
}

// ── Token 明细弹出层 ──
let _tokenPopupData = null;

async function toggleTokenPopup(type) {
    const overlay = document.getElementById('token-popup-overlay');
    const popup = document.getElementById('token-popup');
    if (!overlay || !popup) return;

    if (popup.style.display === 'block') {
        closeTokenPopup();
        return;
    }

    // 加载 Token 数据
    try {
        const data = await requestJson('/rate-limit');
        if (data.error || !data.tokens) {
            setHTML('token-popup-body', '<p style="color:var(--text-dim);">' + t('token-fetch-failed') + '</p>');
        } else {
            _tokenPopupData = data;
            renderTokenPopup(type);
        }
    } catch (e) {
        setHTML('token-popup-body', '<p style="color:var(--text-dim);">' + t('load-failed-generic') + escHtml(e.message) + '</p>');
    }

    overlay.style.display = 'block';
    popup.style.display = 'block';
}

function closeTokenPopup() {
    const overlay = document.getElementById('token-popup-overlay');
    const popup = document.getElementById('token-popup');
    if (overlay) overlay.style.display = 'none';
    if (popup) popup.style.display = 'none';
}

// ── 手动添加 Token ──
async function addManualToken() {
    const tokenInput = document.getElementById('manual-token-input');
    const nameInput = document.getElementById('manual-token-name');
    const statusEl = document.getElementById('manual-token-status');
    if (!tokenInput || !statusEl) return;

    const token = tokenInput.value.trim();
    if (!token) {
        statusEl.innerHTML = t('token-input-placeholder');
        return;
    }
    // 基本格式校验
    if (!token.startsWith('ghp_') && !token.startsWith('gho_') && !token.startsWith('ghu_') &&
        !token.startsWith('ghs_') && !token.startsWith('ghf_') && !token.startsWith('github_pat_')) {
        statusEl.innerHTML = t('token-invalid-format');
        return;
    }

    statusEl.innerHTML = t('token-adding');
    try {
        const resp = await fetch('/add-token', {
            method: 'POST',
            headers: csrfHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ token, name: nameInput ? nameInput.value.trim() : '' }),
        });
        const data = await resp.json();
        if (data.status === 'ok') {
            statusEl.innerHTML = `<span style="color:var(--green);">${t('token-added-msg')} ${escHtml(data.masked)} (${escHtml(data.name)})，${t('token-count').replace('{count}', data.token_count)}</span>`;
            tokenInput.value = '';
            if (nameInput) nameInput.value = '';
            // 刷新 Token 显示
            if (typeof loadDrawerTokenStatus === 'function') loadDrawerTokenStatus();
            showNotification(t('token-added'), 'success');
        } else {
            statusEl.innerHTML = `<span style="color:var(--red);">${t('predict-failed')}${escHtml(data.detail || t('unknown-error'))}</span>`;
        }
    } catch (e) {
        statusEl.innerHTML = `<span style="color:var(--red);">${t('network-error')}${escHtml(e.message)}</span>`;
    }
}

function renderTokenPopup(type) {
    const data = _tokenPopupData;
    if (!data) return;

    const title = type === 'quota' ? t('token-quota-title') : t('token-remaining-title');
    setText('token-popup-title', title);

    const totalLimit = data.limit || 0;
    const totalRemaining = data.remaining || 0;

    let html = '';

    // 汇总说明
    if (type === 'quota') {
        html += `<div class="token-popup-summary">
            <span>${t('token-total-quota')}</span>
            <span>${totalLimit}/h (${t('token-count').replace('{count}', data.tokens.length)})</span>
        </div>`;
        html += `<div class="token-popup-why">
            ${t('token-tip').replace('{count}', data.tokens.length).replace('{limit}', totalLimit)}
        </div>`;
    } else {
        const used = totalLimit - totalRemaining;
        const pct = totalLimit > 0 ? Math.round((totalRemaining / totalLimit) * 100) : 0;
        html += `<div class="token-popup-summary">
            <span>${t('token-total-remaining')}</span>
            <span>${totalRemaining}/${totalLimit} (${pct}%)</span>
        </div>`;
    }

    html += '<div style="margin-top:12px;">';

    // 每个 Token 的明细行
    for (const token of data.tokens) {
        const pct = token.limit > 0 ? Math.round((token.remaining / token.limit) * 100) : 0;
        let color = '#3fb950';
        if (pct < 10) color = '#f85149';
        else if (pct < 25) color = '#ff8c42';

        const bestBadge = token.is_best ? ' <span aria-hidden="true" class="ico ico-arrow-left ico-cyan" style="width:12px;height:12px;"></span> <span style="color:var(--cyan);font-size:0.75rem;">' + t('token-current') + '</span>' : '';
        const expiryHtml = _formatExpiry(token.expires_at);

        html += `<div class="token-detail-row">
            <div>
                <div class="token-detail-name">${escHtml(token.name)}${bestBadge}</div>
                <div class="token-detail-masked">${escHtml(token.masked)}</div>
                <div class="token-detail-expiry" style="margin-top:2px;">${expiryHtml}</div>
            </div>
            <div class="token-detail-stats">
                <div style="font-weight:500;">${escHtml(token.remaining)}/${escHtml(token.limit)}</div>
                <div style="font-size:0.75rem;color:${color};">${pct}%</div>
            </div>
        </div>`;
        if (type === 'remaining') {
            html += `<div class="token-detail-bar">
                <div class="token-detail-fill" style="width:${pct}%;background:${color};"></div>
            </div>`;
        }
    }

    html += '</div>';

    // 归属说明
    html += `<div class="token-popup-why" style="margin-top:12px;">
        ${t('token-config-tip')}
    </div>`;

    setHTML('token-popup-body', html);
}

// ═══════════════════════════════════════════════════
//  负载监控（首页）
// ═══════════════════════════════════════════════════

async function loadLoadMonitor() {
    const el = document.getElementById('load-monitor');
    if (!el) return;
    const pctEl = document.getElementById('load-pct');
    const apiEl = document.getElementById('load-api');
    if (!pctEl || !apiEl) return;
    try {
        const [rl, stats] = await Promise.all([
            requestJson('/rate-limit'),
            requestJson('/token-stats?granularity=hour')
        ]);
        if (rl.error || stats.error) {
            pctEl.textContent = '?';
            apiEl.textContent = t('load-failed-short');
            return;
        }
        // API 剩余百分比
        const apiLimit = Number(rl.limit) || 0;
        const apiRemaining = rl.remaining == null ? 0 : Number(rl.remaining);
        const apiPct = apiLimit > 0 ? Math.round((apiRemaining / apiLimit) * 100) : 0;
        // 当前小时负载（取最近一个整点）
        const currentHour = stats.hours && stats.hours.length > 0
            ? stats.hours[stats.hours.length - 1]
            : null;
        const loadRatio = currentHour ? currentHour.ratio : 0;
        const totalReqs = stats.total_requests || 0;

        // 根据负载着色
        let loadColor = '#3fb950';
        let loadText = t('load-low');
        if (loadRatio > 70) { loadColor = '#f85149'; loadText = t('load-high'); }
        else if (loadRatio > 30) { loadColor = '#ff8c42'; loadText = t('load-medium'); }

        // API 剩余着色
        let apiColor = '#3fb950';
        if (apiPct < 10) apiColor = '#f85149';
        else if (apiPct < 25) apiColor = '#ff8c42';

        pctEl.textContent = `${loadRatio}%`;
        pctEl.style.color = loadColor;
        apiEl.textContent = `API ${apiRemaining}`;
        apiEl.style.color = apiColor;
        el.title = `${t('load')} ${loadRatio}% (${loadText}) · ${t('past-24h')} ${totalReqs} ${t('requests')} · API ${t('remaining')} ${apiRemaining}/${apiLimit} · ${t('click-for-detail')}`;
    } catch (e) {
        pctEl.textContent = '?';
        apiEl.textContent = t('load-failed-short');
    }
}

// ═══════════════════════════════════════════════════
//  Token 统计页面 — 时区感知 + 动效增强
// ═══════════════════════════════════════════════════

function formatLocalHour(isoStr) {
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleTimeString(currentLang === 'zh' ? 'zh-CN' : 'en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false
        });
    } catch(e) {
        return '—';
    }
}

// ═══════════════════════════════════════════════════
//  Token 统计页面 — 懒加载 + 进度条
// ═══════════════════════════════════════════════════

// 更新懒加载进度条
let _lazyStepsCache = null;

function _updateProgress(pct, stepIndex, stepStatus) {
    const fill = document.getElementById('lazy-progress-fill');
    const pctEl = document.getElementById('lazy-progress-pct');
    if (!_lazyStepsCache) _lazyStepsCache = document.querySelectorAll('.lazy-step');
    const steps = _lazyStepsCache;
    const bar = document.getElementById('lazy-progress');
    if (fill) {
        // 使用 CSS transition 驱动进度条动画，比 JS 逐帧更平滑
        fill.style.transition = 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        fill.style.width = Math.min(pct, 100) + '%';
        // 加载中启用扫描动画
        if (pct < 100) {
            fill.classList.add('loading');
        } else {
            fill.classList.remove('loading');
        }
    }
    if (pctEl) {
        pctEl.textContent = Math.round(pct) + '%';
        pctEl.style.color = pct >= 100 ? 'var(--green)' : 'var(--cyan)';
    }
    // 更新步骤状态
    if (steps.length) {
        steps.forEach((el, i) => {
            el.classList.remove('active', 'done');
            if (i < stepIndex) el.classList.add('done');
            else if (i === stepIndex) el.classList.add('active');
        });
    }
    // 100%完成后自动隐藏进度条
    if (pct >= 100 && bar) {
        setTimeout(() => {
            bar.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            bar.style.opacity = '0';
            bar.style.transform = 'translateY(-10px)';
            setTimeout(() => { bar.style.display = 'none'; }, 450);
        }, 300);
    }
}

// 渲染概览数据（第 0 步）
function _renderOverview(data, rl) {
    if (!data || !rl) return;
    const totalReqEl = document.getElementById('total-requests');
    const totalIpsEl = document.getElementById('total-ips');
    if (!totalReqEl || !totalIpsEl) return;
    totalReqEl.textContent = data.total_requests || 0;
    totalIpsEl.textContent = data.total_unique_ips || 0;

    const limit = Number(rl.limit) || 0;
    const remaining = rl.remaining || 0;
    const used = limit - remaining;
    const usedPct = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const quotaFill = document.getElementById('quota-fill');
    const quotaRemainEl = document.getElementById('quota-remaining');
    const quotaCard = document.getElementById('quota-card');
    if (quotaFill) {
        quotaFill.style.width = usedPct + '%';
        if (usedPct >= 99) {
            quotaFill.style.background = '#f85149';
            if (quotaCard) quotaCard.style.background = 'rgba(248,81,73,0.08)';
        } else if (usedPct > 70) {
            quotaFill.style.background = '#f85149';
            if (quotaCard) quotaCard.style.background = '';
        } else if (usedPct > 40) {
            quotaFill.style.background = '#ff8c42';
            if (quotaCard) quotaCard.style.background = '';
        } else {
            quotaFill.style.background = '#3fb950';
            if (quotaCard) quotaCard.style.background = '';
        }
    }
    if (quotaRemainEl) {
        quotaRemainEl.textContent = `${remaining}/${limit} (${100 - usedPct}%)`;
        if (usedPct >= 99) {
            quotaRemainEl.style.color = '#f85149';
        } else if (usedPct > 70) {
            quotaRemainEl.style.color = '#f85149';
        } else if (usedPct > 40) {
            quotaRemainEl.style.color = '#ff8c42';
        } else {
            quotaRemainEl.style.color = '#3fb950';
        }
    }
    setText('quota-limit', `${limit}/h`);

    // 标记概览区域为已加载
    document.querySelectorAll('.lazy-section[data-section="0"]').forEach(el => el.classList.add('loaded'));
    // 数值渐入
    document.querySelectorAll('.lazy-value').forEach(el => el.classList.add('loaded'));

    // 最近更新时间
    const lastUpdateEl = document.getElementById('stats-last-update');
    if (lastUpdateEl) {
        const now = new Date();
        lastUpdateEl.textContent = now.toLocaleTimeString(
            currentLang === 'zh' ? 'zh-CN' : 'en-US',
            { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
        );
    }
}

// 渲染负载柱状图（第 1 步）— 新版股市风格，默认24h
function _renderHourlyBars(data) {
    const barsEl = document.getElementById('hourly-bars');
    if (!barsEl || !data || !data.hours) return;
    _renderHourlyBarsNew(barsEl, data);
}

// 渲染详情表格（第 2 步）— 新版红涨绿跌，默认24h
function _renderDetailTable(data) {
    const tbody = document.getElementById('stats-body');
    if (!tbody) return;
    _renderHourlyTableNew(tbody, data);
}

// 懒加载主入口：分步加载 + 进度条更新
async function loadTokenStats() {
    let timeout;
    try {
        _updateProgress(0, 0, 'active');
        const fillInit = document.getElementById('lazy-progress-fill');
        if (fillInit) fillInit.classList.add('loading');

        timeout = setTimeout(() => {
            const fill = document.getElementById('lazy-progress-fill');
            const pctEl = document.getElementById('lazy-progress-pct');
            const steps = document.querySelectorAll('.lazy-step');
            if (fill) { fill.classList.remove('loading'); fill.style.background = 'var(--red)'; fill.style.width = '100%'; }
            if (pctEl) { pctEl.textContent = t('stats-timeout'); pctEl.style.color = 'var(--red)'; }
            steps.forEach(el => { el.classList.remove('active', 'done'); el.classList.add('done'); });
        }, 30000);

        const [data, rl] = await Promise.all([
            requestJson('/token-stats?granularity=hour'),
            requestJson('/rate-limit')
        ]);
        clearTimeout(timeout);
        _updateProgress(20, 0, 'done');

        _renderOverview(data, rl);
        _updateProgress(45, 1, 'active');

        _updateProgress(60, 1, 'done');

        // 默认渲染24小时视图
        var currentView = '24h';
        _renderHourlyBarsNew(document.getElementById('hourly-bars'), data);
        _updateProgress(80, 2, 'active');

        _updateProgress(95, 2, 'done');

        _renderHourlyTableNew(document.getElementById('stats-body'), data);

        _updateProgress(100, 3, 'done');
        observeAnimations();
    } catch(e) {
        clearTimeout(timeout);
        console.error('loadTokenStats:', e);
        const fill = document.getElementById('lazy-progress-fill');
        const pctEl = document.getElementById('lazy-progress-pct');
        if (fill) { fill.style.background = 'var(--red)'; fill.style.width = '100%'; }
        if (pctEl) { pctEl.innerHTML = '<span aria-hidden="true" class="ico ico-x-circle ico-gap" style="width:14px;height:14px;"></span>' + t('stats-failed'); pctEl.style.color = 'var(--red)'; }
    }
}

// ═══════════════════════════════════════════════════
//  多时间维度图表 — 股市风格红涨绿跌
// ═══════════════════════════════════════════════════

let currentView = '24h';

function formatLocalDate(isoStr) {
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
    } catch(e) { return '—'; }
}
function formatLocalMinute(isoStr) {
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleTimeString(currentLang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch(e) { return '—'; }
}
function getBarColor(change, count, backendColor) {
    // 柱状图始终使用后端负载色（红黄绿基于配额占用）
    // 环比变化仅用于表格中的趋势箭头标识
    if (count > 0) return backendColor || '#3fb950';
    return '#8b98a6';
}

// 切换时间维度
async function switchView(view) {
    if (view === currentView) return;
    currentView = view;
    document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));

    const titles = {
        'realtime': { chart: t('stats-chart-realtime'), table: t('stats-table-realtime'), subtitle: t('stats-subtitle-realtime') },
        '24h': { chart: t('stats-chart-24h'), table: t('stats-table-24h'), subtitle: t('stats-subtitle-24h') },
        '30d': { chart: t('stats-chart-30d'), table: t('stats-table-30d'), subtitle: t('stats-subtitle-30d') },
    };
    const ti = titles[view];
    setHTML('chart-title', ti.chart);
    setText('chart-subtitle', ti.subtitle);
    setHTML('table-title', ti.table);
    setText('table-subtitle', ti.subtitle);

    const thead = document.getElementById('stats-thead');
    if (view === 'realtime') thead.innerHTML = `<tr><th>${t('stats-time')}</th><th>${t('stats-requests')}</th><th>${t('stats-change')}</th><th>${t('stats-ips')}</th><th>${t('stats-load')}</th></tr>`;
    else if (view === '30d') thead.innerHTML = `<tr><th>${t('stats-date')}</th><th>${t('stats-requests')}</th><th>${t('stats-change')}</th><th>${t('stats-ips')}</th><th>${t('stats-load')}</th></tr>`;
    else thead.innerHTML = `<tr><th>${t('stats-time')}</th><th>${t('stats-requests')}</th><th>${t('stats-change')}</th><th>${t('stats-ips')}</th><th>${t('stats-load')}</th></tr>`;

    // 过渡动画：淡出旧图表 → 显示加载遮罩 → 加载数据 → 淡入新图表
    const bars = document.getElementById('hourly-bars');
    const transition = document.getElementById('chart-transition');
    const progressFill = document.getElementById('chart-progress-fill');
    const loadingText = document.getElementById('chart-loading-text');

    // 第一步：淡出旧图表
    bars.style.transition = 'opacity 0.2s ease';
    bars.style.opacity = '0';
    await new Promise(r => setTimeout(r, 220));

    // 第二步：显示加载遮罩（图表过渡动画，内置 spinner 提示加载中）
    transition.style.display = 'flex';
    transition.style.opacity = '0';
    transition.style.transition = 'opacity 0.15s ease';
    requestAnimationFrame(() => {
        transition.style.opacity = '1';
        // 进度条显示 60% 表示加载中（实际进度由数据加载完成驱动）
        progressFill.style.transition = 'width 0.3s ease';
        progressFill.style.width = '60%';
    });

    const labels = { 'realtime': t('stats-loading-minutes'), '24h': t('stats-loading-hours'), '30d': t('stats-loading-days') };
    loadingText.textContent = labels[view];

    try {
        const granularityMap = { 'realtime': 'minute', '24h': 'hour', '30d': 'day' };
        const data = await requestJson('/token-stats?granularity=' + granularityMap[view]);

        // 加载完成：进度条瞬间填满
        progressFill.style.transition = 'width 0.3s ease';
        progressFill.style.width = '100%';

        await new Promise(r => setTimeout(r, 350));
        transition.style.opacity = '0';
        await new Promise(r => setTimeout(r, 250));
        transition.style.display = 'none';

        // 渲染新数据
        _renderViewBars(data, view);
        _renderViewTable(data, view);

        // 淡入新图表
        bars.style.opacity = '1';
    } catch (e) {
        console.error('switchView:', e);
        progressFill.classList.remove('loading');
        transition.style.opacity = '0';
        await new Promise(r => setTimeout(r, 250));
        transition.style.display = 'none';
        bars.style.opacity = '1';
        bars.innerHTML = '<p style="color:var(--text-dim);padding:30px;text-align:center;">' + t('load-failed') + '</p>';
    }
}

function _renderViewBars(data, view) {
    const barsEl = document.getElementById('hourly-bars');
    if (!barsEl) return;
    if (view === 'realtime') _renderRealtimeBars(barsEl, data);
    else if (view === '30d') _renderDailyBars(barsEl, data);
    else _renderHourlyBarsNew(barsEl, data);
}

function _renderHourlyBarsNew(barsEl, data) {
    if (!data || !data.hours) { barsEl.innerHTML = '<p style="color:var(--text-dim);padding:30px;text-align:center;">' + t('stats-no-data') + '</p>'; return; }
    const hours = data.hours;
    const maxCount = Math.max(...hours.map(h => h.count), 1);
    const maxBarHeight = 140;
    barsEl.innerHTML = `<div class="chart-bars">${hours.map((h, idx) => {
        const prev = idx > 0 ? hours[idx-1].count : 0;
        const change = idx > 0 ? h.count - prev : 0;
        const barHeight = Math.max(4, (h.count / maxCount) * maxBarHeight);
        const color = getBarColor(change, h.count, h.color);
        const localHour = formatLocalHour(h.hour);
        // 使用 CSS 自定义属性传递延迟时间和高度，避免 inline style 膨胀
        return `<div class="hour-bar-wrap" style="--bar-delay:${idx * 20}ms;--bar-height:${barHeight}px;" title="${escAttr(localHour)} — ${h.count} ${t('chart-requests')} ${h.unique_ips} ${t('chart-load')} ${h.ratio}%${change !== 0 ? ' ' + t('chart-change') + ' ' + (change>0?'+':'') + change : ''}">
            <div class="hour-bar" style="height:var(--bar-height);background:${color};"></div>
            <div class="hour-label">${escHtml(localHour)}</div>
            <div class="hour-count">${h.count}</div>
        </div>`;
    }).join('')}</div>`;
    requestAnimationFrame(() => barsEl.querySelectorAll('.hour-bar').forEach(el => {
        el.style.animationDelay = el.parentElement.style.getPropertyValue('--bar-delay');
        el.classList.add('bar-grow');
    }));
    document.querySelectorAll('.lazy-section[data-section="1"]').forEach(el => el.classList.add('loaded'));
}

function _renderRealtimeBars(barsEl, data) {
    if (!data || !data.hours) { barsEl.innerHTML = '<p style="color:var(--text-dim);padding:30px;text-align:center;">' + t('stats-no-data') + '</p>'; return; }
    const hours = data.hours;
    const maxCount = Math.max(...hours.map(h => h.count), 1);
    const maxBarHeight = 140;
    barsEl.innerHTML = `<div class="chart-bars" style="overflow-x:auto;overflow-y:hidden;">${hours.map((h, idx) => {
        const prev = idx > 0 ? hours[idx-1].count : 0;
        const change = idx > 0 ? h.count - prev : 0;
        const barHeight = Math.max(4, (h.count / maxCount) * maxBarHeight);
        const color = getBarColor(change, h.count, h.color);
        const localHour = formatLocalMinute(h.hour);
        return `<div class="hour-bar-wrap" style="min-width:28px;--bar-delay:${idx * 10}ms;--bar-height:${barHeight}px;" title="${escAttr(localHour)} — ${h.count} ${t('chart-requests')} ${h.unique_ips} ${t('chart-load')} ${h.ratio}%${change !== 0 ? ' ' + t('chart-change') + ' ' + (change>0?'+':'') + change : ''}">
            <div class="hour-bar" style="height:var(--bar-height);background:${color};"></div>
            <div class="hour-label" style="font-size:0.55rem;">${escHtml(localHour)}</div>
            <div class="hour-count" style="font-size:0.55rem;">${h.count}</div>
        </div>`;
    }).join('')}</div>`;
    requestAnimationFrame(() => barsEl.querySelectorAll('.hour-bar').forEach(el => {
        el.style.animationDelay = el.parentElement.style.getPropertyValue('--bar-delay');
        el.classList.add('bar-grow');
    }));
    document.querySelectorAll('.lazy-section[data-section="1"]').forEach(el => el.classList.add('loaded'));
}

function _renderDailyBars(barsEl, data) {
    if (!data || !data.hours) { barsEl.innerHTML = '<p style="color:var(--text-dim);padding:30px;text-align:center;">' + t('stats-no-data') + '</p>'; return; }
    const hours = data.hours;
    const maxCount = Math.max(...hours.map(h => h.count), 1);
    const maxBarHeight = 140;
    barsEl.innerHTML = `<div class="chart-bars">${hours.map((h, idx) => {
        const prev = idx > 0 ? hours[idx-1].count : 0;
        const change = idx > 0 ? h.count - prev : 0;
        const barHeight = Math.max(4, (h.count / maxCount) * maxBarHeight);
        const color = getBarColor(change, h.count, h.color);
        const localDate = formatLocalDate(h.hour);
        return `<div class="hour-bar-wrap" style="--bar-delay:${idx * 20}ms;--bar-height:${barHeight}px;" title="${escAttr(localDate)} — ${h.count} ${t('chart-requests')} ${h.unique_ips} ${t('chart-load')} ${h.ratio}%${change !== 0 ? ' ' + t('chart-change') + ' ' + (change>0?'+':'') + change : ''}">
            <div class="hour-bar" style="height:var(--bar-height);background:${color};"></div>
            <div class="hour-label">${escHtml(localDate)}</div>
            <div class="hour-count">${h.count}</div>
        </div>`;
    }).join('')}</div>`;
    requestAnimationFrame(() => barsEl.querySelectorAll('.hour-bar').forEach(el => {
        el.style.animationDelay = el.parentElement.style.getPropertyValue('--bar-delay');
        el.classList.add('bar-grow');
    }));
    document.querySelectorAll('.lazy-section[data-section="1"]').forEach(el => el.classList.add('loaded'));
}

function _renderViewTable(data, view) {
    const tbody = document.getElementById('stats-body');
    if (!tbody) return;
    if (view === 'realtime') _renderRealtimeTable(tbody, data);
    else if (view === '30d') _renderDailyTable(tbody, data);
    else _renderHourlyTableNew(tbody, data);
}

function _renderHourlyTableNew(tbody, data) {
    if (!data || !data.hours) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);">' + t('stats-no-data') + '</td></tr>'; return; }
    tbody.innerHTML = data.hours.map((h, idx) => {
        const localHour = formatLocalHour(h.hour);
        let trendHtml = '', c = 'trend-flat';
        if (idx > 0) {
            const diff = h.count - data.hours[idx-1].count;
            if (diff > 0) { trendHtml = `<span class="trend-up">↑${diff}</span>`; c = 'trend-up'; }
            else if (diff < 0) { trendHtml = `<span class="trend-down">↓${Math.abs(diff)}</span>`; c = 'trend-down'; }
        }
        return `<tr style="--row-delay:${idx * 20}ms;">
            <td style="font-weight:500;">${escHtml(localHour)}</td>
            <td>${h.count}</td>
            <td class="${c}">${trendHtml || '—'}</td>
            <td>${h.unique_ips}</td>
            <td><span class="badge" style="background:${h.ratio < 30 ? '#3fb950' : h.ratio < 70 ? '#ff8c42' : '#f85149'};color:#fff;">${h.ratio}%</span></td>
        </tr>`;
    }).join('');
    // 用 requestAnimationFrame 触发 CSS 动画，避免 inline style 和 animation 混合
    requestAnimationFrame(() => {
        tbody.querySelectorAll('tr').forEach(el => {
            el.classList.add('animate-in');
            el.classList.add('visible');
            el.style.animationDelay = el.style.getPropertyValue('--row-delay');
        });
    });
    document.querySelectorAll('.lazy-section[data-section="2"]').forEach(el => el.classList.add('loaded'));
}

function _renderRealtimeTable(tbody, data) {
    if (!data || !data.hours) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);">' + t('stats-no-data') + '</td></tr>'; return; }
    tbody.innerHTML = data.hours.map((h, idx) => {
        const localTime = formatLocalMinute(h.hour);
        let trendHtml = '', c = 'trend-flat';
        if (idx > 0) {
            const diff = h.count - data.hours[idx-1].count;
            if (diff > 0) { trendHtml = `<span class="trend-up">↑${diff}</span>`; c = 'trend-up'; }
            else if (diff < 0) { trendHtml = `<span class="trend-down">↓${Math.abs(diff)}</span>`; c = 'trend-down'; }
        }
        return `<tr style="--row-delay:${idx * 10}ms;">
            <td style="font-weight:500;">${escHtml(localTime)}</td>
            <td>${h.count}</td>
            <td class="${c}">${trendHtml || '—'}</td>
            <td>${h.unique_ips}</td>
            <td><span class="badge" style="background:${h.ratio < 30 ? '#3fb950' : h.ratio < 70 ? '#ff8c42' : '#f85149'};color:#fff;">${h.ratio}%</span></td>
        </tr>`;
    }).join('');
    requestAnimationFrame(() => {
        tbody.querySelectorAll('tr').forEach(el => {
            el.classList.add('animate-in');
            el.classList.add('visible');
            el.style.animationDelay = el.style.getPropertyValue('--row-delay');
        });
    });
    document.querySelectorAll('.lazy-section[data-section="2"]').forEach(el => el.classList.add('loaded'));
}

function _renderDailyTable(tbody, data) {
    if (!data || !data.hours) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);">' + t('stats-no-data') + '</td></tr>'; return; }
    tbody.innerHTML = data.hours.map((h, idx) => {
        const localDate = formatLocalDate(h.hour);
        let trendHtml = '', c = 'trend-flat';
        if (idx > 0) {
            const diff = h.count - data.hours[idx-1].count;
            if (diff > 0) { trendHtml = `<span class="trend-up">↑${diff}</span>`; c = 'trend-up'; }
            else if (diff < 0) { trendHtml = `<span class="trend-down">↓${Math.abs(diff)}</span>`; c = 'trend-down'; }
        }
        return `<tr style="--row-delay:${idx * 20}ms;">
            <td style="font-weight:500;">${escHtml(localDate)}</td>
            <td>${h.count}</td>
            <td class="${c}">${trendHtml || '—'}</td>
            <td>${h.unique_ips}</td>
            <td><span class="badge" style="background:${h.ratio < 30 ? '#3fb950' : h.ratio < 70 ? '#ff8c42' : '#f85149'};color:#fff;">${h.ratio}%</span></td>
        </tr>`;
    }).join('');
    requestAnimationFrame(() => {
        tbody.querySelectorAll('tr').forEach(el => {
            el.classList.add('animate-in');
            el.classList.add('visible');
            el.style.animationDelay = el.style.getPropertyValue('--row-delay');
        });
    });
    document.querySelectorAll('.lazy-section[data-section="2"]').forEach(el => el.classList.add('loaded'));
}

// ═══════════════════════════════════════════════════
//  统一加载
// ═══════════════════════════════════════════════════

// 定时器句柄，用于页面卸载时清理
let _loadMonitorTimer = null;
let _rateLimitTimer = null;
let _tokenStatsTimer = null;

function loadAll() {
    const repoEl = document.getElementById("repo");
    if (!repoEl) { console.error("loadAll: #repo not found"); return; }
    const repo = repoEl.value;
    if (!repo) return;
    window._loadedRepoTabs = new Set();
    loadRepoInfo(repo);

    // 默认仅加载当前标签；其余内容在用户首次打开时再请求。
    const requestedTab = getQueryParam('tab');
    const initialTab = requestedTab && document.getElementById('tab-' + requestedTab) ? requestedTab : 'releases';
    switchTab(initialTab);

    // 宽屏时仓库抽屉常驻，初始仓库面板需要立即填充语言统计。
    const repoPanel = document.getElementById('dpanel-repo');
    if (repoPanel && repoPanel.classList.contains('active')) {
        loadRepoLanguages(repo);
    }
}

window.onload = async () => {
    await loadLang(currentLang);
    try { applyI18n(); } catch(e) { console.error('i18n:', e); }
    try { applyTheme(currentTheme); } catch(e) { console.error('theme:', e); }
    try { initFontSize(); } catch(e) { console.error('font-size:', e); }
    try { initTextAlign(); } catch(e) { console.error('text-align:', e); }
    try { initCacheHint(); } catch(e) { console.error('cache-hint:', e); }
    const p = window.location.pathname;

    // 首页使用负载监控，其他页面保持原有的 rate-limit 显示
    if (p === '/') {
        async function _runLoadMonitor() {
            try { await loadLoadMonitor(); } catch(e) { console.error('load-monitor:', e); }
            _loadMonitorTimer = setTimeout(_runLoadMonitor, 30000);
        }
        _runLoadMonitor();
    } else if (document.getElementById('rate-limit-badge')) {
        async function _runRateLimit() {
            try { await loadRateLimit(); } catch(e) { console.error('rate-limit:', e); }
            _rateLimitTimer = setTimeout(_runRateLimit, 30000);
        }
        _runRateLimit();
    }

    // 页面卸载时清理所有定时器，防止泄漏
    window.addEventListener('beforeunload', function _cleanupTimers() {
        clearTimeout(_loadMonitorTimer);
        clearTimeout(_rateLimitTimer);
        clearTimeout(_tokenStatsTimer);
        clearTimeout(_cacheHintTimer);
        clearTimeout(_cacheHintDebounceTimer);
        clearTimeout(_notifyTimer);
        clearTimeout(window._toneErrorTimer);
        _loadMonitorTimer = null;
        _rateLimitTimer = null;
        _tokenStatsTimer = null;
        _cacheHintTimer = null;
        _cacheHintDebounceTimer = null;
        _notifyTimer = null;
        window._toneErrorTimer = null;
        window.removeEventListener('beforeunload', _cleanupTimers);
    });

    try { observeAnimations(); } catch(e) { console.error('observe-animations:', e); }
    if (p === '/release') { try { loadReleaseDetail(); } catch(e) { console.error(e); } return; }
    if (p === '/pull') { try { loadPullDetail(); } catch(e) { console.error(e); } return; }
    if (p === '/issue') { try { loadIssueDetail(); } catch(e) { console.error(e); } return; }
    if (p === '/commit') { try { loadCommitDetail(); } catch(e) { console.error(e); } return; }
    if (p === '/file') { try { loadFileContent(); } catch(e) { console.error(e); } return; }
    if (p === '/token-stats-page') {
        async function _runTokenStats() {
            try { await loadTokenStats(); } catch(e) { console.error(e); }
            _tokenStatsTimer = setTimeout(_runTokenStats, 30000);
        }
        _runTokenStats();
        return;
    }

    const sel = getQueryParam('repo');
    const rs = document.getElementById('repo');
    if (rs && sel) rs.value = sel;
    try { loadAll(); } catch(e) { console.error('loadAll:', e); }
};

// ═══════════════════════════════════════════════════
//  深度学习流量预测（纯 Python 神经网络）
// ═══════════════════════════════════════════════════

function _drawPredictionChart(canvas, history, prediction, metric) {
    if (!canvas || !history) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const PAD = { top: 20, right: 20, bottom: 30, left: 50 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    // 合并所有数据找范围
    const all = [...history, ...(prediction || [])];
    if (all.length === 0) return;
    const maxVal = Math.max(...all.map(d => d.value), 1) * 1.15;
    const minVal = 0;

    function xPos(i, total) { return PAD.left + (i / Math.max(total - 1, 1)) * plotW; }
    function yPos(v) { return PAD.top + plotH - ((v - minVal) / (maxVal - minVal)) * plotH; }

    ctx.clearRect(0, 0, W, H);

    // 背景网格
    ctx.strokeStyle = 'rgba(128,128,128,0.15)';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = PAD.top + (i / gridLines) * plotH;
        ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    }

    // Y 轴标签
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() || '#8b98a6';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
        const v = maxVal - (i / gridLines) * (maxVal - minVal);
        const y = PAD.top + (i / gridLines) * plotH;
        ctx.fillText(Math.round(v).toString(), PAD.left - 8, y + 4);
    }

    // Y 轴标题
    ctx.save();
    ctx.translate(12, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() || '#8b98a6';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(metric === 'clones' ? 'Clones' : 'Views', 0, 0);
    ctx.restore();

    // 历史折线（蓝色）
    const histLen = history.length;
    const totalLen = histLen + (prediction ? prediction.length : 0);
    if (histLen > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#58a6ff';
        ctx.lineWidth = 2;
        for (let i = 0; i < histLen; i++) {
            const x = xPos(i, totalLen);
            const y = yPos(history[i].value);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 历史区域填充（半透明蓝）
        ctx.beginPath();
        ctx.moveTo(xPos(0, totalLen), yPos(0));
        for (let i = 0; i < histLen; i++) {
            ctx.lineTo(xPos(i, totalLen), yPos(history[i].value));
        }
        ctx.lineTo(xPos(histLen - 1, totalLen), yPos(0));
        ctx.closePath();
        ctx.fillStyle = 'rgba(88,166,255,0.08)';
        ctx.fill();
    }

    // 预测折线（橙色虚线）
    if (prediction && prediction.length > 0) {
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = '#ff8c42';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < prediction.length; i++) {
            const x = xPos(histLen + i, totalLen);
            const y = yPos(prediction[i].value);
            const xPrev = xPos(histLen - 1, totalLen);
            if (i === 0) {
                // 从最后一个历史值连接到第一个预测值
                const lastHistY = yPos(history[histLen - 1].value);
                ctx.moveTo(xPrev, lastHistY);
            }
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // 预测区域填充（橙色半透明）
        ctx.beginPath();
        const lastHPos = xPos(histLen - 1, totalLen);
        ctx.moveTo(lastHPos, yPos(0));
        // 从历史最后一个横坐标连到预测起点
        ctx.lineTo(lastHPos, yPos(prediction[0].value));
        for (let i = 0; i < prediction.length; i++) {
            const x = xPos(histLen + i, totalLen);
            ctx.lineTo(x, yPos(prediction[i].value));
        }
        ctx.lineTo(xPos(totalLen - 1, totalLen), yPos(0));
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,140,66,0.08)';
        ctx.fill();
    }

    // 分隔线（历史/预测边界）
    if (prediction && prediction.length > 0) {
        const sepX = xPos(histLen - 1, totalLen);
        ctx.strokeStyle = 'rgba(255,140,66,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(sepX, PAD.top); ctx.lineTo(sepX, PAD.top + plotH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,140,66,0.6)';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t('future-prediction'), sepX + 4, PAD.top + 14);
    }

    // X 轴日期标签（等间隔取 6 个）
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() || '#8b98a6';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const totalLabels = all.length;
    const labelStep = Math.max(1, Math.floor(totalLabels / 6));
    for (let i = 0; i < totalLabels; i += labelStep) {
        const d = all[i];
        if (!d) continue;
        const dateStr = (d.date || '').slice(5, 10); // MM-DD
        const x = xPos(i, totalLabels);
        ctx.fillText(dateStr, x, H - 8);
    }
}

function _drawLossChart(canvas, lossHistory) {
    if (!canvas || !lossHistory || lossHistory.length < 2) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const PAD = { top: 12, right: 12, bottom: 20, left: 50 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const maxLoss = Math.max(...lossHistory, 0.001) * 1.2;
    const minLoss = Math.min(...lossHistory, 0);
    const range = Math.max(maxLoss - minLoss, 0.001);

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(128,128,128,0.1)';
    ctx.lineWidth = 1;
    const gridLines = 3;
    for (let i = 0; i <= gridLines; i++) {
        const y = PAD.top + (i / gridLines) * plotH;
        ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    }

    const n = lossHistory.length;
    ctx.beginPath();
    ctx.strokeStyle = '#3fb950';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < n; i++) {
        const x = PAD.left + (i / Math.max(n - 1, 1)) * plotW;
        const y = PAD.top + plotH - ((lossHistory[i] - minLoss) / range) * plotH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
}

async function loadPrediction(forceRetrain) {
    const repoEl = document.getElementById('repo');
    if (!repoEl || !repoEl.value) return;
    const repo = repoEl.value;
    const metricEl = document.getElementById('predict-metric');
    const stepsEl = document.getElementById('predict-steps');
    const metric = metricEl ? metricEl.value : 'clones';
    const steps = parseInt(stepsEl ? stepsEl.value : '14');
    const statusEl = document.getElementById('predict-status');
    const lossContainer = document.getElementById('predict-loss-container');

    if (statusEl) statusEl.textContent = forceRetrain ? t('training-model') : t('predict-loading');

    try {
        let url = `/predict?repo=${encodeURIComponent(repo)}&metric=${metric}&steps=${steps}`;
        if (forceRetrain) {
            await requestJson('/predict/train', {
                method: 'POST',
                headers: csrfHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ repo, metric }),
            });
            // 训练后重新获取预测
        }
        const data = await requestJson(url);
        if (data.error) {
            if (statusEl) statusEl.textContent = t('predict-failed') + data.error;
            return;
        }
        const canvas = document.getElementById('predict-chart');
        _drawPredictionChart(canvas, data.history || [], data.prediction || [], metric);

        // 训练损失曲线
        if (data.loss_history && data.loss_history.length >= 2) {
            if (lossContainer) lossContainer.style.display = 'block';
            const lossCanvas = document.getElementById('predict-loss-chart');
            _drawLossChart(lossCanvas, data.loss_history);
        } else {
            if (lossContainer) lossContainer.style.display = 'none';
        }

        if (statusEl) {
            const predCount = (data.prediction || []).length;
            const histCount = (data.history || []).length;
            statusEl.textContent = t('predict-status-msg').replace('{h}', histCount).replace('{p}', predCount);
            statusEl.style.color = 'var(--text-dim)';
        }
    } catch (e) {
        console.error('loadPrediction:', e);
        if (statusEl) statusEl.textContent = t('load-failed-generic') + e.message;
    }
}

// ═══════════════════════════════════════════════════
//  Mindustry 模组商店（Mods 标签页）
// ═══════════════════════════════════════════════════

var allModsData = [];
var filteredModsData = [];
var currentModsPage = 1;
var MODS_PAGE_SIZE = 24;
var _modsAuthorFilter = '';
var _modsLangFilter = '';

function showModsFetchTime(data) {
    var el = document.getElementById('mods-fetch-time');
    if (!el) return;
    var age = data._cached_age;
    if (age === undefined || age === null) {
        el.style.display = 'none';
        return;
    }
    el.style.display = 'inline';
    var text;
    if (age < 60) {
        text = t('just-now');
    } else if (age < 3600) {
        text = Math.floor(age / 60) + ' ' + t('minutes-ago');
    } else if (age < 86400) {
        text = Math.floor(age / 3600) + ' ' + t('hours-ago');
    } else {
        text = Math.floor(age / 86400) + ' ' + t('days-ago');
    }
    el.innerHTML = '<span class="ico ico-refresh-cw" style="width:11px;height:11px;vertical-align:middle;margin-right:3px;"></span> ' + text;
}

/* ── 语言分类过滤条 ── */

function loadModsStore() {
    var grid = document.getElementById('mods-grid');
    if (!grid) return;
    // 加载统计信息用于构建过滤条
    fetch('/api/mods/stats')
        .then(function(r) { return r.json(); })
        .then(function(stats) {
            if (stats && stats.authors) {
                buildAuthorFilterBar(stats.authors, stats.total);
            }
            if (stats && stats.langs) {
                buildLangFilterBar(stats.langs, stats.total);
            }
            if (stats && stats._cached_age !== undefined) {
                var el = document.getElementById('mods-fetch-time');
                if (el) showModsFetchTime({_cached_age: stats._cached_age});
            }
        })
        .catch(function() {});
    // 加载第一页
    loadModsPage(1);
}

function loadModsPage(page) {
    var grid = document.getElementById('mods-grid');
    var paginator = document.getElementById('mods-paginator');
    var countLabel = document.getElementById('mods-count-label');
    if (!grid) return;

    // 取消前一次正在进行的请求，避免先发后至的响应覆盖最新结果
    if (window._modsLastController) {
        window._modsLastController.abort();
    }

    currentModsPage = page;

    // 骨架屏加载动画
    grid.innerHTML = renderModsSkeleton();

    var searchEl = document.getElementById('mods-search-input');
    var search = searchEl ? searchEl.value.trim() : '';
    var sort = _modsSortValue || 'default';
    var author = _modsAuthorFilter || '';
    var lang = _modsLangFilter || '';

    var params = '?page=' + page + '&size=' + MODS_PAGE_SIZE + '&sort=' + encodeURIComponent(sort)
        + '&search=' + encodeURIComponent(search)
        + '&author=' + encodeURIComponent(author)
        + '&lang=' + encodeURIComponent(lang);

    var controller = new AbortController();
    window._modsLastController = controller;
    var timer = setTimeout(function() { controller.abort(); }, 15000);

    fetch('/api/mods/page' + params, { signal: controller.signal })
        .then(function(r) {
            clearTimeout(timer);
            return r.json();
        })
        .then(function(data) {
            if (data.error) {
                grid.innerHTML = '<div class="mods-error"><span class="ico ico-alert" style="width:24px;height:24px;margin:0 auto 8px;"></span><p>' + escHtml(data.error) + '</p></div>';
                return;
            }
            var mods = Array.isArray(data.mods) ? data.mods : [];
            _modsTotal = data.total || 0;
            _modsTotalPages = data.total_pages || 1;
            currentModsPage = data.page || page;

            if (countLabel) {
                countLabel.textContent = t('mods-count').replace('{n}', _modsTotal);
            }

            if (_modsTotal === 0) {
                grid.innerHTML = '<div class="mods-empty"><span class="ico ico-search" style="width:28px;height:28px;margin:0 auto 8px;opacity:0.4;"></span><p>' + t('mods-no-results') + '</p></div>';
                if (paginator) paginator.style.display = 'none';
                return;
            }

            var html = '';
            for (var i = 0; i < mods.length; i++) {
                html += renderModCard(mods[i]);
            }
            grid.innerHTML = html;

            if (paginator) {
                if (_modsTotalPages > 1) {
                    paginator.style.display = 'flex';
                    var prevBtn = document.getElementById('mods-prev-btn');
                    var nextBtn = document.getElementById('mods-next-btn');
                    var infoEl = document.getElementById('mods-page-info');
                    if (prevBtn) prevBtn.disabled = currentModsPage <= 1;
                    if (nextBtn) nextBtn.disabled = currentModsPage >= _modsTotalPages;
                    if (infoEl) {
                        infoEl.textContent = t('mods-page').replace('{n}', currentModsPage).replace('{t}', _modsTotalPages);
                    }
                } else {
                    paginator.style.display = 'none';
                }
            }
        })
        .catch(function(err) {
            clearTimeout(timer);
            var emsg;
            if (err.name === 'AbortError') {
                emsg = '请求超时，后端未响应';
            } else {
                emsg = t('mods-load-failed') + ': ' + (err.message || '网络错误');
            }
            grid.innerHTML = '<div class="mods-error"><span class="ico ico-alert" style="width:24px;height:24px;margin:0 auto 8px;"></span><p>' + escHtml(emsg) + '</p><button class="btn-sm" onclick="loadModsPage(' + currentModsPage + ')" style="margin-top:8px;">' + t('mods-retry') + '</button></div>';
            console.error('[mods]', err);
        });
    }

    function renderModsSkeleton() {
    var cards = '';
    for (var i = 0; i < 6; i++) {
        cards += '<div class="mods-skeleton">'
            + '<div class="mods-skel-top"><div class="mods-skel-line w40"></div><div class="mods-skel-circle"></div></div>'
            + '<div class="mods-skel-line w80"></div>'
            + '<div class="mods-skel-line w60"></div>'
            + '<div class="mods-skel-line w90"></div>'
            + '<div class="mods-skel-footer"><div class="mods-skel-line w30"></div><div class="mods-skel-line w20"></div></div>'
            + '</div>';
    }
    return '<div class="mods-grid is-loading">' + cards + '</div>';
}

/* ── 作者过滤条（基于统计接口） ── */
function buildAuthorFilterBar(authors, total) {
    var bar = document.getElementById('mods-filter-bar');
    if (!bar) return;
    var sorted = Object.keys(authors).sort(function(a, b) { return authors[b] - authors[a]; });
    var html = '<button class="mods-filter-btn active" data-author="" onclick="filterModsByAuthor(this, \'\')">' + t('mods-all') + ' (' + total + ')</button>';
    sorted.forEach(function(author) {
        html += '<button class="mods-filter-btn" data-author="' + escAttr(author) + '" onclick="filterModsByAuthor(this, \'' + escAttr(author) + '\')">' + escHtml(author) + ' (' + authors[author] + ')</button>';
    });
    bar.innerHTML = html;
}

/* ── 语言分类过滤条（基于统计接口） ── */
function buildLangFilterBar(langs, total) {
    var bar = document.getElementById('mods-lang-filter-bar');
    if (!bar) return;
    var html = '<span class="mods-lang-filter-label"><span class="ico ico-code" style="width:12px;height:12px;vertical-align:middle;margin-right:4px;"></span></span>';
    html += '<button class="mods-lang-btn active" data-lang="" onclick="filterModsByLang(this, \'\')">' + t('mods-all') + ' (' + total + ')</button>';
    if (langs.js > 0) html += '<button class="mods-lang-btn" data-lang="js" onclick="filterModsByLang(this, \'js\')"><span class="mods-dot js-dot"></span> JS (' + langs.js + ')</button>';
    if (langs.java > 0) html += '<button class="mods-lang-btn" data-lang="java" onclick="filterModsByLang(this, \'java\')"><span class="mods-dot java-dot"></span> Java (' + langs.java + ')</button>';
    if (langs.both > 0) html += '<button class="mods-lang-btn" data-lang="both" onclick="filterModsByLang(this, \'both\')"><span class="mods-dot both-dot"></span> JS+Java (' + langs.both + ')</button>';
    if (langs.none > 0) html += '<button class="mods-lang-btn" data-lang="none" onclick="filterModsByLang(this, \'none\')"><span class="mods-dot none-dot"></span> ' + t('mods-no-scripts') + ' (' + langs.none + ')</button>';
    bar.innerHTML = html;
}

function filterModsByLang(btn, lang) {
    var bar = document.getElementById('mods-lang-filter-bar');
    if (bar) {
        bar.querySelectorAll('.mods-lang-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
    }
    _modsLangFilter = lang;
    loadModsPage(1);
}

function filterModsByAuthor(btn, author) {
    var bar = document.getElementById('mods-filter-bar');
    if (bar) {
        bar.querySelectorAll('.mods-filter-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
    }
    _modsAuthorFilter = author;
    loadModsPage(1);
}

function filterModsList() {
    loadModsPage(1);
}

function toggleSortDropdown(event) {
    if (event) { event.stopPropagation(); }
    var dd = document.getElementById('mods-sort-dropdown');
    if (!dd) return;
    var isOpen = dd.style.display !== 'none';
    closeAllModsSortDropdowns();
    if (!isOpen) {
        dd.style.display = 'block';
    }
}

function selectSortOption(el, value) {
    var dd = document.getElementById('mods-sort-dropdown');
    if (dd) {
        dd.querySelectorAll('.mods-sort-option').forEach(function(o) { o.classList.remove('active'); });
        el.classList.add('active');
        dd.style.display = 'none';
    }
    var label = document.getElementById('mods-sort-label');
    if (label) label.textContent = el.textContent;
    _modsSortValue = value;
    loadModsPage(1);
}

function closeAllModsSortDropdowns() {
    var dds = document.querySelectorAll('.mods-sort-dropdown');
    for (var i = 0; i < dds.length; i++) {
        dds[i].style.display = 'none';
    }
}

function goModsPage(page) {
    if (page < 1 || page > _modsTotalPages) return;
    loadModsPage(page);
    document.getElementById('mods-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

var _modsInfoPopupId = 0;

function renderModCard(m) {
    var name = escHtml(m.name || m.repo || 'Unknown');
    var author = escHtml(m.author || 'Unknown');
    var desc = escHtml((m.description || '').slice(0, 200));
    var stars = m.stars || 0;
    var version = escHtml(m.version || '—');
    var minVer = m.minGameVersion || '—';
    var hasIcon = m.hasIcon;
    var hasScripts = m.hasScripts;
    var hasJava = m.hasJava;
    var repo = escHtml(m.repo || '');
    var updated = m.lastUpdated ? m.lastUpdated.slice(0, 10) : '—';
    var starStr = stars > 0 ? '<span class="mods-star"><span class="ico ico-star" style="width:13px;height:13px;vertical-align:middle;"></span> ' + stars + '</span>' : '';

    var popupId = 'mods-popup-' + (++_modsInfoPopupId);

    // 从插件注册表配置动态生成分类标识
    var classifications = window.__modClassifications || [];
    var badges = '';
    var langLabels = '';
    for (var ci = 0; ci < classifications.length; ci++) {
        var cl = classifications[ci];
        var val = m[cl.field];
        if (cl.match !== undefined && val !== cl.match) continue;
        var label = cl.label_zh || cl.label;
        var iconHtml = cl.icon ? '<span class="' + cl.icon + '" style="width:11px;height:11px;vertical-align:middle;margin-right:2px;"></span>' : '';
        badges += '<span class="mods-badge" style="border-color:' + cl.color + ';color:' + cl.color + ';" title="' + label + '">' + iconHtml + (cl.label || '') + '</span>';
        langLabels += '<span class="mods-filter-tag" style="border-color:' + cl.color + ';color:' + cl.color + ';font-size:0.7rem;">' + label + '</span> ';
    }

    var popupContent = ''
        + '<div class="mods-popup-header">' + name + '</div>'
        + '<div class="mods-popup-section mods-popup-desc-section"><span class="mods-popup-desc">' + desc + '</span></div>'
        + (badges ? '<div class="mods-popup-section"><span class="mods-popup-label">' + t('mods-has-icon') + '</span><div class="mods-popup-badges">' + badges + '</div></div>' : '')
        + '<div class="mods-popup-section"><span class="mods-popup-label">' + t('mods-game-version') + '</span><span class="mods-popup-value"><span class="ico ico-gear" style="width:11px;height:11px;vertical-align:middle;margin-right:3px;"></span> v' + escHtml(minVer) + '</span></div>'
        + '<div class="mods-popup-section"><span class="mods-popup-label">' + t('mods-mod-version') + '</span><span class="mods-popup-value"><span class="ico ico-file-text" style="width:11px;height:11px;vertical-align:middle;margin-right:3px;"></span> ' + version + '</span></div>'
        + '<div class="mods-popup-section"><span class="mods-popup-label">' + t('mods-last-updated') + '</span><span class="mods-popup-value"><span class="ico ico-calendar" style="width:11px;height:11px;vertical-align:middle;margin-right:3px;"></span> ' + updated + '</span></div>'
        + (repo ? '<div class="mods-popup-section"><a class="mods-card-link" href="/repo-mirror?repo=' + repo + '" target="_blank" rel="noopener noreferrer"><span class="ico ico-link-external" style="width:12px;height:12px;vertical-align:middle;margin-right:3px;"></span> ' + t('mods-view-repo') + '</a></div>' : '');

    return '<div class="mods-card" data-popup="' + popupId + '">'
        + '<div class="mods-card-top">'
        +   '<div class="mods-card-header">'
        +     '<div class="mods-card-name-row">'
        +       '<span class="mods-card-icon">' + (hasIcon ? '<span class="ico ico-image" style="width:15px;height:15px;"></span>' : '<span class="ico ico-package" style="width:15px;height:15px;"></span>') + '</span>'
        +       '<span class="mods-card-name" title="' + name + '">' + name + '</span>'
        +       (starStr ? '<span class="mods-card-stars">' + starStr + '</span>' : '')
        +     '</div>'
        +     '<div class="mods-card-author" id="mods-author-' + popupId + '"><span class="mods-author-trunc" onclick="toggleModsAuthor(\'' + popupId + '\', \'' + escAttr(author) + '\', event)">' + t('mods-by') + ' ' + (author.length > 28 ? author.slice(0, 26) + '...' : author) + '</span></div>'
        +   '</div>'
        +   '<div class="mods-card-repo" title="' + repo + '"><span class="ico ico-repo" style="width:11px;height:11px;vertical-align:middle;margin-right:3px;"></span> ' + (repo.length > 36 ? repo.slice(0, 33) + '...' : repo) + '</div>'
        +   '<button class="mods-info-btn" onclick="toggleModsPopup(\'' + popupId + '\', event)" data-i18n-title="' + 'click-for-detail' + '" title="详细信息">i</button>'
        + '</div>'
        + '<div class="mods-popup" id="' + popupId + '" style="display:none;">'
        +   '<div class="mods-popup-inner">'
        +     '<button class="mods-popup-close" onclick="closeModsPopup(\'' + popupId + '\', event)">&times;</button>'
        +     popupContent
        +   '</div>'
        + '</div>'
        + '</div>';
}

function toggleModsPopup(popupId, event) {
    if (event) { event.stopPropagation(); }
    var popup = document.getElementById(popupId);
    if (!popup) return;
    var isOpen = popup.style.display !== 'none';
    closeAllModsPopups();
    if (!isOpen) {
        popup._originParent = popup.parentNode;
        document.body.appendChild(popup);
        popup.style.display = 'flex';
    }
}

function toggleModsAuthor(popupId, fullAuthor, event) {
    if (event) { event.stopPropagation(); }
    var el = document.getElementById('mods-author-' + popupId);
    if (!el) return;
    var span = el.querySelector('.mods-author-trunc');
    if (!span) return;
    if (span._expanded) {
        span.textContent = t('mods-by') + ' ' + (fullAuthor.length > 28 ? fullAuthor.slice(0, 26) + '...' : fullAuthor);
        span.classList.remove('expanded');
        span._expanded = false;
    } else {
        span.textContent = t('mods-by') + ' ' + fullAuthor;
        span.classList.add('expanded');
        span._expanded = true;
    }
}

function closeModsPopup(popupId, event) {
    if (event) { event.stopPropagation(); }
    var popup = document.getElementById(popupId);
    if (popup) {
        popup.style.display = 'none';
        if (popup._originParent && popup._originParent.isConnected) {
            popup._originParent.appendChild(popup);
        }
    }
}

function closeAllModsPopups() {
    var popups = document.querySelectorAll('.mods-popup');
    for (var i = 0; i < popups.length; i++) {
        closeModsPopup(popups[i].id);
    }
}

// 点击卡片外部关闭所有弹出层
document.addEventListener('click', function(e) {
    if (!e.target.closest('.mods-card') && !e.target.closest('.mods-popup-inner')) {
        closeAllModsPopups();
    }
    if (!e.target.closest('.mods-sort-wrap')) {
        closeAllModsSortDropdowns();
    }
});

// 当切换到 predict 标签页时自动加载（mods 标签已由 mindustry-mods 插件接管）
function _initTabListeners() {
    var origSwitchTab = window.switchTab || window._origSwitchTab;
    if (typeof origSwitchTab !== 'function') return;
    window._origSwitchTab2 = origSwitchTab;
    window.switchTab = function(tab) {
        if (window._origSwitchTab2) window._origSwitchTab2(tab);
        if (tab === 'predict') {
            setTimeout(function() {
                if (typeof loadPrediction === 'function') loadPrediction();
            }, 300);
        }
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initTabListeners);
} else {
    _initTabListeners();
}
