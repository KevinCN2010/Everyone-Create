# GitAAP

> GitHub API 聚合代理 — 多 Token 调度 · 智能缓存 · 实时数据聚合

---

## 📖 项目简介

GitAAP 是一个开源的 API 聚合代理服务，专注于 GitHub 仓库数据的采集与可视化。它通过多 Token 调度、智能缓存层和插件化架构，将分散在多个页面的仓库信息整合到一处统一面板。

## ✨ 功能特性

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

## 🚀 部署方式

### 方式一：Docker Compose（推荐）

```bash
git clone <repo-url>
cd Everyone-Create
cp .env.example .env
# 编辑 .env 填入 Token 与仓库列表
docker compose up -d
# 访问 http://localhost:4000
```

### 方式二：手动部署

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn i18n.main:app --host 0.0.0.0 --port 8000 --reload
```

## ⚙️ 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `GITHUB_TOKEN` | 是 | — | 访问令牌 |
| `GITHUB_TOKENS` | 否 | — | 多令牌模式，`名称=Token,名称2=Token2` |
| `REPOS` | 否 | 见下 | 监控仓库，`owner/repo` 逗号分隔 |
| `UPDATE_HOURS` | 否 | `6` | 更新间隔（小时） |
| `ADMIN_PASSWORD` | 否 | 随机 | 管理后台密码 |

## 📁 项目结构

```
gitaap/
├── backend/               # 后端核心
│   ├── app.py             # FastAPI 应用入口
│   ├── models/            # 数据库模型
│   ├── services/
│   │   ├── cache.py          # 智能缓存
│   │   ├── token_manager.py  # 多 Token 调度器
│   │   └── predictor.py      # 流量预测
│   └── utils/             # 工具函数
├── i18n/                  # 国际化 & 前端
│   ├── main.py            # 路由 & 请求处理
│   ├── templates/         # Jinja2 HTML 模板
│   └── static/
│       ├── lang/          # 多语言 JSON
│       ├── themes/        # 12 套主题 CSS
│       ├── plugins/       # 插件系统
│       └── icons/         # SVG 图标库
├── ipapi/                 # IP 归属地查询（独立进程）
├── tests/                 # 测试用例
├── docker-compose.yml     # Docker 编排
├── pyproject.toml         # 项目元数据
└── requirements.txt       # Python 依赖
```

## 🔌 插件系统

```
i18n/static/plugins/
├── registry.json         # 插件注册索引
├── core/                 # 加载器核心
│   ├── loader.js
│   └── manager.js
└── available/            # 预置插件
    ├── info-popups/          # 信息弹窗
    ├── appearance-tools/     # 外观设置
    ├── captcha-verify/       # 人机验证
    ├── legal-compliance/     # 法律合规提示
    ├── repo-mirror/          # 仓库镜像
    └── traffic-predict/      # 流量预测
```

## 🛠️ 开发

```bash
pip install -e ".[dev]"
pytest
ruff check .
ruff format .
```

## 📄 许可证

[Apache 2.0](LICENSE) © KevinCN2010
