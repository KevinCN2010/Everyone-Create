"""项目结构与配置的健全性检查。

只使用标准库，确保在未安装 pytest 的环境下也能通过
`python3 -m unittest discover -s tests` 运行。
"""

import json
import tomllib
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
LANG_DIR = PROJECT_ROOT / "i18n" / "static" / "lang"


class TestProjectLayout(unittest.TestCase):
    def test_backend_models_contains_only_code(self):
        """业务数据不应混在 backend/models/ 代码目录中。"""
        stray = sorted(
            p.name
            for p in (PROJECT_ROOT / "backend" / "models").iterdir()
            if p.is_file() and p.suffix == ".json"
        )
        self.assertEqual(stray, [], f"发现残留数据文件: {stray}")

    def test_compose_mounts_directories_not_individual_files(self):
        """模板与静态资源应整目录挂载，避免新增文件时漏配。"""
        compose = (PROJECT_ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        self.assertIn("./i18n/templates:/app/app/templates", compose)
        self.assertIn("./i18n/static:/app/app/static", compose)
        self.assertNotIn("/app/app/templates/index.html", compose)

    def test_pyproject_is_valid_and_matches_requirements(self):
        """pyproject.toml 可解析，且依赖与 requirements.txt 一致。"""
        with (PROJECT_ROOT / "pyproject.toml").open("rb") as fh:
            config = tomllib.load(fh)

        declared = {
            dep.split(">=")[0].split("[")[0].strip()
            for dep in config["project"]["dependencies"]
        }
        pinned = {
            line.split(">=")[0].split("[")[0].strip()
            for line in (PROJECT_ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")
        }
        self.assertEqual(declared, pinned)


class TestLanguagePacks(unittest.TestCase):
    def test_language_packs_share_identical_keys(self):
        """三种语言的词条键必须完全一致，避免界面回退到键名。"""
        packs = {
            path.stem: json.loads(path.read_text(encoding="utf-8"))
            for path in sorted(LANG_DIR.glob("*.json"))
        }
        self.assertEqual(set(packs), {"en", "zh", "zh-Hant"})

        baseline = set(packs["zh"])
        for name, pack in packs.items():
            self.assertEqual(set(pack), baseline, f"{name}.json 词条键与 zh.json 不一致")

    def test_no_empty_translations(self):
        for path in sorted(LANG_DIR.glob("*.json")):
            pack = json.loads(path.read_text(encoding="utf-8"))
            blank = sorted(k for k, v in pack.items() if not str(v).strip())
            self.assertEqual(blank, [], f"{path.name} 存在空翻译: {blank}")


if __name__ == "__main__":
    unittest.main()
