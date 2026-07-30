# GitAAP

> GitHub 仓库流量与信息看板 — 多 Token 调度 · 智能缓存 · 实时数据聚合

**GitAAP**（原名 GHWatch）是一个基于 FastAPI 的 GitHub 仓库监控面板，持续采集仓库的流量、发布与协作数据，把分散在多个 GitHub 页面的信息汇总到一处可读看板。

---

## ✨ 特性

| 特性 | 说明 |
|------|------|
| 📊 **仓库流量监控** | 聚合克隆、访问、星标、Fork 等流量数据 |
| 🔄 **多 Token 调度** | 同时管理多个 GitHub Token，按剩余配额自动轮换，用完自动切换 |
| 🚀 **智能缓存** | 请求结果按命名空间缓存，减少重复 API 调用 |
| 📦 **插件系统** | 支持动态加载的插件体系，可扩展弹窗、外观、验证等功能 |
| 🌐 **多语言支持** | 内置中/英/繁体中文多语言界面 |
| 🎨 **主题系统** | 多种主题色彩方案（琥珀、竹、炭、霜、薰衣草、樱花等） |
| 📈 **发布 & PR 追踪** | 自动采集 Release、Issue、Pull Request 变更 |
| ⚡ **异步架构** | 基于 FastAPI + httpx 异步请求，高效并发 |
| 🐳 **Docker 部署** | 一行 docker compose up 即可运行 |

---

## 🚀 快速开始

### 前置要求

- Docker & Docker Compose（推荐）
- 或 Python 3.12+

### Docker 部署（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/KevinCN2010/Everyone-Create.git
cd Everyone-Create

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 GitHub Token（创建地址：https://github.com/settings/tokens）
# 需要 scope: public_repo（只读公开仓库）

# 3. 启动
docker compose up -d

# 4. 访问
open http://localhost:4000
```

### 手动部署

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入配置

# 启动
uvicorn i18n.main:app --host 0.0.0.0 --port 8000
```

---

## ⚙️ 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `GITHUB_TOKEN` | ✅ | — | GitHub Personal Access Token |
| `GITHUB_TOKENS` | ❌ | — | 多 Token 模式，格式：`名字=Token,名字2=Token2` |
| `REPOS` | ❌ | 见下方 | 监控仓库列表，逗号分隔 `owner/repo` |
| `UPDATE_HOURS` | ❌ | 6 | 数据更新间隔（小时） |
| `DISABLE_TRAFFIC` | ❌ | false | 是否禁用流量采集 |
| `ADMIN_PASSWORD` | ❌ | 随机 | 管理后台登录密码 |
| `MICROSOFT_TRANSLATOR_KEY` | ❌ | — | 微软翻译 API Key（可选） |

默认监控仓库：

```
Anuken/Mindustry, Anuken/MindustryBuilds, Anuken/MindustryServerList,
TinyLake/MindustryX, way-zer/ScriptAgent4MindustryExt
```

---

## 📁 项目结构

```
gitaap/
├── backend/               # 后端核心逻辑
│   ├── app.py             # FastAPI 应用入口
│   ├── models/            # 数据模型 & 数据库
│   ├── services/          # 业务服务
│   │   ├── cache.py       # 缓存层
│   │   ├── token_manager.py  # 多 Token 调度
│   │   └── predictor.py   # 流量预测
│   └── utils/             # 工具函数
├── i18n/                  # 国际化 & 前端
│   ├── main.py            # 路由 & 请求处理
│   ├── templates/         # Jinja2 HTML 模板
│   └── static/            # 静态资源
│       ├── lang/          # 多语言 JSON
│       ├── themes/        # 主题 CSS
│       ├── plugins/       # 插件系统
│       └── icons/         # SVG 图标库
├── ipapi/                 # IP 地理位置查询（独立进程）
├── tac-config/            # TAC 部署配置
├── tests/                 # 测试
├── docker-compose.yml     # Docker 编排
├── pyproject.toml         # 项目元数据
└── requirements.txt       # Python 依赖
```

---

## 🔌 插件系统

GitAAP 内置插件架构，支持在运行时动态加载功能模块。插件通过注册表 + 清单模式管理：

```
i18n/static/plugins/
├── registry.json          # 插件注册表
├── core/                  # 核心加载器
└── available/             # 可用插件
    ├── info-popups/       # 信息弹窗
    ├── appearance-tools/  # 外观工具
    ├── captcha-verify/    # 人机验证
    ├── legal-compliance/  # 法律合规
    ├── mindustry-mods/    # Mod 信息
    ├── repo-mirror/       # 仓库镜像
    └── traffic-predict/   # 流量预测
```

---

## 🛠️ 开发

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest

# 代码检查
ruff check .
```

### 代码规范

- Python 3.12+
- Ruff 代码规范（行宽 120）
- FastAPI 异步路由
- 多语言字符串统一管理在 `i18n/static/lang/`

---

## 📄 许可证

Apache 2.0 © KevinCN2010

```
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
