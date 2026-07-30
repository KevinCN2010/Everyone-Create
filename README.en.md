# GitAAP

> GitHub API Aggregation Proxy — Multi-Token Scheduling · Smart Caching · Real-Time Data Aggregation

---

## 📖 Introduction

GitAAP is an open-source API aggregation proxy service focused on GitHub repository data collection and visualization. It uses multi-token scheduling, a smart caching layer, and a plugin-based architecture to consolidate repository information from multiple pages into a unified dashboard.

## ✨ Features

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

## 🚀 Deployment

### Option 1: Docker Compose (Recommended)

```bash
git clone <repo-url>
cd Everyone-Create
cp .env.example .env
# Edit .env with your token and repo list
docker compose up -d
# Visit http://localhost:4000
```

### Option 2: Manual Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn i18n.main:app --host 0.0.0.0 --port 8000 --reload
```

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | Yes | — | Access token |
| `GITHUB_TOKENS` | No | — | Multi-token mode: `name=Token,name2=Token2` |
| `REPOS` | No | see below | Repos to watch, `owner/repo` comma-separated |
| `UPDATE_HOURS` | No | `6` | Update interval (hours) |
| `ADMIN_PASSWORD` | No | random | Admin panel password |

## 📁 Project Structure

```
gitaap/
├── backend/               # Core backend
│   ├── app.py             # FastAPI app entry
│   ├── models/            # Database models
│   ├── services/
│   │   ├── cache.py          # Smart cache layer
│   │   ├── token_manager.py  # Multi-token scheduler
│   │   └── predictor.py      # Traffic prediction
│   └── utils/             # Utility functions
├── i18n/                  # Internationalization & Frontend
│   ├── main.py            # Routes & request handlers
│   ├── templates/         # Jinja2 HTML templates
│   └── static/
│       ├── lang/          # Language JSON files
│       ├── themes/        # 12 color theme CSS
│       ├── plugins/       # Plugin system
│       └── icons/         # SVG icon library
├── ipapi/                 # IP geolocation (standalone process)
├── tests/                 # Test cases
├── docker-compose.yml     # Docker orchestration
├── pyproject.toml         # Project metadata
└── requirements.txt       # Python dependencies
```

## 🔌 Plugin System

```
i18n/static/plugins/
├── registry.json         # Plugin registry index
├── core/                 # Loader core
│   ├── loader.js
│   └── manager.js
└── available/            # Built-in plugins
    ├── info-popups/          # Information popups
    ├── appearance-tools/     # Appearance settings
    ├── captcha-verify/       # CAPTCHA verification
    ├── legal-compliance/     # Legal compliance notices
    ├── repo-mirror/          # Repository mirror
    └── traffic-predict/      # Traffic prediction
```

## 🛠️ Development

```bash
pip install -e ".[dev]"
pytest
ruff check .
ruff format .
```

## 📄 License

Apache 2.0 © KevinCN2010
