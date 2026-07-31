# GitAAP 开发者文档

> GitAAP — GitHub 仓库流量与信息看板

---

## 📁 目录结构

```
modules/gitaap/                  # GitAAP 模块(仓库内多模块结构之一)
├── backend/                     # Python 后端模块
│   ├── app.py                      #   启动检查器（编译检测 + 错误隔离）
│   ├── models/db.py                #   SQLAlchemy 数据库模型
│   ├── services/token_manager.py   #   GitHub Token 管理器
│   ├── services/cache.py           #   内存缓存服务
│   └── utils/helpers.py            #   辅助工具
│
├── i18n/
│   ├── main.py                     # FastAPI 主入口（含全部 API 路由）
│   ├── templates/                  # Jinja2 HTML 模板
│   │   ├── index.html              #   首页
│   │   ├── dashboard.html          #   仓库仪表盘
│   │   ├── docs.html               #   开发者文档（带身份令牌验证）
│   │   ├── release-detail.html     #   Release 详情
│   │   ├── commit-detail.html      #   Commit 详情
│   │   ├── pull-detail.html        #   PR 详情
│   │   ├── issue-detail.html       #   Issue 详情
│   │   ├── file-view.html          #   文件浏览
│   │   ├── token-stats.html        #   Token 统计
│   │   ├── plugins.html            #   插件管理
│   │   ├── _theme_head.html        #   公共 <head> 片段
│   │   ├── _js_fallback.html       #   JS 降级提示
│   │   └── _side_drawer_links.html #   侧边栏公共片段
│   └── static/
│       ├── function.js             #   主 JS（4618 行）
│       ├── style.css               #   主样式表（3209 行）
│       ├── marked.min.js           #   Markdown 渲染库（marked v17）
│       ├── docs/
│       │   ├── DEVELOPER.md        #   本文件
│       │   └── docs.css            #   文档页专用样式
│       ├── themes/                 #   主题系统（16 个 CSS 文件，含 11 种色调）
│       ├── lang/                   #   多语言（zh / en / zh-Hant）
│       ├── icons/                  #   SVG 图标库（~120 个）
│       └── plugins/                #   插件系统
│           ├── registry.json
│           ├── core/loader.js
│           ├── core/manager.js
│           ├── core/manager.css
│           └── available/legal-compliance/
│
├── data/data.db                    # SQLite 数据库
├── docker-compose.yml              # Docker 部署配置
└── .env                            # 环境变量
```

---

## 🔐 文档身份验证机制

文档页（`/docs`）采用 **HMAC 签名令牌** 防止爬虫直接抓取 MD 内容：

```
浏览器请求 /docs?file=DEVELOPER.md
  → 后端生成 5 分钟有效的 HMAC 令牌，嵌入 HTML <meta> 标签
  → 前端 JS 读取令牌，fetch('/docs/md?file=...') 时放入 X-Docs-Token 头
  → 后端验证签名 + 时效，返回 MD 原文
  → 前端 marked.js 渲染
```

**关键代码** (`i18n/main.py`):

| 函数 | 作用 |
|------|------|
| `DOCS_SECRET = secrets.token_hex(32)` | 启动时生成，用于签名 |
| `_generate_docs_token(file)` | 生成 `base64(hmac_sha256(file:expiry).expiry)` |
| `_verify_docs_token(token, file)` | 验证签名 + 检查是否过期 |
| `GET /docs` | 渲染 docs.html，嵌入令牌 |
| `GET /docs/md` | 验证令牌，返回 `text/markdown` |

---

## 🔌 插件系统

采用**注册表 + 清单**架构，支持 CSS/JS 自动注入、依赖检查、健康监控。插件系统不是项目的附属功能，而是 GitAAP 的核心扩展机制——它将静态文件路由、页面片段注入、配置存储等能力开放给第三方开发者，使 GitAAP 从一个"固定的监控看板"变为可按需组装的功能平台。

### 设计目的

GitAAP 插件体系解决的是一个现实矛盾：不同用户有完全不同的需求。有的站点需要法律合规通知（Cookie 弹窗、免责声明），有的需要人机验证保护表单，有的需要特定仓库的数据分析，有的只需要极简的监控看板。如果把所有功能都打包进核心，项目将变得臃肿、难以维护、版本更迭缓慢。

插件系统的设计目标：

| 目标 | 说明 |
|------|------|
| **按需加载** | 用户只加载自己需要的功能，不拖慢页面 |
| **隔离安全** | 每个插件运行在独立的 IIFE 作用域中，互不干扰，也不污染全局 |
| **简化开发** | 创建一个新插件只需要一个目录、一个 `manifest.json`、一个 `plugin.js`，无需修改核心代码 |
| **热切换** | 在管理页面即时启用/禁用插件，无需重启服务 |
| **范围限定** | 插件可按仓库限定作用域 (`repositoryScopes`)，只在特定仓库页面激活 |

### 能力范围

目前插件系统支持以下能力，并随项目持续扩展：

| 能力 | 实现方式 | 示例插件 |
|------|----------|----------|
| **CSS 样式注入** | 在 manifest 中声明 `style` 字段，loader.js 自动注入 `<link>` | 外观与工具箱、Legal & Compliance |
| **JS 逻辑注入** | 在 manifest 中声明 `entry` 字段，loader.js 注入 `<script>` | 所有插件 |
| **依赖调度** | `dependencies` 字段声明依赖关系，loader.js 按拓扑序注入 | — |
| **运行时健康监控** | 插件写入 `window.__pluginHealth`，管理页面可视化展示 | 所有插件 |
| **CSRF 保护** | toggle 操作自动检查 `_csrfToken`，无需插件自行处理 | — |
| **多文件资源** | `assets` 字段声明额外 CSS/JS/SVG 文件 | 外观与工具箱 |
| **仓库作用域** | `repositoryScopes` 限定插件只在指定仓库页面加载 | Mindustry 模组商店 |
| **配置持久化** | `config` 字段在 registry 中存储插件默认配置 | 流量预测、人机验证 |

已实现的插件涵盖的领域：

- **外观定制** — 色调切换、通知条、快捷工具箱（appearance-tools）
- **法律合规** — 免责声明弹窗、Cookie 隐私同意（legal-compliance）
- **安全防护** — TAC 文字语序验证码（captcha-verify）
- **信息增强** — 许可证/语言/话题标签弹窗（info-popups）
- **数据预测** — 基于神经网络的仓库流量趋势预测（traffic-predict）
- **仓库扩展** — 文件目录镜像浏览（repo-mirror）、Mindustry 模组商店（mindustry-mods）

### 发展前沿

插件系统的未来发展沿三条主线展开：

1. **更深的核心集成**：从目前的 CSS/JS 注入，逐步开放后端钩子（如数据采集后触发插件回调、渲染管道中的模板片段插槽），让插件不仅能改外观，还能介入核心数据流。
2. **更丰富的插件类型**：引入数据源插件（接入非 GitHub 的数据源）、告警插件（在特定条件下触发通知）、仪表盘组件插件（在仪表盘页面添加自定义图表区块）。
3. **插件市场生态**：建立插件索引和版本管理机制，允许用户从远程仓库安装插件，并支持自动更新、版本兼容性检查。长远目标是为每个 GitAAP 实例都能像 VS Code 市场那样发现和安装社区贡献的插件。

### 架构

```
_theme_head.html（所有模板共用）
  └→ <script src="plugins/core/loader.js" defer></script>
       └→ 异步 GET /static/plugins/registry.json（8 秒超时）
            └→ 过滤 enabled !== false 的插件
                 └→ 依赖图拓扑排序（保证依赖插件先于被依赖插件注入）
                      ├→ 注入 CSS（自动去重）
                      └→ 注入 JS（依赖链内 async=false 保序，其余各自异步；8 秒看门狗）
```

`loader.js` 在每个页面的 `<head>` 中以 `defer` 加载，自动发现并注入所有已启用插件的资源。`manager.js` 仅在 `/plugins` 管理页面加载，提供插件列表渲染和 toggle 开关。

---

### 文件结构

```
i18n/static/plugins/
├── registry.json                     # 全局注册表（插件列表 + 启用状态）
├── core/
│   ├── loader.js                     # 页面级自动加载器（所有页面共用）
│   ├── manager.js                    # 管理页面专用渲染器 + toggle 逻辑
│   └── manager.css                   # 管理页面专用样式
└── available/
    ├── legal-compliance/             # 示例：免责声明 + Cookie 同意
    │   ├── manifest.json
    │   ├── plugin.js
    │   └── plugin.css
    └── my-plugin/                    # 新插件目录
        ├── manifest.json             # 插件元数据（必选）
        ├── plugin.js                 # 插件入口（必选）
        └── plugin.css                # 插件样式（可选）
```

---

### manifest.json 规范

每个插件必须包含 `manifest.json`，字段如下：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 唯一标识，与目录名一致，使用 kebab-case |
| `name` | string | 是 | 同 id |
| `version` | string | 是 | 语义化版本号，如 `"1.0.0"` |
| `title` | string | 是 | 插件的显示名称，用于管理页面 |
| `description` | string | 是 | 功能简介 |
| `author` | string | 是 | 作者名称 |
| `team` | string | 否 | 团队名称 |
| `created_at` | string | 否 | ISO 8601 日期 |
| `updated_at` | string | 否 | ISO 8601 日期 |
| `size` | string | 否 | 文件大小（如 `"3.5KB"`），用于管理页面展示 |
| `enabled` | boolean | 否 | 默认启用状态，管理页面可通过 toggle 覆盖 |
| `entry` | string | 是 | JS 入口文件名（相对于插件目录） |
| `style` | string | 否 | CSS 入口文件名（相对于插件目录） |
| `assets` | object | 否 | 额外资源：`{"css": ["extra.css"], "svg": [], "js": ["extra.js"]}` |
| `dependencies` | string[] | 否 | 依赖的其他插件 id 列表（所有依赖必须已 enabled，否则跳过加载） |
| `tags` | string[] | 否 | 标签列表，用于管理页面分类 |
| `config` | object | 否 | 插件自定义配置（可在 plugin.js 中读取） |

**示例 manifest.json:**

```json
{
  "id": "my-plugin",
  "name": "my-plugin",
  "version": "1.0.0",
  "title": "我的插件",
  "description": "一个示例插件",
  "author": "GitAAP Team",
  "created_at": "2026-07-26",
  "enabled": true,
  "entry": "plugin.js",
  "style": "plugin.css",
  "dependencies": [],
  "tags": ["example"],
  "config": {
    "option1": true,
    "option2": "value"
  }
}
```

---

### registry.json 规范

`registry.json` 是全局注册表，loader.js 和 manager.js 均从中读取插件列表：

```json
{
  "version": "1.1.0",
  "updated_at": "2026-07-25",
  "plugins": [
    {
      "id": "my-plugin",
      "title": "我的插件",
      "version": "1.0.0",
      "description": "一个示例插件",
      "author": "GitAAP Team",
      "enabled": true,
      "entry": "/static/plugins/available/my-plugin/plugin.js",
      "style": "/static/plugins/available/my-plugin/plugin.css",
      "manifest": "/static/plugins/available/my-plugin/manifest.json",
      "dependencies": [],
      "tags": ["example"]
    }
  ]
}
```

**注意**：`entry` / `style` / `manifest` 必须使用以 `/static/plugins/available/<plugin-id>/` 开头的绝对路径。loader.js 的 `resolvePath` 仅对以 `/` 开头的路径原样保留，非 `/` 开头的相对路径不会自动拼合正确目录。

---

### 创建新插件的步骤

**第1步：创建目录和文件**

```
mkdir -p i18n/static/plugins/available/my-plugin
```

**第2步：编写 manifest.json**（按上述规范填写）

**第3步：编写 plugin.js** — 必须遵循以下约定：

```javascript
/**
 * my-plugin/plugin.js — 简短描述
 * 依赖说明（如有依赖其他插件或主程序函数，在此声明）
 */
(function() {
  'use strict';

  // ★ 强制要求：健康上报（loader.js 和管理页面依赖此信息）
  window.__pluginHealth = window.__pluginHealth || {};
  window.__pluginHealth['my-plugin'] = { ok: true, stage: '就绪', errors: [] };

  // ── DOM 时机处理 ──
  // 插件由 loader.js 在 registry 返回后动态注入，执行时机晚于 DOMContentLoaded；
  // 但为兼容被其他入口提前引入的情况，访问 body 前仍建议判空。
  function safeAppend(el) {
    if (document.body) {
      document.body.appendChild(el);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        document.body.appendChild(el);
      }, { once: true });
    }
  }

  // ── 业务逻辑 ──
  // ...你的代码...

})();
```

**第4步：在 registry.json 中注册**

在 `plugins` 数组中添加你的插件条目，设置 `enabled: true`。

**第5步：在 templates/plugins.html 中添加管理页面入口（如需）**

---

### 插件开发约定

#### 1. IIFE 隔离（强制）

所有插件 JS 必须包裹在 `(function() { 'use strict'; ... })()` 中，避免污染全局作用域。

#### 2. 健康上报（强制）

每个插件必须在初始化后写入：

```javascript
window.__pluginHealth = window.__pluginHealth || {};
window.__pluginHealth['<plugin-id>'] = {
  ok: true,
  stage: '当前状态的简短描述',
  errors: []      // 错误信息数组（如有）
};
```

- `ok: false` 表示插件运行异常，管理页面会显示红色错误标记
- `errors` 数组累积错误消息（每次追加，不覆盖）

**运行时更新健康状态：**

```javascript
// 异步操作成功
window.__pluginHealth['my-plugin'].stage = '数据加载完成';
window.__pluginHealth['my-plugin'].ok = true;

// 操作失败
window.__pluginHealth['my-plugin'].ok = false;
window.__pluginHealth['my-plugin'].errors.push('具体错误原因');
```

#### 3. 执行时机（强制）

loader.js 自身以 `defer` 加载，但插件 JS 是它在 registry 异步返回后动态注入的，因此**插件脚本的执行时机总是晚于 `DOMContentLoaded`**。注入时仅对依赖链内的脚本设置 `script.async = false` 以保序，无依赖插件各自独立异步执行，互不阻塞（单个脚本另有 8 秒看门狗兜底）。此时：

- `document.head` — 始终可用
- `document.body` — 正常情况下可用；但插件可能被其他入口提前引入，仍建议判空
- `document.querySelector(...)` — 可以使用（DOM 已解析完毕）

**因此，任何直接操作 `document.body` 的代码建议判空：**

```javascript
// 错误示例（可能抛出 TypeError）
document.body.appendChild(el);

// 正确做法1：判空 + 回退到事件
function appendToBody(el) {
  if (document.body) {
    document.body.appendChild(el);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      document.body.appendChild(el);
    }, { once: true });
  }
}

// 正确做法2：延迟到 DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

#### 4. 全局变量命名约定

插件暴露给全局作用域（`window`）的变量必须使用前缀以避免冲突：

| 前缀 | 用途 | 示例 |
|------|------|------|
| `__pluginHealth` | loader.js 定义的健康状态存储（共用） | `window.__pluginHealth['my-plugin']` |
| `__pluginRegistry` | loader.js 缓存的注册表数据（只读） | `window.__pluginRegistry` |
| `__plugin<Name>` | 插件自身命名空间（推荐） | `window.__pluginCaptcha` |
| `__<name>` | 需要暴露的内部状态（备选） | `window.__myPluginConfig` |
| `_<name>` | 遗留前缀，不推荐新插件使用 | `window._myData` |

**严禁**：直接使用无前缀的全局变量名（如 `window.data`、`window.config`）。

#### 5. CSS 命名空间（推荐）

插件 CSS 类名必须包含插件前缀，避免与主程序或其他插件冲突：

```css
/* 推荐 */
.plugin-mirror-header { ... }
.plugin-mirror-card { ... }

/* 不推荐（太通用，容易冲突） */
.header { ... }
.card { ... }
```

#### 6. 依赖声明

如果插件依赖：

- **其他插件**：在 `manifest.json` 的 `dependencies` 字段中声明。缺失依赖时，loader.js 会跳过加载并输出 console.warn。
- **主程序全局函数**（如 `function.js` 中的 `switchTab()`、`loadFileTree()`）：在 plugin.js 顶部用注释声明，并用轮询/事件机制等待函数就绪，不要假设函数已存在。

```javascript
/**
 * 依赖: function.js 中的 switchTab() 全局函数
 * 运行时轮询等待，非硬依赖
 */
function waitForSwitchTab(callback) {
  if (typeof switchTab === 'function') {
    callback();
  } else {
    setTimeout(function() { waitForSwitchTab(callback); }, 100);
  }
}
```

---

### loader.js 核心行为

| 行为 | 详情 |
|------|------|
| registry 加载 | 异步 GET，8 秒超时，失败时静默退出（不影响页面） |
| enabled 过滤 | `p.enabled !== false` 即为启用 |
| 依赖检查 | 缺失依赖的插件跳过加载，输出 console.warn |
| 注入顺序 | 拓扑排序：被依赖的插件先注入 DOM |
| JS 注入 | 依赖链内 `async=false` 保序，无依赖插件各自异步；单脚本 8 秒看门狗 |
| CSS/JS 去重 | 比较源 URL（剥离查询参数），避免重复注入 |
| 健康上报 | 写入 `window.__pluginHealth['_loader']` |
| 缓存共享 | 写入 `window.__pluginRegistry` 供 manager.js 复用 |

---

### manager.js 核心行为

| 行为 | 详情 |
|------|------|
| registry 获取 | 优先复用 `window.__pluginRegistry` 缓存，否则自行请求（10 秒超时） |
| 插件卡片渲染 | 读取 registry.plugins 数组，renderPluginCard() 生成 HTML |
| toggle 开关 | 通过**事件委托**绑定 change 事件（非 onclick 拼接，防 XSS） |
| CSRF 保护 | toggle 前检查 `window._csrfToken`，缺失时自动 `GET /csrf-token` 获取 |
| 竞态保护 | 递增 `_toggleSeq` 序号，快速点击时仅恢复当前请求的复选框状态 |
| 健康状态展示 | 轮询 `window.__pluginHealth`（0s / 2s / 5s 三次检查），显示每个插件和 loader 自身的运行状况 |
| CSS 选择器安全 | 使用 `CSS.escape()` 转义 plugin id 中的特殊字符 |

---

## 🌐 多语言 (i18n)

语言文件：`i18n/static/lang/{zh,zh-Hant,en}.json`（各 293 个键）

### 工作机制

```javascript
// 页面加载 → loadLang(currentLang) → 注入 langData
// 模板中使用 data-i18n 属性：
<span data-i18n="page-title-index">GitHub 镜像状态</span>
// JS 中使用 t('key') 获取翻译：
el.innerHTML = t('loading');
```

### 添加新翻译

1. 同时在 `zh.json` / `en.json` / `zh-Hant.json` 添加键值
2. 可在 `FALLBACK_EN`（function.js 顶部）添加英文兜底

---

## 🧪 后端 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 首页 |
| `/repo` | GET | 仓库仪表盘 |
| `/repo-info` | GET | 仓库基本信息 |
| `/releases` | GET | Releases 列表 |
| `/release-detail` | GET | Release 详情 |
| `/commits` | GET | Commits 列表 |
| `/commit-detail` | GET | Commit 详情 |
| `/issues` | GET | Issues 列表 |
| `/issue-detail` | GET | Issue 详情 |
| `/pulls` | GET | Pull Requests 列表 |
| `/pull-detail` | GET | PR 详情 |
| `/repo-tree` | GET | 仓库文件树 |
| `/file-content` | GET | 文件内容 |
| `/repo-languages` | GET | 编程语言占比 |
| `/rate-limit` | GET | API 配额状态 |
| `/token-stats` | GET | Token 使用统计 |
| `/docs` | GET | 开发者文档页面 |
| `/docs/md` | GET | MD 原文（需令牌） |
| `/plugins` | GET | 插件管理页 |
| `/plugins/toggle` | POST | 启用/禁用插件 |

### 通用响应格式

```json
// 成功时直接返回数据
{ "name": "repo", "stars": 1234, ... }

// 错误时返回 detail 字段
{ "detail": "Error message" }
```

---

## 📦 部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 重启
docker-compose restart
```

### 文件级挂载

宿主机修改即时同步到容器（`docker-compose.yml` 中定义）。添加新文件时需同步更新挂载映射。

### 环境变量

| 变量 | 说明 |
|------|------|
| `GITHUB_TOKEN` | GitHub Token（单 Token 模式） |
| `GITHUB_TOKENS` | 多 Token，逗号分隔，支持 `NAME=TOKEN` 格式 |
| `REPOS` | 监控的仓库列表，逗号分隔 |
| `UPDATE_HOURS` | 数据更新间隔（小时） |
| `DISABLE_TRAFFIC` | 禁用流量数据采集 |
| `CSRF_ALLOWED_HOSTS` | 允许的跨站域名 |

---

## 💡 开发提示

1. **前端调试**：`function.js`（4618 行）和 `style.css`（3209 行）是主要维护文件，改完注意检查移动端断点
2. **避免并发请求**：首页预加载使用 `setTimeout` 逐个仓库请求，间隔 300ms
3. **主题变量**：使用 `var(--accent)` / `var(--bg)` / `var(--text)` 等 CSS 变量，不要硬编码颜色
4. **Tone 色调**：在 `:root[data-tone="xxx"]` 中定义，无需 `!important`，同时提供亮色模式 `:root[data-theme="light"][data-tone="xxx"]` 变量
5. **图标系统**：SVG 图标用 `.ico` 类，通过 CSS `filter` 着色。图标文件放在 `static/icons/`
6. **加载状态**：使用 `showLoading(el, text)` 共用函数（function.js 中定义），不要重复写 spinner HTML
7. **可访问性**：图标按钮加 `aria-label` 属性，分页按钮加 `aria-label="上一页/下一页"`
8. **缓存清除**：生产环境更新 `_APP_STATIC_VERSION`（main.py 中）强制刷新静态资源
9. **i18n 回退**：`t(key)` 找不到翻译时显示 key 本身。英文兜底数据定义在 `FALLBACK_EN`（function.js 顶部）
10. **页面身份验证**：添加新的 token 验证端点时，使用 `_verify_docs_token()` 防止爬虫抓取

---

## IP 归属查询 API

IP 归属查询是一个**独立常驻进程**，与 GitAAP 主服务无关。它通过 `api.www.eocc.top` 域名对外提供 IP 地理位置查询服务。

> 快速导航：[架构概览](#架构概览) / [项目结构](#项目结构) / [启动与停止](#启动与停止) / [配置](#配置) / [API 路由规范](#api-路由规范) / [鉴权体系](#鉴权体系) / [凭证传输规范](#凭证传输规范) / [安全强制规则](#安全强制规则) / [返回格式](#返回格式) / [接口调用示例](#接口调用示例) / [JavaScript SDK 示例](#javascript-sdk-示例) / [输入校验与边界情况](#输入校验与边界情况) / [常见坑点](#常见坑点) / [内部设计要点](#内部设计要点)

### 架构概览

```
外部请求 → api.www.eocc.top (1Panel OpenResty)
                ↓ 反向代理
          127.0.0.1:4001 (Python Flask 常驻进程)
                ↓
    ┌───────────┼───────────┐
    │           │           │
  MMDB 文件   Redis      内网/IPv6
  (95MB)      限流+票据   拦截校验
```

### 项目结构

```
/home/www/GHWATCH/                       # Python 运行环境目录
├── ipapi/                              # IP 归属查询 Python 包
│   ├── app.py                          # Flask 主应用（路由、鉴权分发）
│   ├── config.py                       # 全局配置（MMDB路径、Redis、监听地址、密钥）
│   ├── ipdb.py                         # MMDB 全局加载（模块导入即初始化）
│   ├── auth.py                         # 长期密钥验证 + Redis GETDEL 一次性票据
│   ├── ratelimit.py                    # Redis Lua 滑动窗口限流
│   ├── utils.py                        # IP格式校验、内网/保留段检测
│   ├── __init__.py                     # 包标记
│   ├── __main__.py                     # python3 -m ipapi 入口
│   └── requirements.txt               # 依赖清单（redis, maxminddb）
├── start_ipapi.sh                      # 后台常驻启动脚本
├── start_ipapi.py                      # Python 守护化启动器
├── stop_ipapi.sh                       # 停止脚本
└── verify_ipapi.py                     # 综合自检脚本

/home/www/gitaap/ipapi/                # 项目源码中的业务代码（开发维护用）
└── (同上文件结构)
```

### 启动与停止

```bash
# 启动（前台调试）
cd /home/www/GHWATCH && python3 -m ipapi.app

# 启动（后台常驻）
cd /home/www/GHWATCH && ./start_ipapi.sh
# 或
cd /home/www/GHWATCH && python3 start_ipapi.py

# 停止
cd /home/www/GHWATCH && ./stop_ipapi.sh

# 验证
cd /home/www/GHWATCH && python3 verify_ipapi.py

# 查看日志
tail -f /home/www/GHWATCH/logs/ipapi.log
```

### 配置

通过环境变量配置，可在启动前设置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `IPAPI_HOST` | `127.0.0.1` | 监听地址 |
| `IPAPI_PORT` | `4001` | 监听端口 |
| `IPAPI_REDIS_URL` | `redis://127.0.0.1:6379/0` | Redis 连接地址 |
| `IPAPI_MMDB_PATH` | `/opt/1panel/.../data/ip/Merged-IP.mmdb` | MMDB 文件路径 |
| `IPAPI_RATE_LIMIT` | `60` | 匿名单 IP 每分钟允许次数 |
| `PARTNER_KEYS` | `["test-partner-key-001"]` | 合作方长期密钥（JSON 数组） |

### API 路由规范

以下是 API 的全部路由，两套 IP 查询模式**同时兼容**。

| 路由 | 方法 | 说明 |
|------|------|------|
| `GET /` | GET | **调试信息页** — 显示服务状态、请求者信息、凭证、请求头等调试数据 |
| `GET /?action=ip&addr=<IP>` | GET | **参数模式** — 查询指定 IP 归属 |
| `GET /?action=ip` | GET | **参数模式** — 查询客户端自身 IP（匿名/票据鉴权） |
| `GET /api/ip/<IP>` | GET | **REST 路径模式** — 查询指定 IP 归属 |
| `GET /api/ip/` | GET | **REST 路径模式** — 查询客户端自身 IP |
| `POST /api/ticket` | POST | **换取临时票据** — 使用长期密钥换取一次性票据 |
| `GET /api/health` | GET | **健康检查** — 返回服务运行状态 |

#### 1. 调试信息页（根路径）

访问根路径时，不带任何查询参数会显示 HTML 调试面板，包含以下信息：

```
GET /
```

**面板内容：**

| 区块 | 显示内容 |
|------|----------|
| 服务状态 | 运行状态、服务器/客户端时间戳、进程运行时间、MMDB 加载状态、Redis 连接状态、限流配置、合作方密钥数量 |
| 请求者信息 | 客户端 IP、黑名单状态、请求方法/URI、User-Agent、X-Forwarded-For |
| 凭证信息 | 长期密钥（X-Api-Token，如存在则红色警示"你的 Token 被看见了！"）、临时票据（X-Ticket） |
| 请求头列表 | 所有 HTTP 请求头完整列表 |

> 如果请求中携带了 `token` GET 参数，调试页会以红色警示显示"你的 Token 被看见了！不要在 URL 或非安全通道中传递密钥。"

#### 2. 参数模式

```
GET /?action=ip&addr=<IP地址>
GET /?action=ip（使用客户端 REMOTE_ADDR）
```

#### 2. REST 路径模式

```
GET /api/ip/<IP地址>
GET /api/ip/（使用客户端 REMOTE_ADDR）
```

#### IP 解析优先级

```
路径携带IP > GET参数addr > 来访客户端 REMOTE_ADDR（访客本机IP）
```

### 鉴权体系

#### 匿名访问（无凭证）

- 无任何限制，直接调用
- 自动记录客户端 IP
- 限流：单 IP 最多 60 次/分钟（可配置）
- 超出返回 `429`

#### 授权合作方访问（临时票据机制）

流程：

```
合作方                     IP查询API
  │                            │
  │  POST /api/ticket          │
  │  头: X-Api-Token=<密钥>     │
  │ ───────────────────────→   │
  │                            │── 校验密钥
  │                            │── Redis SETEX 5分钟
  │  ←── { ticket: "xxx" }    │
  │                            │
  │  GET /api/ip/8.8.8.8       │
  │  头: X-Ticket=<票据值>      │
  │ ───────────────────────→   │
  │                            │── Redis GETDEL（原子操作）
  │                            │── 校验成功 → 查询返回
  │  ←── { ip, country, ... } │     票据失效（防重用）
  │                            │
  │  GET /api/ip/1.1.1.1       │
  │  头: X-Ticket=<同一票据>     │
  │ ───────────────────────→   │
  │  ←── 401 票据无效/已过期    │
```

**约束**：
- 长期密钥**禁止直接用于查询 IP**，仅限换取临时票据
- 临时票据有效期 **5 分钟**，仅可成功调用 **1 次**
- 核销使用 Redis `GETDEL` **原子操作**，防止并发场景重复使用

### 凭证传输规范

| 凭证 | 请求头 | 用途 | 备注 |
|------|--------|------|------|
| 长期密钥 | `X-Api-Token` | 换取临时票据 | 正式业务禁止 URL 明文传递 |
| 临时票据 | `X-Ticket` | 查询 IP 归属 | 一次有效 |
| 调试用 | `?token=<密钥>` | 本地调试 | **仅限开发环境**，正式业务禁用 |

> **安全提示**：`GET /api/ticket?token=xxx` 仅在开发调试时可用。
> 生产环境必须使用请求头 `X-Api-Token` 传递长期密钥，
> 禁止在 URL 中以明文方式携带密钥。

### 安全强制规则

拦截以下内网/保留段 IP，禁止查询：

| 地址段 | 说明 |
|--------|------|
| `0.0.0.0/8` | 当前网络（RFC 1122） |
| `10.0.0.0/8` | RFC 1918 私网 |
| `127.0.0.0/8` | 回环地址 |
| `169.254.0.0/16` | 链路本地 |
| `172.16.0.0/12` | RFC 1918 私网 |
| `192.168.0.0/16` | RFC 1918 私网 |
| `224.0.0.0/4` | 组播 |
| `240.0.0.0/4` | 保留 |
| `255.255.255.255/32` | 受限广播 |
| `::1/128` | IPv6 回环 |
| `fc00::/7` | IPv6 唯一本地地址（ULA） |
| `fe80::/10` | IPv6 链路本地 |
| `ff00::/8` | IPv6 组播 |

### 返回格式

统一 JSON 结构。

#### 成功

```json
{
  "code": 200,
  "data": {
    "ip": "8.8.8.8",
    "country": "美国",
    "province": null,
    "city": null
  }
}
```

#### 错误

```json
{ "code": 400, "message": "IP 地址格式无效" }
{ "code": 400, "message": "内网/保留地址不允许查询" }
{ "code": 401, "message": "长期密钥无效" }
{ "code": 401, "message": "临时票据无效或已过期" }
{ "code": 401, "message": "缺少凭证（请求头 X-Api-Token）" }
{ "code": 429, "message": "超出访问频率限制，请稍后再试" }
```

#### 状态码规范

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 参数非法 / 内网IP / 无效格式 |
| 401 | 凭证失效 / 密钥错误 / 票据无效 |
| 429 | 超出访问限流 |

### 接口调用示例

#### 匿名查询（参数模式）

```bash
curl "https://api.www.eocc.top/?action=ip&addr=8.8.8.8"
# {"code":200,"data":{"ip":"8.8.8.8","country":"美国","province":null,"city":null}}
```

#### 匿名查询（REST 路径模式）

```bash
curl "https://api.www.eocc.top/api/ip/114.114.114.114"
# {"code":200,"data":{"ip":"114.114.114.114","country":"中国","province":"江苏","city":"南京"}}
```

#### IPv6 查询

```bash
curl "https://api.www.eocc.top/api/ip/2400:3200::1"
# {"code":200,"data":{"ip":"2400:3200::1","country":"中国","province":"浙江","city":"杭州"}}
```

#### 合作方换取临时票据

```bash
curl -X POST "https://api.www.eocc.top/api/ticket" \
  -H "X-Api-Token: test-partner-key-001"
# {"code":200,"data":{"ticket":"a1b2c3d4e5f6...","expire_seconds":300}}
```

#### 使用临时票据查询

```bash
curl "https://api.www.eocc.top/api/ip/8.8.8.8" \
  -H "X-Ticket: a1b2c3d4e5f6..."
# {"code":200,"data":{"ip":"8.8.8.8","country":"美国","province":null,"city":null}}
```

#### 票据重复使用（被拒绝）

```bash
curl "https://api.www.eocc.top/api/ip/1.1.1.1" \
  -H "X-Ticket: a1b2c3d4e5f6..."
# {"code":401,"message":"临时票据无效或已过期"}
```

#### 内网 IP 拒绝

```bash
curl "https://api.www.eocc.top/api/ip/192.168.1.1"
# {"code":400,"message":"内网/保留地址不允许查询"}
```

#### 无效密钥拒绝

```bash
curl -X POST "https://api.www.eocc.top/api/ticket" \
  -H "X-Api-Token: invalid-key"
# {"code":401,"message":"长期密钥无效"}
```

#### 限流触发

```bash
# 同一 IP 在 1 分钟内请求超过 60 次
# {"code":429,"message":"超出访问频率限制，请稍后再试"}
```

#### 健康检查

```bash
curl "https://api.www.eocc.top/api/health"
# {"code":200,"data":{"status":"ok"}}
```

### MMDB 文件

```
路径: /opt/1panel/apps/openresty/openresty/www/sites/api.www.eocc.top/index/data/ip/Merged-IP.mmdb
大小: 95 MB（上限 100 MB）
格式: 标准 mmdb（拒绝 xdb 私有格式）
兼容: IPv4 + IPv6
字段: 国家、省份、城市
```

### JavaScript SDK 示例

#### 匿名查询（浏览器 / Node.js）

```javascript
/**
 * 匿名查询 IP 归属（无需凭证，自动识别客户端 IP）
 * 限流：单 IP 60 次/分钟，超出返回 429
 */
async function lookupIp(ip) {
  const url = ip
    ? `https://api.www.eocc.top/api/ip/${ip}`
    : 'https://api.www.eocc.top/api/ip/';

  const res = await fetch(url);

  // 429 时等待后重试
  if (res.status === 429) {
    console.warn('触发限流，60 秒后重试');
    await new Promise(r => setTimeout(r, 60_000));
    return lookupIp(ip);
  }

  const body = await res.json();
  if (body.code !== 200) {
    throw new Error(`查询失败: ${body.message}`);
  }
  return body.data;  // { ip, country, province, city }
}

// 用法
const info = await lookupIp('8.8.8.8');
console.log(`${info.ip} → ${info.country} ${info.province || ''} ${info.city || ''}`);
```

#### 合作方完整流程（长期密钥 → 临时票据 → 查询）

```javascript
/**
 * IP 归属查询 SDK — 合作方专用
 *
 * 最佳实践：
 *   1. 票据应在服务端换取，不要在浏览器端持有长期密钥（防泄漏）
 *   2. 获取票据后立即使用，避免过期（有效期 5 分钟）
 *   3. 票据用后即焚，不要缓存或复用
 */

const API_BASE = 'https://api.www.eocc.top';
const PARTNER_KEY = 'test-partner-key-001'; // 仅在服务端使用

// 步骤①：换取临时票据（在服务端调用）
async function fetchTicket() {
  const res = await fetch(`${API_BASE}/api/ticket`, {
    method: 'POST',
    headers: { 'X-Api-Token': PARTNER_KEY },
  });
  const body = await res.json();
  if (body.code !== 200) {
    throw new Error(`换取票据失败(${body.code}): ${body.message}`);
  }
  return body.data.ticket;
}

// 步骤②：使用票据查询 IP（可下发到客户端）
async function lookupWithTicket(ip, ticket) {
  const res = await fetch(`${API_BASE}/api/ip/${ip}`, {
    headers: { 'X-Ticket': ticket },
  });
  const body = await res.json();
  if (body.code === 401) {
    throw new Error('临时票据无效或已过期（仅可调用一次，有效期 5 分钟）');
  }
  if (body.code !== 200) {
    throw new Error(`查询失败: ${body.message}`);
  }
  return body.data;
}

// ── 完整调用流程 ──
(async () => {
  const ticket = await fetchTicket();
  const info   = await lookupWithTicket('8.8.8.8', ticket);
  console.log(info);
  // { ip: "8.8.8.8", country: "美国", province: null, city: null }
})();
```

#### 通用请求封装（含错误处理 + 重试）

```javascript
/**
 * 生产环境推荐封装 — 统一处理响应 + 按状态码分类异常
 */
class IpApiClient {
  constructor(partnerKey = null) {
    this.baseUrl = 'https://api.www.eocc.top';
    this.partnerKey = partnerKey;  // null = 匿名模式
  }

  async _request(path, init = {}) {
    const headers = { ...init.headers };
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const body = await res.json();

    if (body.code === 200) return body.data;

    // 按状态码分类错误
    const errors = {
      400: '请求参数错误（IP 格式无效或内网地址不允许查询）',
      401: this.partnerKey ? '长期密钥无效或临时票据已失效' : '未授权',
      429: '超出访问频率限制，请稍后再试',
    };
    throw new Error(errors[body.code] || body.message || `HTTP ${res.status}`);
  }

  // 查询 IP
  async lookup(ip) {
    return this._request(`/api/ip/${ip}`);
  }

  // 查询客户端自身 IP
  async lookupSelf() {
    return this._request('/api/ip/');
  }

  // 换取临时票据（需 partnerKey）
  async getTicket() {
    if (!this.partnerKey) throw new Error('匿名模式无法换取票据');
    return this._request('/api/ticket', {
      method: 'POST',
      headers: { 'X-Api-Token': this.partnerKey },
    });
  }

  // 使用票据查询
  async lookupWithTicket(ip, ticket) {
    return this._request(`/api/ip/${ip}`, {
      headers: { 'X-Ticket': ticket },
    });
  }

  // 健康检查
  async health() {
    return this._request('/api/health');
  }
}

// 使用
const api = new IpApiClient();                // 匿名
const partner = new IpApiClient('your-key');  // 合作方

await api.lookup('8.8.8.8');
await partner.health();
```

### 输入校验与边界情况

API 对输入进行多层校验，了解这些边界能帮你避免无效请求。

| 输入场景 | 示例 | 返回 | 说明 |
|----------|------|------|------|
| 合法 IPv4 | `8.8.8.8` / `114.114.114.114` | `200` | 标准 IPv4 四段十进制 |
| 合法 IPv6 | `2400:3200::1` / `2001:4860:4860::8888` | `200` | 标准 IPv6 格式（支持 `::` 缩写） |
| 完整 IPv6 | `2001:0db8:0000:0042:0000:8a2e:0370:7334` | `200` | 完整八组 hex 格式 |
| IPv4-mapped IPv6 | `::ffff:8.8.8.8` | `200` | 被转换为 `8.8.8.8` 后查询 |
| 纯数字串（非 IP） | `123456789` | `400` | 不是有效 IP 格式 |
| 带前导零的 IPv4 | `8.8.8.008` | `400` | 前导零在某些解析器中视为八进制，API 拒绝 |
| 超出范围的段 | `256.1.1.1` | `400` | 每段范围 [0, 255] |
| 少于 4 段 | `1.2.3` | `400` | 必须恰好四段 |
| 多于 4 段 | `1.2.3.4.5` | `400` | 多于四段视为无效 |
| 含非数字字符 | `8.8.8.a` | `400` | 段内只能包含数字 |
| 空字符串 | `""` | `400` | 等同于"/api/ip/ "" "（无 IP 参数） |
| URL 中的空白 | `/api/ip/ 8.8.8.8 ` | `400` | URL 尾部的空格被 Flask `<path>` 捕获，需在客户端侧 trim |
| 域名（非 IP） | `/api/ip/www.google.com` | `400` | 本 API 不支持域名解析，请客户端先做 DNS 解析 |
| 私有 IPv4 | `192.168.1.1` / `10.0.0.1` | `400` | 内网安全策略拦截，不允许查询 |
| 回环 IPv4 | `127.0.0.1` / `127.0.0.2` | `400` | 整个 `127.0.0.0/8` 段均被拦截 |
| 链路本地 | `169.254.1.1` | `400` | `169.254.0.0/16` |
| 组播 IPv4 | `224.0.0.1` | `400` | `224.0.0.0/4` 组播段 |
| 受限广播 | `255.255.255.255` | `400` | 广播地址被拦截 |
| IPv6 回环 | `::1` | `400` | IPv6 回环地址 |
| IPv6 ULA | `fc00::1` / `fd00::1` | `400` | `fc00::/7` 唯一本地地址 |
| IPv6 链路本地 | `fe80::1` | `400` | `fe80::/10` 链路本地 |
| IPv6 组播 | `ff00::1` / `ff02::1` | `400` | `ff00::/8` 组播段 |
| 查询访客自身（外网） | `/api/ip/` 不传参数 | `200` | 自动使用 `REMOTE_ADDR` 或 `X-Forwarded-For` |
| 查询访客自身（本机回环）| 本地直连 `/api/ip/` | `400` | 本机请求时 `REMOTE_ADDR=127.0.0.1`，触发内网拦截 |

### 常见坑点

| 问题 | 原因 | 正确做法 |
|------|------|----------|
| **内网 IP 返回 400** | `192.168.x.x` / `10.x.x.x` / `127.x.x.x` / `fc00::` 被安全策略拦截 | 只查询公网地址；本地开发用 `curl ifconfig.me` 获取公网出口 IP 进行测试 |
| **本地访问 `127.0.0.1` 查询"访客 IP"返回 400** | 回环地址 `127.0.0.1` 本身也被内网策略拒绝 | 在外网或通过 `X-Forwarded-For` 头模拟真实客户端 IP |
| **票据请求头键名写错** | `X-Api-Token` vs `X-Ticket` 容易混淆 | 记住：Token 是**长期密钥**，Ticket 是**一次性票据**。两套头是完全不同的键 |
| **票据重复使用返回 401** | 每次 `GETDEL` 后票据立即销毁 | 一次查询换一张票据；批量查询时每条请求都要先换新票据 |
| **票据 5 分钟过期** | 换取后挂起太久才使用 | 应在查询前实时换取，不要提前缓存 |
| **匿名模式触发 429 限流** | 单个 IP 每 60 秒最多 60 次 | 高并发场景应改用合作方模式（Ticket 不限流）；或实现客户端指数退避 |
| **将长期密钥写入前端 JS** | 前端代码可被任意查看，密钥直接泄漏 | 长期密钥**只存放于服务端**，由服务端先换 Ticket 再下发给前端使用 |
| **GET 参数传密钥** | `?token=xxx` 会被 Nginx 日志、浏览器历史、中间代理记录 | 生产环境必须用请求头 `X-Api-Token`，GET 参数仅限本地调试 |
| **IPv6 地址在 URL 中需要编码** | `:` 在 URL 中是特殊字符 | curl 和浏览器会自动处理；如果用底层 HTTP 库拼接 URL，需确保 IPv6 地址不被拆分 |
| **响应中的 `province` / `city` 为 null** | MMDB 对于某些 IP 无更细粒度数据（尤其是海外 IP） | 消费端对 null 做判空处理，不要假设一定有值 |
| **跨域 (CORS) 报错** | API 未配置 CORS 响应头 | 当前 API 仅允许 `GET`+`POST` 基本方法；如有跨域需要，在后端添加 `Access-Control-Allow-Origin` 头 |
| **传入域名而非 IP** | `/api/ip/www.google.com` 格式校验失败 | 本 API 不做 DNS 解析，客户端需先用 `dns.lookup()` 获取 IP 再传入 |

### 内部设计要点

| 维度 | 实现 |
|------|------|
| **MMDB 生命周期** | 模块导入时调用 `ipdb_init()` 一次性加载（`MODE_MEMORY`），进程全生命周期复用同一个 Reader 实例，避免重复加载带来的内存开销 |
| **限流实现** | Redis Sorted Set 滑动窗口 + Lua 脚本原子操作，key 格式 `ipapi:ratelimit:<client_ip>` |
| **临时票据** | Redis `SETEX` 写入（5 分钟 TTL），使用时通过 `GETDEL` 原子核销，杜绝并发场景票据重复使用 |
| **内网拦截** | `ipaddress.ip_network()` 精确 CIDR 匹配，同时覆盖 IPv4 私网段和 IPv6 ULA/回环 |
| **服务架构** | Python Flask + gevent WSGIServer 常驻进程，非短生命周期脚本 |
| **插件接口** | 4 个 Hook 点（`on_ip_lookup` / `on_ticket_generated` / `on_health_check` / `on_debug_panel`），支持 `dispatch` 扇出和 `reduce` 链式归约两种模式，通过 JSON 配置文件或代码动态注册 |
