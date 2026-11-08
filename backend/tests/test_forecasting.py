"""Forecast backtest (AUDIT L8). Deterministic synthetic sales; rolling origin, 7-day horizon, WAPE."""
import math
import random
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from services.forecasting import _calculate_forecast_from_txns, forecast_from_history

WEEK = [0.9, 0.85, 0.9, 1.0, 1.3, 1.35, 0.7]  # Mon..Sun, weekend peak like a neighbourhood grocery
DAYS = 120


def _poisson(rng, lam):
    limit, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p < limit:
            return k
        k += 1


def _dataset():
    rng = random.Random(42)
    out = []
    for kind in ("fast", "medium", "slow", "fast_trend", "medium_trend", "medium_shock"):
        for _ in range(10):
            base = {"fast": rng.uniform(15, 40), "medium": rng.uniform(4, 12), "slow": rng.uniform(0.3, 1.5)}[
                kind.split("_")[0]]
            s = []
            for d in range(DAYS):
                lam = base * WEEK[d % 7] * (1 + 0.006 * d if kind.endswith("trend") else 1)
                lam *= 1.8 if kind.endswith("shock") and 60 <= d < 75 else 1  # Ramadan / promo
                s.append(_poisson(rng, lam))
            out.append(s)
    return out


def _wape(predict):
    err = act = 0.0
    for s in _dataset():
        for origin in range(30, DAYS - 7, 7):
            pred = predict(s[origin - 30:origin], (origin - 30) % 7)
            fut = s[origin:origin + 7]
            err += sum(abs(p - a) for p, a in zip(pred, fut))
            act += sum(fut)
    return err / act


def test_beats_naive_baselines():
    model = _wape(lambda h, wd: forecast_from_history(h, wd, 7)[0])
    naive_mean = _wape(lambda h, wd: [sum(h[-7:]) / 7] * 7)
    seasonal_naive = _wape(lambda h, wd: h[-7:])
    assert model < 0.21, model
    assert model < 0.85 * naive_mean and model < seasonal_naive


def test_cold_start_ignores_leading_zeros():
    s = _dataset()[0]
    demand, _ = forecast_from_history([0] * 20 + s[50:60], (50 - 20) % 7, 7)
    actual = sum(s[60:67])
    assert abs(sum(demand) - actual) / actual < 0.35


def test_no_sales_means_zero_and_no_crash():
    assert forecast_from_history([0] * 30, 0, 7) == ([0.0] * 7, {})


def test_trend_is_bounded():
    demand, _ = forecast_from_history([0] * 23 + [1, 2, 4, 8, 16, 32, 64], 0, 7)
    assert max(demand) < 64 * 2


def test_output_shape_from_transactions():
    now = datetime(2026, 11, 9, 12, tzinfo=timezone.utc)
    txns = [SimpleNamespace(created_at=now - timedelta(days=d), quantity=3) for d in range(1, 29)]
    out = _calculate_forecast_from_txns(txns, now, days_ahead=7)
    assert len(out) == 7 and out[0]["date"] == (now + timedelta(days=1)).date()
    assert all(o["lower"] <= o["demand"] <= o["upper"] for o in out)
    assert 2.5 < out[0]["demand"] < 3.5
