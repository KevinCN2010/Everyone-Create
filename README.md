# GitAAP

> **Git**Hub **A**PI **A**ggregation **P**roxy — 多 Token 调度 · 智能缓存 · 实时数据聚合
> **Git**Hub **A**PI **A**ggregation **P**roxy — 多 Token 排程 · 智慧快取 · 即時資料聚合
> **Git**Hub **A**PI **A**ggregation **P**roxy — Multi-Token Scheduling · Smart Caching · Real-Time Data Aggregation

---

<!-- ============ 简体中文 ============ -->

## 🇨🇳 简体中文

### 📖 项目简介

GitAAP 是一个开源的 API 聚合代理服务，专注于 GitHub 仓库数据的采集与可视化。它通过多 Token 调度、智能缓存层和插件化架构，将分散在多个页面的仓库信息整合到一处统一面板。

### ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 📊 **仓库数据聚合** | 自动采集仓库流量、发布、Issue、PR 等数据，集中展示 |
| 🔄 **多 Token 调度** | 同时管理多个访问令牌，按剩余配额自动轮换，用完无缝切换 |
| 🚀 **智能缓存** | 请求结果按命名空间缓存，减少重复调用，提升响应速度 |
| 🔌 **插件体系** | 运行时动态加载的功能模块，支持弹窗、外观、验证等扩展 |
| 🌐 **多语言界面** | 内置简体中文、繁体中文、英文，自动适配 |
| 🎨 **主题系统** | 12 套色彩方案（琥珀、竹、炭、霜、薰衣草、樱花等） |
| ⚡ **全异步架构** | 基于 FastAPI + httpx，高效并发处理 |
| 🐳 **容器化部署** | Docker Compose 编排，一条命令启动 |

### 🚀 部署方式

#### 方式一：Docker Compose（推荐）

```bash
git clone <repo-url>
cd Everyone-Create
cp .env.example .env
# 编辑 .env 填入 Token 与仓库列表
docker compose up -d
# 访问 http://localhost:4000
```

#### 方式二：手动部署

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn i18n.main:app --host 0.0.0.0 --port 8000 --reload
```

### ⚙️ 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `GITHUB_TOKEN` | 是 | — | 访问令牌 |
| `GITHUB_TOKENS` | 否 | — | 多令牌模式，`名称=Token,名称2=Token2` |
| `REPOS` | 否 | 见下 | 监控仓库，`owner/repo` 逗号分隔 |
| `UPDATE_HOURS` | 否 | `6` | 更新间隔（小时） |
| `ADMIN_PASSWORD` | 否 | 随机 | 管理后台密码 |

---

<!-- ============ 繁體中文 ============ -->

## 🇭🇰 繁體中文

### 📖 專案簡介

GitAAP 是一個開源的 API 聚合代理服務，專注於 GitHub 倉庫資料的採集與視覺化。它透過多 Token 排程、智慧快取層和插件化架構，將分散在多個頁面的倉庫資訊整合到一處統一面板。

### ✨ 功能特色

| 功能 | 說明 |
|------|------|
| 📊 **倉庫資料聚合** | 自動採集倉庫流量、發佈、Issue、PR 等資料，集中展示 |
| 🔄 **多 Token 排程** | 同時管理多個存取令牌，按剩餘配額自動輪換，用完無縫切換 |
| 🚀 **智慧快取** | 請求結果按命名空間快取，減少重複呼叫，提升回應速度 |
| 🔌 **插件體系** | 運行時動態載入的功能模組，支援彈窗、外觀、驗證等擴展 |
| 🌐 **多語言介面** | 內建簡體中文、繁體中文、英文，自動適配 |
| 🎨 **主題系統** | 12 套色彩方案（琥珀、竹、炭、霜、薰衣草、櫻花等） |
| ⚡ **全非同步架構** | 基於 FastAPI + httpx，高效並發處理 |
| 🐳 **容器化部署** | Docker Compose 編排，一條命令啟動 |

### 🚀 部署方式

#### 方式一：Docker Compose（推薦）

```bash
git clone <repo-url>
cd Everyone-Create
cp .env.example .env
# 編輯 .env 填入 Token 與倉庫列表
docker compose up -d
# 訪問 http://localhost:4000
```

#### 方式二：手動部署

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn i18n.main:app --host 0.0.0.0 --port 8000 --reload
```

### ⚙️ 環境變數

| 變數 | 必需 | 預設值 | 說明 |
|------|------|--------|------|
| `GITHUB_TOKEN` | 是 | — | 存取令牌 |
| `GITHUB_TOKENS` | 否 | — | 多令牌模式，`名稱=Token,名稱2=Token2` |
| `REPOS` | 否 | 見下 | 監控倉庫，`owner/repo` 逗號分隔 |
| `UPDATE_HOURS` | 否 | `6` | 更新間隔（小時） |
| `ADMIN_PASSWORD` | 否 | 隨機 | 管理後臺密碼 |

---

<!-- ============ English ============ -->

## 🇬🇧 English

### 📖 Introduction

GitAAP is an open-source API aggregation proxy service focused on GitHub repository data collection and visualization. It uses multi-token scheduling, a smart caching layer, and a plugin-based architecture to consolidate repository information from multiple pages into a unified dashboard.

### ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Repo Data Aggregation** | Automatically collect traffic, releases, issues, PRs — all in one place |
| 🔄 **Multi-Token Scheduling** | Manage multiple tokens, auto-rotate by remaining quota, seamless fallback |
| 🚀 **Smart Caching** | Namespace-based cache layer reduces redundant API calls |
| 🔌 **Plugin System** | Runtime-loadable modules for popups, themes, captcha, compliance |
| 🌐 **Multi-Language UI** | Built-in Simplified Chinese, Traditional Chinese, English |
| 🎨 **Theme System** | 12 color schemes (Amber, Bamboo, Charcoal, Frost, Lavender, Sakura, etc.) |
| ⚡ **Async Architecture** | Built on FastAPI + httpx for high-concurrency performance |
| 🐳 **Containerized** | Single-command Docker Compose deployment |

### 🚀 Deployment

#### Option 1: Docker Compose (Recommended)

```bash
git clone <repo-url>
cd Everyone-Create
cp .env.example .env
# Edit .env with your token and repo list
docker compose up -d
# Visit http://localhost:4000
```

#### Option 2: Manual Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn i18n.main:app --host 0.0.0.0 --port 8000 --reload
```

### ⚙️ Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | Yes | — | Access token |
| `GITHUB_TOKENS` | No | — | Multi-token mode: `name=Token,name2=Token2` |
| `REPOS` | No | see below | Repos to watch, `owner/repo` comma-separated |
| `UPDATE_HOURS` | No | `6` | Update interval (hours) |
| `ADMIN_PASSWORD` | No | random | Admin panel password |

---

<!-- ============ 公共部分 ============ -->

## 📁 Project Structure / 项目结构 / 專案結構

```
gitaap/
├── backend/               # Core backend / 后端核心
│   ├── app.py
│   ├── services/
│   │   ├── cache.py          # Smart cache / 智能缓存
│   │   ├── token_manager.py  # Multi-token scheduler
│   │   └── predictor.py      # Traffic prediction
│   └── utils/
├── i18n/                  # Internationalization / 国际化
│   ├── main.py            # Routes & handlers
│   ├── templates/         # Jinja2 HTML
│   └── static/
│       ├── lang/          # Language files / 语言文件
│       ├── themes/        # 12 color themes
│       ├── plugins/       # Plugin system
│       └── icons/
├── ipapi/                 # IP geolocation service (standalone)
├── tests/
├── docker-compose.yml
└── pyproject.toml
```

## 🔌 Plugin System / 插件系统 / 插件系統

```
i18n/static/plugins/
├── registry.json
├── core/                 # Loader core
└── available/
    ├── info-popups/          # Info popups / 信息弹窗
    ├── appearance-tools/     # Appearance / 外观设置
    ├── captcha-verify/       # CAPTCHA / 人机验证
    ├── legal-compliance/     # Legal notices / 法律合规
    ├── repo-mirror/          # Repo mirror / 仓库镜像
    └── traffic-predict/      # Traffic prediction / 流量预测
```

## 🛠️ Development / 开发 / 開發

```bash
pip install -e ".[dev]"
pytest
ruff check .
```

## 📄 License / 许可证 / 許可證

Apache 2.0 © KevinCN2010
