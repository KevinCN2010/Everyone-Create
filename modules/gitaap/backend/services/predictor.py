"""
深度学习流量预测模块 —— 纯 Python 自实现神经网络
=================================================
从零构建全连接神经网络 + 反向传播，无任何 ML 库依赖。
用于预测 GitHub 仓库未来 clones / views 流量趋势。

架构:
  - NeuralNet: 可配置层数的全连接网络 (ReLU + 自适应学习率)
  - TimeSeriesPredictor: 时序滑动窗口特征工程 + 训练 + 预测
  - 模型权重序列化为 JSON 文件持久化
"""

import math
import json
import os
import random
import hashlib
import threading
import time
from datetime import datetime, timedelta, timezone
from collections import deque

# ──────────────────────────────────────────────
#  神经网络核心（纯 NumPy-Free 实现）
# ──────────────────────────────────────────────

def _sigmoid(x):
    if x < -710:
        return 0.0
    if x > 710:
        return 1.0
    return 1.0 / (1.0 + math.exp(-x))


def _relu(x):
    return max(0.0, x)


def _d_relu(x):
    return 1.0 if x > 0.0 else 0.0


def _d_sigmoid(y):
    return y * (1.0 - y)


def _init_weight(fan_in, fan_out):
    """Xavier 初始化（更稳定，适合小型网络）"""
    std = math.sqrt(2.0 / max(fan_in + fan_out, 1))
    return [random.gauss(0.0, std) for _ in range(fan_in * fan_out)]


def _init_bias(fan_out):
    return [0.0 for _ in range(fan_out)]


def _clip_grad(grad, max_norm=1.0):
    """梯度裁剪：限制 L2 范数不超过 max_norm"""
    norm = math.sqrt(sum(g * g for g in grad))
    if norm > max_norm:
        scale = max_norm / max(norm, 1e-8)
        return [g * scale for g in grad]
    return list(grad)


def _dot(a, b, n):
    s = 0.0
    for i in range(n):
        s += a[i] * b[i]
    return s


def _add_to(dst, src, n):
    for i in range(n):
        dst[i] += src[i]


class DenseLayer:
    """全连接层"""

    def __init__(self, fan_in, fan_out, activation="relu"):
        self.fan_in = fan_in
        self.fan_out = fan_out
        self.activation = activation
        self.w = _init_weight(fan_in, fan_out)
        self.b = _init_bias(fan_out)
        # 缓存用于反向传播
        self._input = None
        self._z = None
        self._a = None  # 激活输出

    def forward(self, x):
        """x: list[float] 长度 fan_in; 返回 list[float] 长度 fan_out"""
        self._input = list(x)
        z = [self.b[j] + _dot(x, self.w[j * self.fan_in:(j + 1) * self.fan_in], self.fan_in)
             for j in range(self.fan_out)]
        self._z = z
        if self.activation == "relu":
            a = [_relu(zj) for zj in z]
        elif self.activation == "sigmoid":
            a = [_sigmoid(zj) for zj in z]
        else:
            a = list(z)  # linear
        self._a = a
        return a

    def backward(self, grad_output, lr):
        """grad_output: list[float] 长度 fan_out; 返回 grad_input 长度 fan_in"""
        fan_in = self.fan_in
        fan_out = self.fan_out
        x = self._input

        # 计算 delta
        if self.activation == "relu":
            delta = [grad_output[j] * _d_relu(self._z[j]) for j in range(fan_out)]
        elif self.activation == "sigmoid":
            delta = [grad_output[j] * _d_sigmoid(self._a[j]) for j in range(fan_out)]
        else:
            delta = list(grad_output)

        # 1) 先计算输入梯度（使用更新前的权重）
        grad_input = [0.0] * fan_in
        for i in range(fan_in):
            for j in range(fan_out):
                grad_input[i] += delta[j] * self.w[j * fan_in + i]

        # 2) 再更新权重（使用更新前权重计算的 delta 和 x）
        for j in range(fan_out):
            for i in range(fan_in):
                self.w[j * fan_in + i] -= lr * delta[j] * x[i]
            self.b[j] -= lr * delta[j]

        return grad_input

    def save(self):
        return {
            "fan_in": self.fan_in,
            "fan_out": self.fan_out,
            "activation": self.activation,
            "w": self.w,
            "b": self.b,
        }

    @staticmethod
    def load(data):
        layer = DenseLayer(data["fan_in"], data["fan_out"], data["activation"])
        layer.w = data["w"]
        layer.b = data["b"]
        return layer


class NeuralNet:
    """多层全连接神经网络"""

    def __init__(self, layer_sizes, activations=None):
        """
        layer_sizes: [input_dim, hidden1, hidden2, ..., output_dim]
        activations: 每层激活函数，默认全部 relu, 输出层 linear
        """
        self.layers = []
        n = len(layer_sizes)
        for i in range(n - 1):
            act = activations[i] if activations and i < len(activations) else "relu"
            self.layers.append(DenseLayer(layer_sizes[i], layer_sizes[i + 1], act))
        self.loss_history = []

    def forward(self, x):
        for layer in self.layers:
            x = layer.forward(x)
        return x

    def predict(self, x):
        """推理（不缓存中间变量）"""
        for layer in self.layers:
            if layer.activation == "relu":
                z = [layer.b[j] + _dot(x, layer.w[j * layer.fan_in:(j + 1) * layer.fan_in], layer.fan_in)
                     for j in range(layer.fan_out)]
                x = [_relu(zj) for zj in z]
            elif layer.activation == "sigmoid":
                z = [layer.b[j] + _dot(x, layer.w[j * layer.fan_in:(j + 1) * layer.fan_in], layer.fan_in)
                     for j in range(layer.fan_out)]
                x = [_sigmoid(zj) for zj in z]
            else:
                x = [layer.b[j] + _dot(x, layer.w[j * layer.fan_in:(j + 1) * layer.fan_in], layer.fan_in)
                     for j in range(layer.fan_out)]
        return x

    def _mse_loss(self, pred, target):
        n = len(pred)
        return sum((pred[i] - target[i]) ** 2 for i in range(n)) / n

    def train(self, X, Y, epochs=200, lr=0.01, batch_size=1, verbose=True, early_stop_patience=30):
        """
        X: list[list[float]] 输入
        Y: list[list[float]] 目标

        使用 SGD（batch_size 固定为 1），通过 layer.backward() 链式反向传播。
        支持早停：若 patience 轮内 loss 无改善则提前终止。
        """
        n = len(X)
        self.loss_history = []
        param_count = sum(l.fan_in * l.fan_out + l.fan_out for l in self.layers)
        if verbose:
            print(f"  [训练] 网络参数量: {param_count}, 学习率: {lr}, 早停 patience={early_stop_patience}")
        best_loss = float('inf')
        best_weights = None
        stall_count = 0

        for epoch in range(epochs):
            # 学习率余弦衰减
            lr_decayed = lr * (0.5 + 0.5 * math.cos(math.pi * epoch / epochs))
            # 打乱数据
            indices = list(range(n))
            random.shuffle(indices)
            total_loss = 0.0

            for idx in indices:
                pred = self.forward(X[idx])
                loss_val = self._mse_loss(pred, Y[idx])
                total_loss += loss_val

                # 输出层梯度: d(L)/d(y) = 2*(y - y_true)/n
                grad = [2.0 * (pred[j] - Y[idx][j]) / max(len(Y[idx]), 1) for j in range(len(Y[idx]))]

                # 链式反向传播
                for layer in reversed(self.layers):
                    grad = layer.backward(grad, lr_decayed)

            avg_loss = total_loss / n
            self.loss_history.append(avg_loss)

            # 早停检测
            if avg_loss < best_loss - 1e-7:
                best_loss = avg_loss
                best_weights = [list(l.w) + list(l.b) for l in self.layers]
                stall_count = 0
            else:
                stall_count += 1
                if stall_count >= early_stop_patience:
                    # 恢复到最佳权重
                    if best_weights:
                        for l_idx, layer in enumerate(self.layers):
                            wb = best_weights[l_idx]
                            layer.w = wb[:len(layer.w)]
                            layer.b = wb[len(layer.w):]
                    if verbose:
                        print(f"  [训练] 早停 epoch {epoch + 1}, best_loss={best_loss:.6f}")
                    return self.loss_history

            if verbose and (epoch + 1) % 20 == 0:
                print(f"  [训练] epoch {epoch + 1}/{epochs}, loss={avg_loss:.6f}")

        return self.loss_history

    def save(self, path):
        data = {
            "layers": [layer.save() for layer in self.layers],
            "loss_history": self.loss_history,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        return True

    @staticmethod
    def load(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        net = NeuralNet.__new__(NeuralNet)
        net.layers = [DenseLayer.load(ld) for ld in data["layers"]]
        net.loss_history = data.get("loss_history", [])
        return net


# ──────────────────────────────────────────────
#  时序预测器
# ──────────────────────────────────────────────

class TimeSeriesPredictor:
    """
    基于滑动窗口的流量预测器

    将原始 (date, value) 时序转换为监督学习样本:
      特征: [v(t-1), v(t-2), ..., v(t-window), day_of_week_sin, day_of_week_cos]
      目标: v(t)

    输出未来 N 天的预测值。对 clones 和 views 分别训练独立的模型。
    """

    MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")

    def __init__(self, repo, metric="clones", window=7, hidden_size=None):
        """
        repo: 仓库名 (owner/name)
        metric: "clones" 或 "views"
        window: 滑动窗口大小（用过去几天预测下一天）
        hidden_size: 隐藏层大小，None 则根据数据样本数自适应
        """
        self.repo = repo
        self.metric = metric
        self.window = window
        self.hidden_size = hidden_size or 0  # 0 表示自适应
        self.net = None
        self._x_scaler = None  # (min, max)
        self._y_scaler = None
        self._trained = False
        os.makedirs(self.MODEL_DIR, exist_ok=True)

    @property
    def _model_path(self):
        model_id = hashlib.sha256(f"{self.repo}\0{self.metric}".encode("utf-8")).hexdigest()[:20]
        return os.path.join(self.MODEL_DIR, f"model_{model_id}.json")

    # ── 数据预处理 ──

    @staticmethod
    def _day_of_week_features(dt):
        """返回 [sin(2pi*dow/7), cos(2pi*dow/7)] 周期性编码"""
        dow = dt.weekday()
        return [math.sin(2.0 * math.pi * dow / 7.0), math.cos(2.0 * math.pi * dow / 7.0)]

    @staticmethod
    def _minmax_scale(values):
        mn = min(values)
        mx = max(values)
        if mx == mn:
            return [0.5] * len(values), (mn, mx)
        return [(v - mn) / (mx - mn) for v in values], (mn, mx)

    @staticmethod
    def _minmax_inv(scaled, scaler):
        mn, mx = scaler
        if mx == mn:
            return mn
        return scaled * (mx - mn) + mn

    def _series_to_samples(self, values, dates):
        """
        从时间序列构造监督学习样本。
        values: 原始值列表（按日期升序）
        dates: 对应的 date 对象列表
        返回 (X, Y), 其中 X 每个样本 = [v(t-1)..v(t-window) 归一化 + dow_sin + dow_cos]
        """
        n = len(values)
        if n < self.window + 1:
            return [], []

        # 归一化
        scaled, self._x_scaler = self._minmax_scale(values)
        y_vals = list(values)
        _, self._y_scaler = self._minmax_scale(y_vals)

        X, Y = [], []
        for t in range(self.window, n):
            # 使用归一化后的过去 window 天的值
            feat = [scaled[t - i] for i in range(self.window, 0, -1)]
            # 添加周期性特征
            dow_feat = self._day_of_week_features(dates[t])
            feat.extend(dow_feat)
            X.append(feat)
            # 目标：归一化的当天值
            y_scaled = (y_vals[t] - self._y_scaler[0]) / (self._y_scaler[1] - self._y_scaler[0]) \
                if self._y_scaler[1] != self._y_scaler[0] else 0.5
            Y.append([y_scaled])

        return X, Y

    # ── 数据源 ──

    def _load_from_db(self, days=180):
        """从 SQLite 加载流量数据"""
        try:
            from backend.models.db import SessionLocal, Traffic
            db = SessionLocal()
            try:
                from sqlalchemy import func
                from datetime import date as date_type
                cutoff = datetime.now(timezone.utc).date() - timedelta(days=days)
                rows = db.query(Traffic.date, Traffic.clones, Traffic.views).filter(
                    Traffic.repo == self.repo,
                    Traffic.date >= cutoff
                ).order_by(Traffic.date).all()
                values = [getattr(r, self.metric) for r in rows]
                dates = [r.date for r in rows]
                return values, dates
            finally:
                db.close()
        except Exception as e:
            print(f"[predictor] 从数据库加载失败: {e}")
            return [], []

    # ── 训练 ──

    def train(self, days=180, epochs=300, lr=0.05, verbose=True):
        """从数据库加载数据并训练神经网络"""
        values, dates = self._load_from_db(days)

        if len(values) < self.window + 2:
            raise ValueError(f"真实流量数据不足：至少需要 {self.window + 2} 条，当前 {len(values)} 条")

        X, Y = self._series_to_samples(values, dates)
        if not X:
            raise ValueError("样本为空，无法训练")

        input_dim = len(X[0])
        n_samples = len(X)

        # 自适应隐藏层大小: 样本越多, 网络越大; 确保不超过 128
        if self.hidden_size == 0:
            suggested = max(8, min(64, int(math.sqrt(n_samples * input_dim) * 0.8)))
            self.hidden_size = max(8, min(64, suggested + 4 - suggested % 4))  # 4 的倍数
        h1 = self.hidden_size
        h2 = max(max(h1 // 2, 4), min(4, int(math.sqrt(n_samples) * 0.3)))

        print(f"[predictor] 训练样本数: {n_samples}, 特征维度: {input_dim}, 隐藏层: {h1}/{h2}")
        print(f"[predictor] 网络架构: {input_dim} -> {h1} -> {h2} -> 1")

        self.net = NeuralNet(
            layer_sizes=[input_dim, h1, h2, 1],
            activations=["relu", "relu", "linear"]
        )

        self.net.train(X, Y, epochs=epochs, lr=lr, batch_size=4, verbose=verbose, early_stop_patience=30)
        self._trained = True

        # 自动保存
        self.save()
        return self.loss_history()

    # ── 预测 ──

    def predict(self, steps=14):
        """递归预测未来 steps 天的流量

        使用"滚动预测"策略：将最新可用数据作为窗口，预测下一天，
        然后将预测值加入窗口，继续预测下一天。
        """
        if not self._trained and not self.load():
            raise RuntimeError("模型未训练且无保存的权重，请先调用 train()")

        # 加载最近 window 天的数据作为起始窗口
        values, dates = self._load_from_db(self.window + 7)
        if len(values) < self.window:
            raise ValueError(f"真实流量数据不足：需要至少 {self.window} 条历史记录，当前 {len(values)} 条")

        # 取最近 window 条数据
        hist_values = values[-self.window:]
        hist_dates = dates[-self.window:]
        last_date = hist_dates[-1]

        # 预测必须复用训练时的尺度，否则网络输入和输出会落入不同坐标系。
        if self._x_scaler is None or self._y_scaler is None:
            raise RuntimeError("模型缺少归一化参数，请重新训练")

        scaled_hist = [(v - self._x_scaler[0]) / (self._x_scaler[1] - self._x_scaler[0])
                       if self._x_scaler[1] != self._x_scaler[0] else 0.5
                       for v in hist_values]

        predictions = []
        current_window = deque(scaled_hist, maxlen=self.window)

        for step in range(steps):
            pred_date = last_date + timedelta(days=step + 1)
            dow_feat = self._day_of_week_features(pred_date)
            feat = list(current_window) + dow_feat
            y_scaled = self.net.predict(feat)[0]
            y_val = int(round(self._minmax_inv(y_scaled, self._y_scaler)))
            y_val = max(0, y_val)
            predictions.append({"date": str(pred_date), "value": y_val})
            x_min, x_max = self._x_scaler
            next_scaled = (y_val - x_min) / (x_max - x_min) if x_max != x_min else 0.5
            current_window.append(next_scaled)

        return predictions

    def predict_with_history(self, future_steps=14):
        """返回历史值 + 预测值（用于前端绘图）"""
        values, dates = self._load_from_db(days=180)
        history = [{"date": str(dates[i]), "value": values[i]} for i in range(len(values))]
        future = self.predict(steps=future_steps)
        return {
            "repo": self.repo,
            "metric": self.metric,
            "history": history,
            "prediction": future,
            "trained": self._trained,
            "window": self.window,
        }

    # ── 持久化（单文件 JSON 嵌入权重） ──

    def _serialize_net(self):
        """将神经网络序列化为可 JSON 的 dict"""
        if self.net is None:
            return None
        return {
            "layers": [layer.save() for layer in self.net.layers],
            "loss_history": self.net.loss_history,
        }

    def _deserialize_net(self, data):
        """从 dict 恢复神经网络"""
        import sys
        net = NeuralNet.__new__(NeuralNet)
        net.layers = [DenseLayer.load(ld) for ld in data["layers"]]
        net.loss_history = data.get("loss_history", [])
        return net

    def save(self):
        if self.net is None:
            return False
        packed = {
            "version": 1,
            "repo": self.repo,
            "metric": self.metric,
            "window": self.window,
            "hidden_size": self.hidden_size,
            "x_scaler": self._x_scaler,
            "y_scaler": self._y_scaler,
            "trained": self._trained,
            "net": self._serialize_net(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        tmp_path = f"{self._model_path}.{os.getpid()}.{threading.get_ident()}.tmp"
        try:
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(packed, f)
            os.replace(tmp_path, self._model_path)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        return True

    def load(self):
        if not os.path.exists(self._model_path):
            return False
        try:
            with open(self._model_path, "r", encoding="utf-8") as f:
                packed = json.load(f)
            if (packed.get("version") != 1 or packed.get("repo") != self.repo
                    or packed.get("metric") != self.metric or not packed.get("trained")):
                return False
            self.window = packed.get("window", self.window)
            self.hidden_size = packed.get("hidden_size", self.hidden_size)
            self._x_scaler = tuple(packed["x_scaler"]) if packed.get("x_scaler") else None
            self._y_scaler = tuple(packed["y_scaler"]) if packed.get("y_scaler") else None
            self._trained = packed.get("trained", False)
            net_data = packed.get("net")
            if net_data:
                self.net = self._deserialize_net(net_data)
            if (self._x_scaler is None or self._y_scaler is None or not self.net
                    or not self.net.layers or self.net.layers[0].fan_in != self.window + 2
                    or self.net.layers[-1].fan_out != 1):
                self.net = None
                self._trained = False
                return False
            return True
        except Exception as e:
            print(f"[predictor] 加载模型失败: {e}")
            return False

    def loss_history(self):
        return self.net.loss_history if self.net else []


# ──────────────────────────────────────────────
#  预测引擎接口（供 main.py 调用）
# ──────────────────────────────────────────────

# 预测器缓存（避免重复训练）
_predictor_cache = {}
_cache_lock = threading.Lock()
_predictor_locks = {}
_training_lock = threading.Semaphore(1)


def predict_traffic(repo, metric="clones", steps=14, force_retrain=False):
    """
    顶层预测接口：获取或创建预测器 → 确保已训练 → 返回预测结果

    Args:
        repo: "owner/name"
        metric: "clones" | "views"
        steps: 预测未来天数
        force_retrain: 强制重新训练
    Returns:
        dict 包含 history + prediction
    """
    cache_key = f"{repo}:{metric}"
    with _cache_lock:
        predictor_lock = _predictor_locks.setdefault(cache_key, threading.Lock())

    with predictor_lock:
        with _cache_lock:
            predictor = _predictor_cache.get(cache_key)

        if predictor is None or force_retrain:
            predictor = TimeSeriesPredictor(repo, metric=metric)
            if not predictor.load() or force_retrain:
                print(f"[predict] {repo} {metric}: 开始训练...")
                t0 = time.time()
                try:
                    with _training_lock:
                        predictor.train(verbose=True)
                    print(f"[predict] 训练完成 ({time.time() - t0:.1f}s)")
                except Exception as e:
                    print(f"[predict] 训练失败: {e}")
                    return {"error": str(e), "repo": repo, "metric": metric}
            with _cache_lock:
                _predictor_cache[cache_key] = predictor

        try:
            return predictor.predict_with_history(future_steps=steps)
        except Exception as e:
            return {"error": str(e), "repo": repo, "metric": metric}


def get_prediction_loss(repo, metric="clones"):
    """返回训练 loss 曲线"""
    cache_key = f"{repo}:{metric}"
    with _cache_lock:
        predictor = _predictor_cache.get(cache_key)
    if predictor and predictor.net:
        return predictor.loss_history()
    return []
