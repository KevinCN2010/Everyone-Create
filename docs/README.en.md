# GitAAP

> <img src="../assets/readme-svg/globe.svg" width="18" height="18" alt=""> GitHub API Aggregation Proxy — Multi-Token Scheduling · Smart Caching · Real-Time Data Aggregation

---

> <img src="../assets/readme-svg/robot.svg" width="18" height="18" alt=""> **AI-Assisted Development Notice**: This project was developed with AI assistance. There may be oversights or areas for improvement. If you spot any issues or have suggestions, please feel free to open an [Issue](https://github.com/KevinCN2010/Everyone-Create/issues) or [Pull Request](https://github.com/KevinCN2010/Everyone-Create/pulls). Every piece of feedback helps make this project better <img src="../assets/readme-svg/thanks.svg" width="16" height="16" alt="">

---

## <img src="../assets/readme-svg/book.svg" width="18" height="18" alt=""> Introduction

GitAAP is an open-source API aggregation proxy service focused on GitHub repository data collection and visualization. It uses multi-token scheduling, a smart caching layer, and a plugin-based architecture to consolidate repository information from multiple pages into a unified dashboard.

## <img src="../assets/readme-svg/sparkles.svg" width="18" height="18" alt=""> Features

|  | Feature | Description |
|--|---------|-------------|
| <img src="../assets/readme-svg/chart.svg" width="18" height="18" alt=""> | **Repo Data Aggregation** | Automatically collect traffic, releases, issues, PRs — all in one place |
| <img src="../assets/readme-svg/sync.svg" width="18" height="18" alt=""> | **Multi-Token Scheduling** | Manage multiple tokens, auto-rotate by remaining quota, seamless fallback |
| <img src="../assets/readme-svg/rocket.svg" width="18" height="18" alt=""> | **Smart Caching** | Namespace-based cache layer reduces redundant API calls |
| <img src="../assets/readme-svg/plugin.svg" width="18" height="18" alt=""> | **Plugin System** | Runtime-loadable modules for popups, themes, captcha, compliance |
| <img src="../assets/readme-svg/globe.svg" width="18" height="18" alt=""> | **Multi-Language UI** | Built-in Simplified Chinese, Traditional Chinese, English |
| <img src="../assets/readme-svg/palette.svg" width="18" height="18" alt=""> | **Theme System** | 12 color schemes (Amber, Bamboo, Charcoal, Frost, Lavender, Sakura, etc.) |
| <img src="../assets/readme-svg/lightning.svg" width="18" height="18" alt=""> | **Async Architecture** | Built on FastAPI + httpx for high-concurrency performance |
| <img src="../assets/readme-svg/whale.svg" width="18" height="18" alt=""> | **Containerized** | Single-command Docker Compose deployment |

## <img src="../assets/readme-svg/rocket.svg" width="18" height="18" alt=""> Deployment

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

## <img src="../assets/readme-svg/gear.svg" width="18" height="18" alt=""> Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | Yes | — | Access token |
| `GITHUB_TOKENS` | No | — | Multi-token mode: `name=Token,name2=Token2` |
| `REPOS` | No | see below | Repos to watch, `owner/repo` comma-separated |
| `UPDATE_HOURS` | No | `6` | Update interval (hours) |
| `ADMIN_PASSWORD` | No | random | Admin panel password |

## <img src="../assets/readme-svg/folder.svg" width="18" height="18" alt=""> Project Structure

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

## <img src="../assets/readme-svg/plugin.svg" width="18" height="18" alt=""> Plugin System

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

## <img src="../assets/readme-svg/tools.svg" width="18" height="18" alt=""> Development

```bash
pip install -e ".[dev]"
pytest
ruff check .
ruff format .
```

## <img src="../assets/readme-svg/page.svg" width="18" height="18" alt=""> License

[Apache 2.0](LICENSE) © KevinCN2010
