# 测试

## 运行方式

安装开发依赖后使用 pytest：

```bash
pip install -e '.[dev]'
pytest
```

未安装 pytest 时，本目录下的测试也可直接用标准库运行：

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

## 约定

- 测试文件命名为 `test_*.py`，与 `pyproject.toml` 中的 `python_files` 保持一致。
- 只使用标准库 `unittest` 编写断言，确保在未安装 pytest 的环境下也可执行。
- 涉及网络的用例必须跳过或打桩，不得在测试中真实请求 GitHub API。
