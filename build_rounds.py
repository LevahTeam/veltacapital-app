#!/usr/bin/env python3
"""Build an auditable historical exercise dataset from Alpha Vantage."""

import json
import os
import random
import sys
import time
import urllib.parse
import urllib.request

TICKERS = [
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "KO", "JNJ", "PG",
    "WMT", "TSLA", "F", "DAL", "XOM", "SPY", "QQQ",
]
WINDOW = 60
HISTORY_FRAC = 0.6
UP_THRESHOLD = 0.05
DOWN_THRESHOLD = -0.05
REQUEST_PAUSE = 1.0
OUT_PATH = os.path.join("public", "rounds.json")
API_KEY = os.environ.get("ALPHAVANTAGE_KEY", "").strip()


def api_url(ticker):
    query = urllib.parse.urlencode({
        "function": "TIME_SERIES_DAILY",
        "symbol": ticker,
        "outputsize": "compact",
        "apikey": API_KEY,
    })
    return f"https://www.alphavantage.co/query?{query}"


def warn(ticker, message):
    print(f"  ! {ticker}: {message}", file=sys.stderr)


def fetch(ticker):
    request = urllib.request.Request(
        api_url(ticker), headers={"User-Agent": "Mozilla/5.0"}
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as error:  # network and provider errors share one skip path
        warn(ticker, f"fetch failed ({error})")
        return []

    provider_notice = data.get("Note") or data.get("Information")
    if provider_notice:
        warn(ticker, provider_notice)
        return []
    if "Error Message" in data:
        warn(ticker, data["Error Message"])
        return []

    series = data.get("Time Series (Daily)")
    if not series:
        warn(ticker, "no time series")
        return []

    rows = []
    for date, bar in series.items():
        try:
            rows.append([
                date,
                float(bar["1. open"]),
                float(bar["2. high"]),
                float(bar["3. low"]),
                float(bar["4. close"]),
                float(bar["5. volume"]),
            ])
        except (KeyError, ValueError):
            continue
    return sorted(rows, key=lambda row: row[0])


def classify(window):
    first_close, last_close = window[0][4], window[-1][4]
    if first_close <= 0:
        return "choppy"
    change = (last_close - first_close) / first_close
    if change >= UP_THRESHOLD:
        return "up"
    if change <= DOWN_THRESHOLD:
        return "down"
    return "choppy"


def to_round(ticker, window):
    candles = [[open_, high, low, close, volume]
               for _, open_, high, low, close, volume in window]
    split_index = max(0, int(len(window) * HISTORY_FRAC) - 1)
    return {
        "asset": ticker,
        "window": f"{WINDOW} sessions",
        "candles": candles,
        "series": [candle[3] for candle in candles],
        "dates": [row[0] for row in window],
        "startDate": window[0][0],
        "splitDate": window[split_index][0],
        "endDate": window[-1][0],
    }


def build_payload(rounds):
    return {
        "history_frac": HISTORY_FRAC,
        "source": "Historical daily OHLCV data; unadjusted Alpha Vantage TIME_SERIES_DAILY export",
        "provider": "Alpha Vantage",
        "timeframe": "1D",
        "adjusted": False,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "selectionMethod": (
            f"For each listed ticker, use the most recent {WINDOW} available daily sessions, "
            "then shuffle with random seed 42. No windows are selected based on later performance."
        ),
        "limitations": (
            "Unadjusted data may contain apparent gaps around splits or distributions. "
            "The fixed ticker list and recent-window selection are not representative samples "
            "of all securities or market regimes."
        ),
        "rounds": rounds,
    }


def main():
    if not API_KEY:
        print("No key. export ALPHAVANTAGE_KEY=your_key_here")
        return 1

    random.seed(42)
    rounds = []
    regimes = {"up": 0, "down": 0, "choppy": 0}
    for ticker in TICKERS:
        print(f"Fetching {ticker} ...")
        rows = fetch(ticker)
        if len(rows) < WINDOW:
            print(f"  ! {ticker}: only {len(rows)} rows, skipping")
        else:
            window = rows[-WINDOW:]
            regime = classify(window)
            regimes[regime] += 1
            rounds.append(to_round(ticker, window))
            print(f"  {ticker}: 1 window ({regime})")
        time.sleep(REQUEST_PAUSE)

    if not rounds:
        print("No rounds. If rate-limited, wait and rerun.", file=sys.stderr)
        return 1

    random.shuffle(rounds)
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as output:
        json.dump(build_payload(rounds), output)

    print(f"\nWrote {len(rounds)} rounds to {OUT_PATH}")
    print(
        f"  regime mix: up={regimes['up']}  down={regimes['down']}  "
        f"choppy={regimes['choppy']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
