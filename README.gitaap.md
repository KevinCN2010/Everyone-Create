# GitAAP

<p align="left">
  <img src="assets/readme-svg/globe.svg" width="20" height="20" alt="">&nbsp;
  <b>GitHub API Aggregation Proxy</b> — 多 Token 调度 · 智能缓存 · 实时数据聚合
</p>

---

> <img src="assets/readme-svg/robot.svg" width="18" height="18" alt=""> 本项目由 AI 辅助开发，可能存在考虑不周或疏漏之处。欢迎各路大佬提交 [Issue](https://github.com/KevinCN2010/Everyone-Create/issues) 或 [Pull Request](https://github.com/KevinCN2010/Everyone-Create/pulls) 指点斧正，共同完善。
>
> <img src="assets/readme-svg/robot.svg" width="18" height="18" alt=""> This project was developed with AI assistance. There may be oversights or rough edges. All suggestions and contributions are warmly welcome — feel free to open an [Issue](https://github.com/KevinCN2010/Everyone-Create/issues) or [Pull Request](https://github.com/KevinCN2010/Everyone-Create/pulls).

---

## <img src="assets/readme-svg/globe.svg" width="20" height="20" alt=""> 选择语言 / Select Language / 選擇語言

|  |  |  |
|--|--|--|
| <img src="assets/readme-svg/flag-zhcn.svg" width="18" height="18" alt=""> | [**简体中文**](docs/README.zh-CN.md) | 项目介绍、部署指南、开发文档 |
| <img src="assets/readme-svg/flag-zhtw.svg" width="18" height="18" alt=""> | [**繁體中文**](docs/README.zh-TW.md) | 專案介紹、部署指南、開發文檔 |
| <img src="assets/readme-svg/flag-en.svg" width="18" height="18" alt=""> | [**English**](docs/README.en.md) | Introduction, Deployment, Development |

---

### <img src="assets/readme-svg/book.svg" width="18" height="18" alt=""> 快速导航 / Quick Links

|  | 链接 | 说明 |
|--|------|------|
| <img src="assets/readme-svg/book.svg" width="16" height="16" alt=""> | [项目文档（简体中文）](docs/README.zh-CN.md) | 完整功能特性、部署方式、环境变量 |
| <img src="assets/readme-svg/book.svg" width="16" height="16" alt=""> | [Project Docs (English)](docs/README.en.md) | Full features, deployment options, env vars |
| <img src="assets/readme-svg/book.svg" width="16" height="16" alt=""> | [專案文件（繁體中文）](docs/README.zh-TW.md) | 完整功能特色、部署方式、環境變數 |
| <img src="assets/readme-svg/whale.svg" width="16" height="16" alt=""> | [docker-compose.yml](docker-compose.yml) | Docker Compose 编排文件 |
| <img src="assets/readme-svg/package.svg" width="16" height="16" alt=""> | [pyproject.toml](pyproject.toml) | 项目元数据与依赖 |

---

## <img src="assets/readme-svg/gear.svg" width="18" height="18" alt=""> 环境要求 / Requirements / 環境需求

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| **Python** | ≥ 3.12 | 运行时环境 |
| **pip** | ≥ 24.0 | Python 包管理器 |
| **Docker** | ≥ 24.0（可选） | 容器化部署方式需要 |
| **Docker Compose** | ≥ 2.24（可选） | 编排部署需要 |

### Python 依赖清单

```
fastapi>=0.104.0      # Web 框架
uvicorn[standard]>=0.24.0  # ASGI 服务器
sqlalchemy>=2.0.0     # ORM 数据库
jinja2>=3.1.0         # 模板引擎
requests>=2.31.0      # HTTP 客户端
httpx>=0.25.0         # 异步 HTTP 客户端
apscheduler>=3.10.0   # 定时任务调度
```

### 开发环境额外依赖

```bash
# 安装全部开发依赖
pip install -e ".[dev]"

# 验证环境
python --version     # 需要 ≥ 3.12
pip --version        # 需要 ≥ 24.0
pytest --version     # 测试框架（dev 依赖）
ruff --version       # 代码检查（dev 依赖）
```

---

## <img src="assets/readme-svg/page.svg" width="18" height="18" alt=""> License / 许可证 / 許可證

[Apache 2.0](LICENSE) © KevinCN2010
