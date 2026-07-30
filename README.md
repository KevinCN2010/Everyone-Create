# GitAAP

> GitHub 仓库流量与信息看板 — 多 Token 调度 · 智能缓存 · 实时数据聚合

GitAAP 是一个基于 FastAPI 的 GitHub 仓库监控面板，持续采集仓库的流量、发布与协作数据，把分散在多个 GitHub 页面的信息汇总到一处可读看板。

---

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 📊 **仓库流量监控** | 聚合克隆、访问、星标、Fork 等流量数据，趋势一目了然 |
| 🔄 **多 Token 调度系统** | 同时管理多个 GitHub Token，按剩余配额自动轮换，用完无缝切换 |
| 📈 **发布与协作追踪** | 自动采集 Release、Issue、Pull Request 变更，版本迭代不遗漏 |
| 🚀 **智能缓存层** | 请求结果按命名空间缓存，减少重复 API 调用，响应速度提升 |
| 🔌 **插件架构** | 运行时动态加载的功能模块体系，可扩展弹窗、外观、验证、法律合规等 |
| 🌐 **多语言界面** | 内置中文、英文、繁体中文，自动适配 |
| 🎨 **丰富主题** | 12 套色彩方案（琥珀、竹、炭、霜、森林、薰衣草、樱花、海洋等） |
| ⚡ **全异步架构** | 基于 FastAPI + httpx 异步请求，高效并发处理 |
| 🐳 **一键部署** | Docker Compose 编排，一条命令启动 |

---

## 🚀 部署指南

### 方式一：Docker Compose 部署（推荐）

适用于生产环境，自动处理依赖与运行环境。

```bash
# 1. 克隆仓库
git clone https://github.com/KevinCN2010/Everyone-Create.git
cd Everyone-Create

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入以下内容：
#   GITHUB_TOKEN=你的GitHub Personal Access Token
#   REPOS=要监控的仓库列表（owner/repo，逗号分隔）
#
# Token 创建地址：https://github.com/settings/tokens
# 所需 scope：public_repo（公开仓库只读）

# 3. 启动服务
docker compose up -d

# 4. 访问面板
# 浏览器打开 http://localhost:4000
```

**查看日志：**
```bash
docker compose logs -f
```

**停止服务：**
```bash
docker compose down
```

### 方式二：手动部署（开发环境）

适用于本地开发调试。

```bash
# 1. 克隆仓库
git clone https://github.com/KevinCN2010/Everyone-Create.git
cd Everyone-Create

# 2. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Linux / macOS
# 或 venv\Scripts\activate  # Windows

# 3. 安装依赖
pip install -r requirements.txt

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 填入配置

# 5. 启动开发服务器
uvicorn i18n.main:app --host 0.0.0.0 --port 8000 --reload
```

### 方式三：Docker 手动构建

```bash
# 构建镜像
docker build -t gitaap .

# 运行容器
docker run -d \
  --name gitaap \
  -p 4000:8000 \
  --env-file .env \
  -v ./data:/app/data \
  gitaap
```

---

## ⚙️ 环境变量参考

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `GITHUB_TOKEN` | 是 | — | GitHub Personal Access Token |
| `GITHUB_TOKENS` | 否 | — | 多 Token 模式，格式：`名字=Token,名字2=Token2` |
| `REPOS` | 否 | 见下方 | 监控仓库列表，逗号分隔 `owner/repo` |
| `UPDATE_HOURS` | 否 | `6` | 数据更新间隔（小时） |
| `DISABLE_TRAFFIC` | 否 | `false` | 是否禁用流量采集 |
| `ADMIN_PASSWORD` | 否 | 随机生成 | 管理后台登录密码 |
| `MICROSOFT_TRANSLATOR_KEY` | 否 | — | 微软翻译 API Key（可选） |

**默认监控仓库：**

```
Anuken/Mindustry, Anuken/MindustryBuilds, Anuken/MindustryServerList,
TinyLake/MindustryX, way-zer/ScriptAgent4MindustryExt
```

---

## 📁 项目结构

```
gitaap/
├── backend/                  # 后端核心
│   ├── app.py                # FastAPI 应用入口
│   ├── models/               # 数据库模型
│   ├── services/             # 业务服务
│   │   ├── cache.py          # 缓存层（命名空间隔离）
│   │   ├── token_manager.py  # 多 Token 调度器
│   │   └── predictor.py      # 流量趋势预测
│   └── utils/                # 工具函数
├── i18n/                     # 国际化 & 前端
│   ├── main.py               # 路由 & 请求处理
│   ├── templates/            # Jinja2 HTML 模板
│   └── static/               # 静态资源
│       ├── lang/             # 多语言 JSON（中/英/繁）
│       ├── themes/           # 12 套主题 CSS
│       ├── plugins/          # 插件系统
│       └── icons/            # SVG 图标库
├── ipapi/                    # IP 归属地查询（独立进程）
├── tac-config/               # TAC 部署配置
├── tests/                    # 测试用例
├── docker-compose.yml        # Docker 编排文件
├── pyproject.toml            # 项目元数据
└── requirements.txt          # Python 依赖清单
```

---

## 🔌 插件体系

GitAAP 内置插件加载器，支持在运行态动态注册功能模块。

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
    ├── mindustry-mods/       # Mod 信息展示
    ├── repo-mirror/          # 仓库镜像
    └── traffic-predict/      # 流量预测
```

---

## 🛠️ 开发者指南

### 环境准备

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest

# 代码检查
ruff check .

# 代码格式化
ruff format .
```

### 代码规范

- **语言**：Python 3.12+
- **框架**：FastAPI（异步路由）
- **代码风格**：Ruff 规范，行宽 120
- **前端**：原生 JavaScript + Jinja2 模板
- **多语言**：统一维护在 `i18n/static/lang/` 目录

### 添加新语言

1. 在 `i18n/static/lang/` 下新建 `{语言代码}.json`
2. 参考 `zh.json` 的键值结构翻译对应文案
3. 在 `i18n/static/function.js` 的语言列表中注册

### 创建插件

参考 `i18n/static/plugins/available/` 下的现有插件结构：

```
my-plugin/
├── manifest.json   # 插件元数据（名称、版本、依赖）
└── plugin.js       # 插件逻辑（CSS 可选）
```

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
