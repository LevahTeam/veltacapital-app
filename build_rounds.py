#!/usr/bin/env python3
"""build_rounds.py — VeltaCapital rounds (Alpha Vantage free tier, compact)."""

import json, os, random, sys, time, urllib.request

TICKERS = ["AAPL","MSFT","NVDA","AMZN","GOOGL","KO","JNJ","PG","WMT",
           "TSLA","F","DAL","XOM","SPY","QQQ"]
WINDOW = 60
HISTORY_FRAC = 0.6
UP_THRESHOLD, DOWN_THRESHOLD = 0.05, -0.05   # looser: 100-day windows move less
REQUEST_PAUSE = 1.0
OUT_PATH = os.path.join("public","rounds.json")
API_KEY = os.environ.get("ALPHAVANTAGE_KEY","").strip()

def fetch(ticker):
    url=("https://www.alphavantage.co/query?function=TIME_SERIES_DAILY"
         f"&symbol={ticker}&outputsize=compact&apikey={API_KEY}")
    try:
        req=urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data=json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  ! {ticker}: fetch failed ({e})", file=sys.stderr); return []
    if "Note" in data or "Information" in data:
        print(f"  ! {ticker}: {data.get('Note') or data.get('Information')}", file=sys.stderr); return []
    if "Error Message" in data:
        print(f"  ! {ticker}: {data['Error Message']}", file=sys.stderr); return []
    series=data.get("Time Series (Daily)")
    if not series:
        print(f"  ! {ticker}: no time series", file=sys.stderr); return []
    rows=[]
    for d,bar in series.items():
        try:
            rows.append([d, float(bar["1. open"]), float(bar["2. high"]),
                         float(bar["3. low"]), float(bar["4. close"]),
                         float(bar["5. volume"])])
        except (KeyError, ValueError): continue
    rows.sort(key=lambda r: r[0])
    return rows

def classify(w):
    a,b=w[0][4], w[-1][4]
    if a<=0: return "choppy"
    m=(b-a)/a
    return "up" if m>=UP_THRESHOLD else "down" if m<=DOWN_THRESHOLD else "choppy"

def to_round(t,w):
    candles=[[o,h,l,c,v] for (_d,o,h,l,c,v) in w]
    return {"asset":t,"window":f"{WINDOW} sessions","candles":candles,
            "series":[c[3] for c in candles]}

def main():
    if not API_KEY:
        print("No key. export ALPHAVANTAGE_KEY=your_key_here"); sys.exit(1)
    random.seed(42)
    rounds=[]; by={"up":0,"down":0,"choppy":0}
    for t in TICKERS:
        print(f"Fetching {t} ...")
        rows=fetch(t)
        if len(rows)<WINDOW:
            print(f"  ! {t}: only {len(rows)} rows, skipping"); time.sleep(REQUEST_PAUSE); continue
        w=rows[-WINDOW:]                      # most recent 60 sessions
        reg=classify(w); by[reg]+=1
        rounds.append(to_round(t,w))
        print(f"  {t}: 1 window ({reg})")
        time.sleep(REQUEST_PAUSE)
    if not rounds:
        print("No rounds. If rate-limited, wait and rerun.", file=sys.stderr); sys.exit(1)
    random.shuffle(rounds)
    payload={"history_frac":HISTORY_FRAC,"source":"real market data",
             "timeframe":"1D","rounds":rounds}
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH,"w") as f: json.dump(payload,f)
    print(f"\nWrote {len(rounds)} rounds to {OUT_PATH}")
    print(f"  regime mix: up={by['up']}  down={by['down']}  choppy={by['choppy']}")

if __name__=="__main__":
    main()
