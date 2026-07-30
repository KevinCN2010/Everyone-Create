# GitAAP

> <img src="../assets/readme-svg/globe.svg" width="18" height="18" alt=""> GitHub API 聚合代理 — 多 Token 排程 · 智慧快取 · 即時資料聚合

---

> <img src="../assets/readme-svg/robot.svg" width="18" height="18" alt=""> **AI 輔助開發聲明**：本專案由 AI 輔助生成，可能存在考慮不周或疏漏之處。如果你發現任何問題或有最佳化建議，歡迎提交 [Issue](https://github.com/KevinCN2010/Everyone-Create/issues) 或 [Pull Request](https://github.com/KevinCN2010/Everyone-Create/pulls) 指點斧正。每一份反饋都是讓這個專案變得更好的動力 <img src="../assets/readme-svg/thanks.svg" width="16" height="16" alt="">

---

## <img src="../assets/readme-svg/book.svg" width="18" height="18" alt=""> 專案簡介

GitAAP 是一個開源的 API 聚合代理服務，專注於 GitHub 倉庫資料的採集與視覺化。它透過多 Token 排程、智慧快取層和插件化架構，將分散在多個頁面的倉庫資訊整合到一處統一面板。

## <img src="../assets/readme-svg/sparkles.svg" width="18" height="18" alt=""> 功能特色

|  | 功能 | 說明 |
|--|------|------|
| <img src="../assets/readme-svg/chart.svg" width="18" height="18" alt=""> | **倉庫資料聚合** | 自動採集倉庫流量、發佈、Issue、PR 等資料，集中展示 |
| <img src="../assets/readme-svg/sync.svg" width="18" height="18" alt=""> | **多 Token 排程** | 同時管理多個存取令牌，按剩餘配額自動輪換，用完無縫切換 |
| <img src="../assets/readme-svg/rocket.svg" width="18" height="18" alt=""> | **智慧快取** | 請求結果按命名空間快取，減少重複呼叫，提升回應速度 |
| <img src="../assets/readme-svg/plugin.svg" width="18" height="18" alt=""> | **插件體系** | 運行時動態載入的功能模組，支援彈窗、外觀、驗證等擴展 |
| <img src="../assets/readme-svg/globe.svg" width="18" height="18" alt=""> | **多語言介面** | 內建簡體中文、繁體中文、英文，自動適配 |
| <img src="../assets/readme-svg/palette.svg" width="18" height="18" alt=""> | **主題系統** | 12 套色彩方案（琥珀、竹、炭、霜、薰衣草、櫻花等） |
| <img src="../assets/readme-svg/lightning.svg" width="18" height="18" alt=""> | **全非同步架構** | 基於 FastAPI + httpx，高效並發處理 |
| <img src="../assets/readme-svg/whale.svg" width="18" height="18" alt=""> | **容器化部署** | Docker Compose 編排，一條命令啟動 |

## <img src="../assets/readme-svg/rocket.svg" width="18" height="18" alt=""> 部署方式

### 方式一：Docker Compose（推薦）

```bash
git clone <repo-url>
cd Everyone-Create
cp .env.example .env
# 編輯 .env 填入 Token 與倉庫列表
docker compose up -d
# 訪問 http://localhost:4000
```

### 方式二：手動部署

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn i18n.main:app --host 0.0.0.0 --port 8000 --reload
```

## <img src="../assets/readme-svg/gear.svg" width="18" height="18" alt=""> 環境變數

| 變數 | 必需 | 預設值 | 說明 |
|------|------|--------|------|
| `GITHUB_TOKEN` | 是 | — | 存取令牌 |
| `GITHUB_TOKENS` | 否 | — | 多令牌模式，`名稱=Token,名稱2=Token2` |
| `REPOS` | 否 | 見下 | 監控倉庫，`owner/repo` 逗號分隔 |
| `UPDATE_HOURS` | 否 | `6` | 更新間隔（小時） |
| `ADMIN_PASSWORD` | 否 | 隨機 | 管理後臺密碼 |

## <img src="../assets/readme-svg/folder.svg" width="18" height="18" alt=""> 專案結構

```
gitaap/
├── backend/               # 後端核心
│   ├── app.py             # FastAPI 應用入口
│   ├── models/            # 資料庫模型
│   ├── services/
│   │   ├── cache.py          # 智慧快取
│   │   ├── token_manager.py  # 多 Token 排程器
│   │   └── predictor.py      # 流量預測
│   └── utils/             # 工具函式
├── i18n/                  # 國際化 & 前端
│   ├── main.py            # 路由 & 請求處理
│   ├── templates/         # Jinja2 HTML 模板
│   └── static/
│       ├── lang/          # 多語言 JSON
│       ├── themes/        # 12 套主題 CSS
│       ├── plugins/       # 插件系統
│       └── icons/         # SVG 圖示庫
├── ipapi/                 # IP 歸屬地查詢（獨立程序）
├── tests/                 # 測試案例
├── docker-compose.yml     # Docker 編排
├── pyproject.toml         # 專案元資料
└── requirements.txt       # Python 依賴
```

## <img src="../assets/readme-svg/plugin.svg" width="18" height="18" alt=""> 插件系統

```
i18n/static/plugins/
├── registry.json         # 插件註冊索引
├── core/                 # 載入器核心
│   ├── loader.js
│   └── manager.js
└── available/            # 預置插件
    ├── info-popups/          # 資訊彈窗
    ├── appearance-tools/     # 外觀設定
    ├── captcha-verify/       # 人機驗證
    ├── legal-compliance/     # 法律合規提示
    ├── repo-mirror/          # 倉庫鏡像
    └── traffic-predict/      # 流量預測
```

## <img src="../assets/readme-svg/tools.svg" width="18" height="18" alt=""> 開發

```bash
pip install -e ".[dev]"
pytest
ruff check .
ruff format .
```

## <img src="../assets/readme-svg/page.svg" width="18" height="18" alt=""> 許可證

[Apache 2.0](LICENSE) © KevinCN2010
