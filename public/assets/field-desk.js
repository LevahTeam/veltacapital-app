(function exposeFieldDesk(root, createApi) {
  const fieldApi = createApi();
  if (typeof module === "object" && module.exports) {
    module.exports = fieldApi;
  }
  root.VeltaField = fieldApi;
})(typeof globalThis === "undefined" ? this : globalThis, function createFieldDesk() {
  "use strict";

  /* ---------- Illustrative teaching data and pure rules ---------- */

  const CANDLE = Object.freeze({
    high: 116,
    low: 94,
    step: 0.5,
    start: Object.freeze({ open: 100, close: 110, volume: 480 }),
    pastVolumes: Object.freeze([420, 360, 510, 300]),
    volume: Object.freeze({ min: 100, max: 900, step: 10 }),
  });

  const FRAMES = Object.freeze({ short: 20, long: 120 });

  const BREAK = Object.freeze({
    level: 100,
    base: Object.freeze([
      [90.0, 91.2, 89.4, 90.8], [90.8, 92.1, 90.2, 91.6], [91.6, 92.0, 90.6, 91.0],
      [91.0, 92.8, 90.8, 92.4], [92.4, 93.6, 92.0, 93.2], [93.2, 94.1, 92.4, 92.8],
      [92.8, 94.6, 92.6, 94.2], [94.2, 95.6, 93.8, 95.2], [95.2, 95.8, 94.2, 94.6],
      [94.6, 96.4, 94.4, 96.0], [96.0, 97.4, 95.6, 97.0], [97.0, 98.2, 96.6, 97.8],
    ]),
    steps: Object.freeze([
      [97.8, 99.4, 97.4, 99.0], [99.0, 102.2, 98.8, 101.6], [101.6, 103.0, 101.0, 102.2],
      [102.2, 102.6, 100.2, 100.6], [100.6, 101.0, 97.6, 98.0], [98.0, 98.6, 96.4, 96.8],
    ]),
  });

  const CASES = Object.freeze([
    {
      candles: [
        [98.4, 99.6, 97.8, 99.2], [99.2, 100.8, 98.6, 100.4], [100.4, 101.2, 99.4, 99.8],
        [99.8, 102.0, 99.6, 101.6], [101.6, 103.4, 101.2, 102.9], [102.9, 103.2, 101.4, 101.9],
        [101.9, 104.8, 101.6, 104.2], [104.2, 107.4, 103.8, 106.85],
      ],
      marks: [
        { id: "prev", index: 6, label: "desk.mark.prev" },
        { id: "final", index: 7, label: "desk.mark.final" },
      ],
      emptySlots: 0,
    },
    {
      candles: [
        [50.4, 51.2, 49.8, 50.9], [50.9, 52.0, 50.6, 51.7], [51.7, 52.4, 51.0, 51.3],
        [51.3, 53.1, 51.2, 52.8], [52.8, 54.0, 52.4, 53.6], [53.6, 54.2, 52.8, 53.1],
        [53.1, 55.4, 53.0, 55.0], [55.0, 56.9, 54.6, 56.4], [56.4, 58.9, 56.1, 58.6],
      ],
      marks: [
        { id: "first", index: 0, label: "desk.mark.first" },
        { id: "last", index: 8, label: "desk.mark.last" },
      ],
      emptySlots: 0,
    },
    {
      candles: [
        [72.0, 73.4, 70.8, 73.0], [73.0, 74.6, 72.2, 72.6], [72.6, 75.0, 71.8, 74.6],
        [74.6, 76.2, 73.6, 74.2], [74.2, 76.8, 73.0, 76.4], [76.4, 77.4, 75.0, 75.6],
        [75.6, 78.4, 74.6, 78.0],
      ],
      marks: [{ id: "latest", index: 6, label: "desk.mark.latest" }],
      emptySlots: 4,
    },
  ]);

  function clampToStep(value, low, high, step) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return low;
    const snapped = Number((Math.round(parsed / step) * step).toFixed(4));
    return Math.min(high, Math.max(low, snapped));
  }

  function candleDirection(open, close) {
    if (close > open) return "up";
    if (close < open) return "down";
    return "flat";
  }

  // One fixed series: both windows read from this array, so only the viewport changes.
  function frameCloses() {
    const closes = [];
    let drift = 0;
    let seed = 41;
    for (let session = 0; session < FRAMES.long; session += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      drift = drift * 0.82 + (seed / 2147483648 - 0.5) * 1.5;
      const trend = 78 + session * 0.42;
      const swing = 4.2 * Math.sin(session / 8.5) + 2.1 * Math.sin(session / 3.3);
      const recentFall = session >= 100 ? (session - 100) * 1.34 : 0;
      closes.push(Number((trend + swing + drift - recentFall).toFixed(2)));
    }
    return closes;
  }

  function frameRange(closes, frame) {
    const size = FRAMES[frame];
    const start = closes.length - size;
    const visible = closes.slice(start);
    const first = visible[0];
    const last = visible[visible.length - 1];
    return {
      start,
      end: closes.length - 1,
      first,
      last,
      min: Math.min(...visible),
      max: Math.max(...visible),
      changePct: ((last - first) / first) * 100,
    };
  }

  function breakCandles(step) {
    return [...BREAK.base, ...BREAK.steps.slice(0, step)];
  }

  function breakEvents() {
    const crossing = BREAK.steps.findIndex((candle) => candle[3] > BREAK.level);
    const returned = BREAK.steps.findIndex((candle, index) => index > crossing && candle[3] < BREAK.level);
    return { crossing, returned };
  }

  function breakStatus(step) {
    if (step === 0) return "paused";
    const { crossing, returned } = breakEvents();
    const index = step - 1;
    if (index < crossing) return "approach";
    if (index === crossing) return "crossed";
    if (index < returned - 1) return "above";
    if (index === returned - 1) return "fading";
    if (index === returned) return "returned";
    return "settled";
  }

  /* ---------- DOM helpers ---------- */

  const SVG_NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs = {}, parent, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) {
      node.setAttribute(name, value);
    }
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  function htmlEl(tag, className, parent, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  function reducedMotion() {
    return matchMedia("(prefers-reduced-motion:reduce)").matches;
  }

  // Phones get narrower drawing coordinates so chart labels stay readable.
  function isCompact() {
    return matchMedia("(max-width:720px)").matches;
  }

  function linear(domainLow, domainHigh, rangeLow, rangeHigh) {
    return (value) =>
      rangeLow + ((value - domainLow) / (domainHigh - domainLow)) * (rangeHigh - rangeLow);
  }

  function chartSvg(viewWidth, viewHeight, label, className, parent) {
    return svgEl(
      "svg",
      { viewBox: `0 0 ${viewWidth} ${viewHeight}`, role: "img", "aria-label": label, class: className },
      parent
    );
  }

  function drawCandle(group, candle, x, y, width, className = "") {
    const [open, high, low, close] = candle;
    const direction = candleDirection(open, close) === "down" ? "down" : "up";
    const node = svgEl("g", { class: `cd cd-${direction} ${className}`.trim() }, group);
    svgEl("line", { class: "cd-wick", x1: x, x2: x, y1: y(high), y2: y(low) }, node);
    const top = Math.min(y(open), y(close));
    svgEl("rect", {
      class: "cd-body",
      x: x - width / 2,
      y: top,
      width,
      height: Math.max(1.5, Math.abs(y(open) - y(close))),
    }, node);
    return node;
  }

  function pencilArrow(group, fromX, fromY, toX, toY) {
    const midX = (fromX + toX) / 2 + 8;
    const midY = (fromY + toY) / 2 - 6;
    svgEl("path", {
      class: "pencil",
      pathLength: 1,
      d: `M${fromX} ${fromY} Q${midX} ${midY} ${toX} ${toY}`,
    }, group);
    const angle = Math.atan2(toY - midY, toX - midX);
    const barb = (spread) =>
      `L${toX - 9 * Math.cos(angle + spread)} ${toY - 9 * Math.sin(angle + spread)}`;
    svgEl("path", {
      class: "pencil",
      pathLength: 1,
      d: `M${toX} ${toY} ${barb(0.5)} M${toX} ${toY} ${barb(-0.5)}`,
    }, group);
  }

  function formatPrice(value) {
    return value.toFixed(2);
  }

  /* ---------- Hero chart fragment ---------- */

  const HERO_CANDLES = [
    [100.0, 101.1, 99.2, 100.8], [100.8, 102.4, 100.4, 102.0], [102.0, 102.6, 100.6, 101.1],
    [101.1, 103.0, 100.9, 102.7], [102.7, 104.2, 102.2, 103.8], [103.8, 104.0, 102.1, 102.5],
    [102.5, 103.4, 101.2, 101.6], [101.6, 103.8, 101.4, 103.4], [103.4, 105.6, 103.0, 105.2],
    [105.2, 105.9, 103.6, 104.1], [104.1, 106.2, 103.9, 105.8], [105.8, 107.6, 105.4, 107.1],
  ];

  function mountHeroFragment(host, t) {
    host.replaceChildren();
    let day = HERO_CANDLES.length - 1;
    const width = 360;
    const height = 138;
    const svg = chartSvg(width, height, t("hero.fragmentLabel"), "fragment-chart", host);
    const y = linear(98.6, 108.2, height - 8, 8);
    const step = width / HERO_CANDLES.length;
    const marker = svgEl("rect", { class: "fragment-marker", y: 0, width: step, height }, svg);
    HERO_CANDLES.forEach((candle, index) => {
      const node = drawCandle(svg, candle, step * index + step / 2, y, step * 0.5);
      node.style.setProperty("--i", index);
      node.classList.add("cd-draw");
    });

    const readout = htmlEl("p", "fragment-readout mono", host);
    readout.setAttribute("aria-live", "polite");
    const label = htmlEl("label", "fragment-scrub", host);
    htmlEl("span", "mono", label, t("hero.fragmentScrub"));
    const input = htmlEl("input", "", label);
    Object.assign(input, { type: "range", min: 0, max: HERO_CANDLES.length - 1, step: 1, value: day });

    function sync() {
      const [open, high, low, close] = HERO_CANDLES[day];
      marker.setAttribute("x", step * day);
      const sessionLabel = `${t("hero.fragmentDay")} ${day + 1}`;
      readout.textContent = `${sessionLabel}  O ${open.toFixed(1)}  H ${high.toFixed(1)}  L ${low.toFixed(1)}  C ${close.toFixed(1)}`;
      input.setAttribute("aria-valuetext", readout.textContent);
    }
    input.addEventListener("input", () => {
      day = Number(input.value);
      sync();
    });
    sync();
  }

  /* ---------- Demonstration: Build a candle ---------- */

  const candleState = { ...CANDLE.start, done: false, justDone: false };

  function mountCandle(host, t) {
    host.replaceChildren();
    const bench = htmlEl("div", "bench bench-candle", host);
    const stage = htmlEl("div", "bench-stage", bench);
    const side = htmlEl("div", "bench-side", bench);

    const compact = isCompact();
    const width = compact ? 400 : 520;
    const height = 410;
    const center = compact ? 206 : 260;
    const bodyWidth = compact ? 60 : 76;
    const handleReach = compact ? 42 : 74;
    const y = linear(90, 120, height - 14, 14);
    const yToPrice = linear(height - 14, 14, 90, 120);
    const svg = svgEl("svg", {
      viewBox: `0 0 ${width} ${height}`,
      class: "candle-svg",
      role: "group",
      "aria-label": t("demo.candle.chartLabel"),
    }, stage);

    const defs = svgEl("defs", {}, svg);
    const hatch = svgEl("pattern", {
      id: "candle-hatch", width: 7, height: 7,
      patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)",
    }, defs);
    svgEl("rect", { class: "hatch-paper", width: 7, height: 7 }, hatch);
    svgEl("line", { class: "hatch-line", x1: 0, y1: 0, x2: 0, y2: 7 }, hatch);

    for (let price = 90; price <= 120; price += 5) {
      svgEl("line", { class: "axis-tick", x1: 44, x2: 54, y1: y(price), y2: y(price) }, svg);
      svgEl("text", { class: "axis-label", x: 38, y: y(price) + 4, "text-anchor": "end" }, svg, String(price));
    }
    svgEl("line", { class: "axis-line", x1: 54, x2: 54, y1: y(120), y2: y(90) }, svg);

    const ruleEnd = compact ? width : 330;
    const fixedLabel = compact
      ? { x: width - 2, offset: -7, anchor: "end" }
      : { x: 340, offset: 4, anchor: "start" };
    [["high", CANDLE.high], ["low", CANDLE.low]].forEach(([name, price]) => {
      svgEl("line", { class: "fixed-rule", x1: 54, x2: ruleEnd, y1: y(price), y2: y(price) }, svg);
      svgEl("text", { class: "fixed-label", x: fixedLabel.x, y: y(price) + fixedLabel.offset, "text-anchor": fixedLabel.anchor }, svg,
        `${t(`demo.candle.${name}`)} ${formatPrice(price)} · ${t("demo.candle.fixed")}`);
    });

    const wick = svgEl("line", { class: "big-wick", x1: center, x2: center, y1: y(CANDLE.high), y2: y(CANDLE.low) }, svg);
    const body = svgEl("rect", { class: "big-body", x: center - bodyWidth / 2, width: bodyWidth }, svg);
    wick.setAttribute("aria-hidden", "true");

    function buildHandle(name, side_) {
      const direction = side_ === "left" ? -1 : 1;
      const edge = center + (direction * bodyWidth) / 2;
      const reach = edge + direction * handleReach;
      const group = svgEl("g", {
        class: `handle handle-${name}`,
        tabindex: 0,
        role: "slider",
        "aria-orientation": "vertical",
        "aria-label": t(`demo.candle.${name}`),
        "aria-valuemin": CANDLE.low,
        "aria-valuemax": CANDLE.high,
      }, svg);
      svgEl("line", { class: "handle-stem", x1: edge, x2: reach, y1: 0, y2: 0 }, group);
      svgEl("rect", { class: "handle-hit", x: Math.min(edge, reach) - 14, y: -24, width: 102, height: 48 }, group);
      if (name === "open") {
        svgEl("rect", { class: "handle-grip", x: reach - 11, y: -11, width: 22, height: 22 }, group);
      } else {
        svgEl("circle", { class: "handle-grip", cx: reach, cy: 0, r: 12 }, group);
      }
      svgEl("path", {
        class: "handle-arrows",
        d: `M${reach} -6 l-3.5 4 h7 z M${reach} 6 l-3.5 -4 h7 z`,
      }, group);
      const text = svgEl("text", {
        class: "handle-label",
        x: reach + direction * 19,
        y: -3,
        "text-anchor": side_ === "left" ? "end" : "start",
      }, group, t(`demo.candle.${name}`));
      const value = svgEl("text", {
        class: "handle-value",
        x: reach + direction * 19,
        y: 13,
        "text-anchor": side_ === "left" ? "end" : "start",
      }, group);
      return { group, value, text };
    }

    const handles = { open: buildHandle("open", "left"), close: buildHandle("close", "right") };

    const check = svgEl("g", { class: "candle-check", "aria-hidden": "true" }, svg);
    svgEl("path", { class: "pencil pencil-check", pathLength: 1, d: `M${width - 58} 164 l13 15 l26 -38` }, check);
    svgEl("text", { class: "hw-svg", x: width - 58, y: 206 }, check, t("demo.candle.doneMark"));

    const volSvg = svgEl("svg", {
      viewBox: `0 0 ${width} 104`,
      class: "volume-svg",
      role: "img",
    }, stage);
    svgEl("text", { class: "axis-label", x: 54, y: 12 }, volSvg, t("demo.candle.volumeAxis"));
    const volumeY = linear(0, CANDLE.volume.max, 90, 18);
    const volumeBars = [...CANDLE.pastVolumes, null].map((value, index) => {
      const x = (compact ? 62 : 90) + index * (compact ? 66 : 76);
      const bar = svgEl("rect", { class: value === null ? "vol-bar vol-bar-now" : "vol-bar", x, width: 44 }, volSvg);
      const label = svgEl("text", { class: "axis-label", x: x + 22, "text-anchor": "middle" }, volSvg);
      svgEl("text", { class: "axis-label", x: x + 22, y: 102, "text-anchor": "middle" }, volSvg,
        value === null ? t("demo.candle.now") : `S${index + 1}`);
      return { bar, label, value };
    });
    svgEl("line", { class: "axis-line", x1: 54, x2: width - 6, y1: 90, y2: 90 }, volSvg);

    const task = htmlEl("div", "bench-task", side);
    const taskMark = htmlEl("span", "task-box", task);
    taskMark.setAttribute("aria-hidden", "true");
    const taskCopy = htmlEl("div", "", task);
    htmlEl("span", "bench-kicker mono", taskCopy, t("demo.candle.taskLabel"));
    htmlEl("p", "task-text", taskCopy, t("demo.candle.task"));

    const verdict = htmlEl("p", "candle-verdict mono", side);

    const table = htmlEl("dl", "ohlc-table mono", side);
    const cells = {};
    [["open", "demo.candle.open"], ["high", "demo.candle.high"], ["low", "demo.candle.low"], ["close", "demo.candle.close"], ["body", "demo.candle.body"]].forEach(([key, label]) => {
      const row = htmlEl("div", "", table);
      htmlEl("dt", "", row, t(label));
      cells[key] = htmlEl("dd", "", row);
    });

    const inputs = htmlEl("div", "number-pair", side);
    function numberField(name) {
      const label = htmlEl("label", "num-field", inputs);
      htmlEl("span", "mono", label, t(`demo.candle.${name}`));
      const input = htmlEl("input", "", label);
      Object.assign(input, { type: "number", min: CANDLE.low, max: CANDLE.high, step: CANDLE.step, inputMode: "decimal" });
      input.addEventListener("input", () => {
        const value = Number(input.value);
        if (input.value !== "" && value >= CANDLE.low && value <= CANDLE.high) setPrice(name, value, true);
      });
      input.addEventListener("change", () => setPrice(name, input.value === "" ? candleState[name] : input.value));
      return input;
    }
    const numbers = { open: numberField("open"), close: numberField("close") };

    const volumeField = htmlEl("label", "range-field", side);
    const volumeLabel = htmlEl("span", "mono", volumeField);
    const volumeInput = htmlEl("input", "", volumeField);
    Object.assign(volumeInput, { type: "range", min: CANDLE.volume.min, max: CANDLE.volume.max, step: CANDLE.volume.step, value: candleState.volume });
    volumeInput.addEventListener("input", () => {
      candleState.volume = Number(volumeInput.value);
      sync();
    });

    const volumeNote = htmlEl("p", "bench-note", side, t("demo.candle.volumeNote"));
    volumeNote.setAttribute("data-note", "volume");

    const status = htmlEl("p", "sr", side);
    status.setAttribute("role", "status");

    const footer = htmlEl("div", "bench-foot", side);
    const reset = htmlEl("button", "text-btn", footer, t("demo.reset"));
    reset.type = "button";
    reset.addEventListener("click", () => {
      Object.assign(candleState, CANDLE.start, { done: false, justDone: false });
      volumeInput.value = candleState.volume;
      sync();
    });
    htmlEl("p", "illustrative mono", footer, t("demo.illustrative"));

    function setPrice(name, raw, keepTyping) {
      candleState[name] = clampToStep(raw, CANDLE.low, CANDLE.high, CANDLE.step);
      if (candleDirection(candleState.open, candleState.close) === "down" && !candleState.done) {
        candleState.done = true;
        candleState.justDone = true;
      }
      sync(keepTyping ? name : null);
    }

    function sync(typingIn) {
      const { open, close, volume } = candleState;
      const direction = candleDirection(open, close);
      svg.dataset.direction = direction;
      body.setAttribute("y", Math.min(y(open), y(close)));
      body.setAttribute("height", Math.max(3, Math.abs(y(open) - y(close))));
      ["open", "close"].forEach((name) => {
        const value = candleState[name];
        const handle = handles[name];
        handle.group.setAttribute("transform", `translate(0 ${y(value)})`);
        handle.group.setAttribute("aria-valuenow", value);
        handle.group.setAttribute("aria-valuetext", `${t(`demo.candle.${name}`)} ${formatPrice(value)}`);
        handle.value.textContent = formatPrice(value);
        if (typingIn !== name) numbers[name].value = value;
        cells[name].textContent = formatPrice(value);
      });
      cells.high.textContent = formatPrice(CANDLE.high);
      cells.low.textContent = formatPrice(CANDLE.low);
      cells.body.textContent = formatPrice(Math.abs(close - open));
      verdict.dataset.direction = direction;
      verdict.textContent = t(`demo.candle.dir.${direction}`);
      volumeBars.forEach(({ bar, label, value }) => {
        const amount = value === null ? volume : value;
        bar.setAttribute("y", volumeY(amount));
        bar.setAttribute("height", 90 - volumeY(amount));
        label.setAttribute("y", volumeY(amount) - 4);
        label.textContent = String(amount);
      });
      volSvg.setAttribute("aria-label", `${t("demo.candle.volumeAxis")}: ${[...CANDLE.pastVolumes, volume].join(", ")}`);
      volumeLabel.textContent = `${t("demo.candle.volumeControl")} ${volume}`;
      volumeInput.setAttribute("aria-valuetext", `${volume}`);
      task.classList.toggle("is-done", candleState.done);
      check.classList.toggle("is-done", candleState.done);
      if (candleState.justDone) {
        task.classList.add("just-done");
        status.textContent = t("demo.candle.doneStatus");
        candleState.justDone = false;
      } else if (!candleState.done) {
        status.textContent = "";
      }
    }

    ["open", "close"].forEach((name) => {
      const { group } = handles[name];
      const toPrice = (event) => {
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
        return yToPrice(point.y);
      };
      group.addEventListener("pointerdown", (event) => {
        group.setPointerCapture(event.pointerId);
        group.classList.add("is-dragging");
        group.focus({ preventScroll: true });
        event.preventDefault();
      });
      group.addEventListener("pointermove", (event) => {
        if (group.hasPointerCapture(event.pointerId)) setPrice(name, toPrice(event));
      });
      const release = () => group.classList.remove("is-dragging");
      group.addEventListener("pointerup", release);
      group.addEventListener("pointercancel", release);
      group.addEventListener("keydown", (event) => {
        const steps = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 4, PageDown: -4 };
        if (event.key in steps) {
          setPrice(name, candleState[name] + steps[event.key] * CANDLE.step);
        } else if (event.key === "Home") {
          setPrice(name, CANDLE.low);
        } else if (event.key === "End") {
          setPrice(name, CANDLE.high);
        } else {
          return;
        }
        event.preventDefault();
      });
    });

    sync();
  }

  /* ---------- Demonstration: Change the frame ---------- */

  const frameState = { frame: "short", impression: null };

  function mountFrame(host, t) {
    host.replaceChildren();
    const closes = frameCloses();
    const bench = htmlEl("div", "bench bench-frame", host);
    const stage = htmlEl("div", "bench-stage", bench);
    const side = htmlEl("div", "bench-side", bench);

    const switcher = htmlEl("div", "frame-switch", stage);
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", t("demo.frame.switchLabel"));
    const frameButtons = Object.keys(FRAMES).map((frame) => {
      const button = htmlEl("button", "seg-btn mono", switcher, t(`demo.frame.${frame}`));
      button.type = "button";
      button.dataset.frame = frame;
      button.addEventListener("click", () => go(frame));
      return button;
    });

    const width = isCompact() ? 400 : 640;
    const height = 310;
    const left = 46;
    const right = 18;
    const top = 16;
    const bottom = 30;
    const svg = chartSvg(width, height, "", "frame-svg", stage);
    const clipId = "frame-clip";
    const clip = svgEl("clipPath", { id: clipId }, svgEl("defs", {}, svg));
    svgEl("rect", { x: left, y: top, width: width - left - right, height: height - top - bottom }, clip);
    const grid = [0, 1, 2, 3].map(() => ({
      line: svgEl("line", { class: "grid-line", x1: left, x2: width - right }, svg),
      label: svgEl("text", { class: "axis-label", x: left - 7, "text-anchor": "end" }, svg),
    }));
    const plot = svgEl("g", { "clip-path": `url(#${clipId})` }, svg);
    const shade = svgEl("rect", { class: "frame-shade", y: top, height: height - top - bottom }, plot);
    const line = svgEl("polyline", { class: "frame-line" }, plot);
    const shadeLabel = svgEl("text", { class: "hw-svg", "text-anchor": "end" }, svg, t("demo.frame.shortSits"));
    const lastDot = svgEl("circle", { class: "frame-dot", r: 5 }, svg);
    const lastLabel = svgEl("text", { class: "frame-last", "text-anchor": "end" }, svg);
    const startLabel = svgEl("text", { class: "axis-label", x: left, y: height - 9 }, svg);
    const endLabel = svgEl("text", { class: "axis-label", x: width - right, y: height - 9, "text-anchor": "end" }, svg);

    const lastClose = closes[closes.length - 1];

    function viewFor(frame) {
      const range = frameRange(closes, frame);
      const padding = (range.max - range.min) * 0.1;
      return { start: range.start, end: range.end, low: range.min - padding, high: range.max + padding };
    }

    function draw(view) {
      const x = linear(view.start, view.end, left, width - right);
      const y = linear(view.low, view.high, height - bottom, top);
      line.setAttribute("points", closes.map((close, session) => `${x(session).toFixed(1)},${y(close).toFixed(1)}`).join(" "));
      grid.forEach(({ line: gridLine, label }, index) => {
        const value = view.low + ((index + 0.5) / 4) * (view.high - view.low);
        gridLine.setAttribute("y1", y(value));
        gridLine.setAttribute("y2", y(value));
        label.setAttribute("y", y(value) + 4);
        label.textContent = value.toFixed(0);
      });
      const shortStart = closes.length - FRAMES.short;
      const shadeX = x(shortStart);
      const shadeOpacity = Math.min(1, Math.max(0, (shortStart - view.start) / 30));
      shade.setAttribute("x", shadeX);
      shade.setAttribute("width", Math.max(0, width - right - shadeX));
      shade.style.opacity = shadeOpacity;
      shadeLabel.setAttribute("x", Math.max(left + 190, shadeX - 8));
      shadeLabel.setAttribute("y", top + 26);
      shadeLabel.style.opacity = shadeOpacity;
      lastDot.setAttribute("cx", width - right);
      lastDot.setAttribute("cy", y(lastClose));
      lastLabel.setAttribute("x", width - right - 10);
      lastLabel.setAttribute("y", y(lastClose) + (y(lastClose) < top + 34 ? 22 : -11));
      startLabel.textContent = `${t("demo.frame.session")} ${Math.round(view.start) + 1}`;
      endLabel.textContent = `${t("demo.frame.session")} ${closes.length}`;
    }
    lastLabel.textContent = `${t("demo.frame.lastClose")} ${formatPrice(lastClose)}`;

    let current = viewFor(frameState.frame);
    let animation = 0;

    function go(frame) {
      const target = viewFor(frame);
      frameState.frame = frame;
      cancelAnimationFrame(animation);
      syncCopy();
      if (reducedMotion()) {
        current = target;
        draw(current);
        return;
      }
      const from = current;
      const started = performance.now();
      const duration = 460;
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        const eased = 1 - (1 - progress) ** 3;
        current = Object.fromEntries(
          Object.keys(target).map((key) => [key, from[key] + (target[key] - from[key]) * eased])
        );
        draw(current);
        if (progress < 1) animation = requestAnimationFrame(tick);
      };
      animation = requestAnimationFrame(tick);
    }

    const prompt = htmlEl("div", "bench-task frame-prompt", side);
    htmlEl("span", "bench-kicker mono", prompt, t("demo.frame.noteLabel"));
    htmlEl("p", "task-text", prompt, t("demo.frame.noteQuestion"));
    const chips = htmlEl("div", "chip-row", side);
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", t("demo.frame.noteLabel"));
    const impressionButtons = ["rising", "falling", "sideways"].map((impression) => {
      const button = htmlEl("button", "chip", chips, t(`demo.frame.${impression}`));
      button.type = "button";
      button.dataset.impression = impression;
      button.addEventListener("click", () => {
        frameState.impression = impression;
        syncCopy();
      });
      return button;
    });

    const question = htmlEl("p", "frame-question", side, t("demo.frame.question"));
    const facts = htmlEl("dl", "ohlc-table mono", side);
    const factCells = {};
    ["from", "to", "change"].forEach((key) => {
      const row = htmlEl("div", "", facts);
      factCells[`${key}Label`] = htmlEl("dt", "", row);
      factCells[key] = htmlEl("dd", "", row);
    });
    const note = htmlEl("p", "bench-note", side);
    note.setAttribute("aria-live", "polite");
    const footer = htmlEl("div", "bench-foot", side);
    htmlEl("p", "illustrative mono", footer, t("demo.frame.illustrative"));

    function syncCopy() {
      const { frame, impression } = frameState;
      const range = frameRange(closes, frame);
      frameButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.frame === frame)));
      impressionButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.impression === impression)));
      svg.setAttribute("aria-label", `${t(`demo.frame.${frame}`)}. ${t("demo.frame.chartLabel")} ${formatPrice(range.first)} → ${formatPrice(range.last)}.`);
      factCells.fromLabel.textContent = `${t("demo.frame.session")} ${range.start + 1}`;
      factCells.from.textContent = formatPrice(range.first);
      factCells.toLabel.textContent = `${t("demo.frame.session")} ${range.end + 1}`;
      factCells.to.textContent = formatPrice(range.last);
      factCells.changeLabel.textContent = t("demo.frame.change");
      factCells.change.textContent = `${range.changePct >= 0 ? "+" : "−"}${Math.abs(range.changePct).toFixed(1)}%`;
      const noted = impression ? `${t("demo.frame.youNoted")} ${t(`demo.frame.${impression}`)}. ` : "";
      note.textContent = noted + t(`demo.frame.note.${frame}`);
      question.classList.toggle("is-asked", frame === "long");
    }

    draw(current);
    syncCopy();
  }

  /* ---------- Demonstration: Find the false break ---------- */

  const breakState = { step: 0 };

  function mountFalseBreak(host, t) {
    host.replaceChildren();
    const bench = htmlEl("div", "bench bench-break", host);
    const stage = htmlEl("div", "bench-stage", bench);
    const side = htmlEl("div", "bench-side", bench);

    const width = isCompact() ? 400 : 640;
    const height = 330;
    const left = 42;
    const right = 16;
    const total = BREAK.base.length + BREAK.steps.length;
    const svg = chartSvg(width, height, "", "break-svg", stage);
    const y = linear(88, 106, height - 18, 16);
    const slot = (width - left - right) / total;
    const x = (index) => left + slot * index + slot / 2;

    [90, 95, 105].forEach((price) => {
      svgEl("line", { class: "grid-line", x1: left, x2: width - right, y1: y(price), y2: y(price) }, svg);
      svgEl("text", { class: "axis-label", x: left - 7, y: y(price) + 4, "text-anchor": "end" }, svg, String(price));
    });
    svgEl("rect", { class: "level-zone", x: left, width: width - left - right, y: y(100.5), height: y(99.5) - y(100.5) }, svg);
    svgEl("line", { class: "level-line", x1: left, x2: width - right, y1: y(BREAK.level), y2: y(BREAK.level) }, svg);
    svgEl("text", { class: "level-label", x: left + 6, y: y(BREAK.level) - 10 }, svg, `${t("demo.break.level")} ${BREAK.level}`);
    svgEl("text", { class: "axis-label", x: left - 7, y: y(BREAK.level) + 4, "text-anchor": "end" }, svg, String(BREAK.level));

    const candles = svgEl("g", {}, svg);
    const notes = svgEl("g", {}, svg);

    const statusBox = htmlEl("div", "bench-task break-status", side);
    const counter = htmlEl("span", "bench-kicker mono", statusBox);
    const statusText = htmlEl("p", "task-text", statusBox);
    statusText.setAttribute("aria-live", "polite");

    const reveal = htmlEl("button", "btn solid", side, t("demo.break.reveal"));
    reveal.type = "button";
    reveal.addEventListener("click", () => {
      if (breakState.step < BREAK.steps.length) {
        breakState.step += 1;
        render(true);
      }
    });

    const closes = htmlEl("dl", "ohlc-table mono", side);
    const latestRow = htmlEl("div", "", closes);
    htmlEl("dt", "", latestRow, t("demo.break.latest"));
    const latest = htmlEl("dd", "", latestRow);
    const relationRow = htmlEl("div", "", closes);
    htmlEl("dt", "", relationRow, t("demo.break.vsLevel"));
    const relation = htmlEl("dd", "", relationRow);

    const footer = htmlEl("div", "bench-foot", side);
    const restart = htmlEl("button", "text-btn", footer, t("demo.break.restart"));
    restart.type = "button";
    restart.addEventListener("click", () => {
      breakState.step = 0;
      render(false);
      reveal.focus();
    });
    htmlEl("p", "illustrative mono", footer, t("demo.illustrative"));

    function render(animateNewest) {
      const { step } = breakState;
      const visible = breakCandles(step);
      const events = breakEvents();
      candles.replaceChildren();
      visible.forEach((candle, index) => {
        const isNewest = animateNewest && index === visible.length - 1;
        drawCandle(candles, candle, x(index), y, slot * 0.56, isNewest ? "cd-new" : "");
      });

      notes.replaceChildren();
      const crossingIndex = BREAK.base.length + events.crossing;
      const returnIndex = BREAK.base.length + events.returned;
      if (step > events.crossing) {
        svgEl("circle", { class: "ring", cx: x(crossingIndex), cy: y(BREAK.steps[events.crossing][3]), r: 9 }, notes);
        const animated = step === events.crossing + 1;
        const group = svgEl("g", { class: animated ? "note-new" : "" }, notes);
        pencilArrow(group, x(crossingIndex) - 74, y(104.4), x(crossingIndex) - 10, y(102.2));
        svgEl("text", { class: "hw-svg", x: x(crossingIndex) - 80, y: y(104.4) + 5, "text-anchor": "end" }, group, t("demo.break.crossNote"));
      }
      if (step > events.returned) {
        svgEl("circle", { class: "ring", cx: x(returnIndex), cy: y(BREAK.steps[events.returned][3]), r: 9 }, notes);
        const animated = step === events.returned + 1;
        const group = svgEl("g", { class: animated ? "note-new" : "" }, notes);
        pencilArrow(group, x(returnIndex) - 62, y(92.2), x(returnIndex) - 9, y(97.4));
        svgEl("text", { class: "hw-svg", x: x(returnIndex) - 68, y: y(92.2) + 5, "text-anchor": "end" }, group, t("demo.break.returnNote"));
      }

      const status = breakStatus(step);
      const lastCandle = visible[visible.length - 1];
      const close = lastCandle[3];
      counter.textContent = `${t("demo.break.step")} ${step} / ${BREAK.steps.length}`;
      statusText.textContent = t(`demo.break.status.${status}`);
      statusBox.dataset.status = status;
      latest.textContent = formatPrice(close);
      relation.textContent = t(close > BREAK.level ? "demo.break.above" : "demo.break.below");
      svg.setAttribute("aria-label", `${t("demo.break.chartLabel")} ${t("demo.break.latest")} ${formatPrice(close)}.`);
      const finished = step === BREAK.steps.length;
      reveal.disabled = finished;
      reveal.textContent = t(finished ? "demo.break.finished" : "demo.break.reveal");
      restart.hidden = step === 0;
    }

    render(false);
  }

  /* ---------- Reading diagrams for the remaining guides ---------- */

  function diagramShell(host, t, labelKey, noteKey, viewWidth, viewHeight) {
    host.replaceChildren();
    const bench = htmlEl("div", "bench bench-diagram", host);
    const figure = htmlEl("figure", "diagram-figure", bench);
    const scroller = htmlEl("div", "diagram-scroll", figure);
    const svg = chartSvg(viewWidth, viewHeight, t(labelKey), "diagram-svg", scroller);
    if (isCompact()) {
      scroller.tabIndex = 0;
      scroller.setAttribute("role", "group");
      scroller.setAttribute("aria-label", t(labelKey));
    }
    htmlEl("p", "diagram-hint mono", figure, t("demo.swipe"));
    const caption = htmlEl("figcaption", "bench-note", figure, t(noteKey));
    caption.dataset.note = "diagram";
    return svg;
  }

  function label(group, x, y, text, className = "dg-label", anchor = "start") {
    return svgEl("text", { class: className, x, y, "text-anchor": anchor }, group, text);
  }

  function drawOwnership(host, t) {
    const svg = diagramShell(host, t, "dg.own.label", "dg.own.note", 720, 300);
    svgEl("path", { class: "dg-stroke", d: "M40 96 h170 l14 34 h-198 z M40 130 v110 h170 v-110 M112 240 v-66 h34 v66" }, svg);
    label(svg, 26, 276, t("dg.own.business"), "dg-head");
    label(svg, 26, 86, t("dg.own.businessSub"), "dg-mono");
    svgEl("path", { class: "dg-stroke", d: "M240 168 h46 m-9 -8 l9 8 l-9 8" }, svg);
    const size = 15;
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        svgEl("rect", {
          class: row === 2 && col === 7 ? "dg-cell dg-cell-on" : "dg-cell",
          x: 302 + col * (size + 2),
          y: 84 + row * (size + 2),
          width: size,
          height: size,
        }, svg);
      }
    }
    label(svg, 302, 276, t("dg.own.shares"), "dg-head");
    label(svg, 302, 70, t("dg.own.sharesSub"), "dg-mono");
    svgEl("path", { class: "pencil-static", d: "M431 128 C480 112 500 112 520 118" }, svg);
    label(svg, 526, 106, t("dg.own.oneShare"), "dg-head");
    label(svg, 526, 128, t("dg.own.oneShareSub"), "dg-mono");
    svgEl("line", { class: "dg-rule", x1: 526, x2: 700, y1: 158, y2: 158 }, svg);
    label(svg, 526, 190, t("dg.own.price"), "dg-head");
    label(svg, 526, 212, t("dg.own.priceSub"), "dg-mono");
    label(svg, 526, 246, t("dg.own.hand"), "hw-svg");
  }

  function drawVolumeVolatility(host, t) {
    const svg = diagramShell(host, t, "dg.vol.label", "dg.vol.note", 720, 300);
    const panels = [
      { x: 30, title: "dg.vol.busy", candles: [[100, 100.8, 99.6, 100.5], [100.5, 101, 100, 100.2], [100.2, 100.9, 99.8, 100.7], [100.7, 101.1, 100.2, 100.4], [100.4, 101, 100.1, 100.8], [100.8, 101.1, 100.3, 100.5]], volumes: [82, 94, 76, 88, 92, 80] },
      { x: 380, title: "dg.vol.quiet", candles: [[100, 104, 98.4, 103.4], [103.4, 104.4, 97.4, 98], [98, 103.6, 97, 102.8], [102.8, 103.8, 97.2, 97.8], [97.8, 104, 97.2, 103.2], [103.2, 104.2, 98, 98.6]], volumes: [24, 18, 26, 20, 22, 28] },
    ];
    panels.forEach((panel) => {
      label(svg, panel.x, 28, t(panel.title), "dg-head");
      const y = linear(95.5, 105.5, 188, 42);
      panel.candles.forEach((candle, index) => {
        drawCandle(svg, candle, panel.x + 26 + index * 50, y, 24);
        const height = panel.volumes[index] * 0.62;
        svgEl("rect", { class: "vol-bar", x: panel.x + 14 + index * 50, y: 268 - height, width: 24, height }, svg);
      });
      svgEl("line", { class: "axis-line", x1: panel.x, x2: panel.x + 310, y1: 268, y2: 268 }, svg);
      label(svg, panel.x, 288, t("dg.vol.bars"), "dg-mono");
    });
    label(svg, 355, 150, "≠", "dg-big", "middle");
  }

  function drawRisk(host, t) {
    const svg = diagramShell(host, t, "dg.risk.label", "dg.risk.note", 720, 300);
    svgEl("rect", { class: "dg-node", x: 14, y: 114, width: 196, height: 66 }, svg);
    label(svg, 112, 142, t("dg.risk.decision"), "dg-head", "middle");
    label(svg, 112, 163, t("dg.risk.decisionSub"), "dg-mono", "middle");
    const branches = [
      { y: 62, share: "60%", key: "dg.risk.a", width: 4.4, sub: "dg.risk.aSub" },
      { y: 232, share: "40%", key: "dg.risk.b", width: 2.8, sub: "dg.risk.bSub" },
    ];
    branches.forEach((branch) => {
      svgEl("path", {
        class: "dg-branch",
        "stroke-width": branch.width,
        d: `M210 147 C280 147 290 ${branch.y} 370 ${branch.y}`,
      }, svg);
      label(svg, 300, branch.y < 147 ? branch.y + 2 : branch.y + 6, branch.share, "dg-mono-strong");
      svgEl("rect", { class: "dg-node", x: 370, y: branch.y - 32, width: 318, height: 64 }, svg);
      label(svg, 386, branch.y - 7, t(branch.key), "dg-head");
      label(svg, 386, branch.y + 16, t(branch.sub), "dg-mono");
    });
    label(svg, 370, 154, t("dg.risk.hand"), "hw-svg");
  }

  function drawSources(host, t) {
    const svg = diagramShell(host, t, "dg.src.label", "dg.src.note", 720, 300);
    const tiers = [
      { y: 24, x: 24, width: 672, key: "dg.src.primary", sub: "dg.src.primarySub", cls: "dg-tier-1" },
      { y: 112, x: 94, width: 532, key: "dg.src.secondary", sub: "dg.src.secondarySub", cls: "dg-tier-2" },
      { y: 200, x: 164, width: 392, key: "dg.src.tertiary", sub: "dg.src.tertiarySub", cls: "dg-tier-3" },
    ];
    tiers.forEach((tier) => {
      svgEl("rect", { class: `dg-node ${tier.cls}`, x: tier.x, y: tier.y, width: tier.width, height: 74 }, svg);
      label(svg, 360, tier.y + 32, t(tier.key), "dg-head", "middle");
      label(svg, 360, tier.y + 54, t(tier.sub), "dg-mono", "middle");
    });
    svgEl("path", { class: "pencil-static", d: "M640 232 C690 200 690 150 664 104 m-2 13 l2 -13 l12 6" }, svg);
    label(svg, 590, 256, t("dg.src.hand"), "hw-svg");
  }

  function drawBias(host, t) {
    const svg = diagramShell(host, t, "dg.bias.label", "dg.bias.note", 720, 300);
    const closes = frameCloses();
    const full = { x: 20, y: 18, width: 680, height: 118 };
    const low = Math.min(...closes);
    const high = Math.max(...closes);
    const fullX = linear(0, closes.length - 1, full.x, full.x + full.width);
    const fullY = linear(low, high, full.y + full.height, full.y);
    const points = (from, to, x, y) =>
      closes.slice(from, to + 1).map((close, index) => `${x(from + index).toFixed(1)},${y(close).toFixed(1)}`).join(" ");
    svgEl("polyline", { class: "dg-line", points: points(0, closes.length - 1, fullX, fullY) }, svg);
    const crops = [
      { from: 52, to: 70, x: 20, cls: "crop-a", key: "dg.bias.cropA" },
      { from: 100, to: 119, x: 380, cls: "crop-b", key: "dg.bias.cropB" },
    ];
    crops.forEach((crop) => {
      const frameX = fullX(crop.from);
      const frameWidth = fullX(crop.to) - frameX;
      svgEl("rect", { class: `crop-frame ${crop.cls}`, x: frameX, y: full.y, width: frameWidth, height: full.height }, svg);
      const slice = closes.slice(crop.from, crop.to + 1);
      const panel = { y: 172, width: 320, height: 92 };
      const x = linear(crop.from, crop.to, crop.x, crop.x + panel.width);
      const y = linear(Math.min(...slice), Math.max(...slice), panel.y + panel.height, panel.y);
      svgEl("rect", { class: `crop-frame ${crop.cls}`, x: crop.x, y: panel.y - 8, width: panel.width, height: panel.height + 16 }, svg);
      svgEl("polyline", { class: "dg-line dg-line-strong", points: points(crop.from, crop.to, x, y) }, svg);
      label(svg, crop.x, 292, t(crop.key), "dg-mono-strong");
    });
  }

  function drawReflection(host, t) {
    const svg = diagramShell(host, t, "dg.ref.label", "dg.ref.note", 720, 300);
    for (let line = 0; line < 8; line += 1) {
      svgEl("line", { class: "dg-notebook", x1: 18, x2: 702, y1: 36 + line * 37, y2: 36 + line * 37 }, svg);
    }
    svgEl("line", { class: "dg-margin", x1: 196, x2: 196, y1: 8, y2: 296 }, svg);
    label(svg, 26, 66, t("dg.ref.said"), "dg-mono-strong");
    label(svg, 26, 139, t("dg.ref.happened"), "dg-mono-strong");
    label(svg, 26, 213, t("dg.ref.gap"), "dg-mono-strong");
    const drawDots = (rowY, filled) => {
      for (let index = 0; index < 10; index += 1) {
        svgEl("circle", {
          class: index < filled ? "dg-dot dg-dot-on" : "dg-dot",
          cx: 226 + index * 34,
          cy: rowY,
          r: 12,
        }, svg);
      }
    };
    drawDots(61, 7);
    drawDots(134, 5);
    label(svg, 576, 66, t("dg.ref.saidValue"), "hw-svg");
    label(svg, 576, 139, t("dg.ref.happenedValue"), "hw-svg");
    label(svg, 214, 213, t("dg.ref.gapValue"), "hw-svg");
    label(svg, 214, 275, t("dg.ref.hand"), "hw-svg");
  }

  const WORKSPACES = [
    drawOwnership, mountCandle, mountFrame, mountFalseBreak,
    drawVolumeVolatility, drawRisk, drawSources, drawBias, drawReflection,
  ];

  function renderWorkspace(index, host, t) {
    WORKSPACES[index](host, t);
  }

  /* ---------- Evidence Desk exhibits ---------- */

  function renderExhibit(chartHost, chipHost, caseIndex, state, t, onInspect) {
    const exhibit = CASES[caseIndex];
    const width = isCompact() ? 420 : 560;
    const height = 330;
    const left = 44;
    const right = 16;
    const top = 18;
    const bottom = 34;
    const slots = exhibit.candles.length + exhibit.emptySlots;
    const lows = exhibit.candles.map((candle) => candle[2]);
    const highs = exhibit.candles.map((candle) => candle[1]);
    const span = Math.max(...highs) - Math.min(...lows);
    const low = Math.min(...lows) - span * 0.14;
    const high = Math.max(...highs) + span * (exhibit.emptySlots ? 0.3 : 0.2);
    const y = linear(low, high, height - bottom, top);
    const slot = (width - left - right) / slots;
    const x = (index) => left + slot * index + slot / 2;

    chartHost.replaceChildren();
    const svg = chartSvg(width, height, t(`desk.case${caseIndex + 1}.chart`), "exhibit-svg", chartHost);
    for (let line = 0; line < 4; line += 1) {
      const value = low + ((line + 0.5) / 4) * (high - low);
      svgEl("line", { class: "grid-line", x1: left, x2: width - right, y1: y(value), y2: y(value) }, svg);
      svgEl("text", { class: "axis-label", x: left - 7, y: y(value) + 4, "text-anchor": "end" }, svg, value.toFixed(0));
    }
    svgEl("text", { class: "axis-label", x: left, y: height - 11 }, svg, t("desk.axis"));

    if (exhibit.emptySlots && state.answered) {
      const emptyX = left + slot * exhibit.candles.length;
      svgEl("rect", { class: "future-zone", x: emptyX, y: top, width: width - right - emptyX, height: height - top - bottom }, svg);
    }

    exhibit.candles.forEach((candle, index) => {
      const marked = exhibit.marks.some((mark) => mark.index === index && (state.inspected.includes(mark.id) || state.answered));
      drawCandle(svg, candle, x(index), y, slot * (exhibit.emptySlots ? 0.46 : 0.5), marked ? "cd-focus" : "");
    });

    exhibit.marks.forEach((mark) => {
      if (!state.inspected.includes(mark.id) && !state.answered) return;
      const close = exhibit.candles[mark.index][3];
      const cx = x(mark.index);
      const cy = y(close);
      svgEl("line", { class: "close-rule", x1: left, x2: cx, y1: cy, y2: cy }, svg);
      svgEl("circle", { class: state.answered ? "ring ring-found" : "ring", cx, cy, r: 8 }, svg);
      const tagWidth = 58;
      const tagX = Math.max(left + 3, cx - tagWidth - 16);
      svgEl("rect", { class: "close-tag", x: tagX, y: cy - 22, width: tagWidth, height: 17 }, svg);
      svgEl("text", { class: "close-tag-text", x: tagX + tagWidth / 2, y: cy - 9, "text-anchor": "middle" }, svg, formatPrice(close));
    });

    if (state.answered) {
      const notes = svgEl("g", { class: "note-new" }, svg);
      if (caseIndex === 0) {
        const previous = exhibit.candles[6][3];
        const final = exhibit.candles[7][3];
        const bracketX = x(7) + slot * 0.52;
        svgEl("path", { class: "pencil", pathLength: 1, d: `M${bracketX - 6} ${y(previous)} h6 V${y(final)} h-6` }, notes);
        svgEl("text", { class: "hw-svg", x: x(2), y: y(107), "text-anchor": "middle" }, notes,
          `${t("desk.case1.delta")} +${formatPrice(final - previous)}`);
      } else if (caseIndex === 1) {
        const firstClose = exhibit.candles[0][3];
        const lastClose = exhibit.candles[8][3];
        svgEl("text", { class: "hw-svg", x: x(0.6), y: y(high) + 26 }, notes,
          `${t("desk.case2.recorded")} ${formatPrice(firstClose)} → ${formatPrice(lastClose)}`);
        const whyX = x(5.6);
        const whyY = y(low) - 2;
        svgEl("text", { class: "hw-svg", x: whyX, y: whyY }, notes, `${t("desk.case2.why")} ${t("desk.case2.notRecorded")}`);
      } else {
        const last = exhibit.candles[exhibit.candles.length - 1][3];
        const startX = x(exhibit.candles.length - 1);
        const endX = width - right - 8;
        svgEl("path", { class: "branch-dash", d: `M${startX} ${y(last)} Q${(startX + endX) / 2} ${y(last)} ${endX} ${y(last + span * 0.26)}` }, notes);
        svgEl("path", { class: "branch-dash", d: `M${startX} ${y(last)} Q${(startX + endX) / 2} ${y(last)} ${endX} ${y(last - span * 0.42)}` }, notes);
        svgEl("text", { class: "hw-svg", x: endX, y: height - bottom - 12, "text-anchor": "end" }, notes, t("desk.case3.empty"));
      }
    }

    chipHost.replaceChildren();
    exhibit.marks.forEach((mark) => {
      const close = exhibit.candles[mark.index][3];
      const open = state.inspected.includes(mark.id) || state.answered;
      const chip = htmlEl("button", "inspect-chip", chipHost);
      chip.type = "button";
      chip.dataset.mark = mark.id;
      chip.setAttribute("aria-pressed", String(open));
      chip.disabled = state.answered;
      htmlEl("span", "", chip, t(mark.label));
      htmlEl("b", "mono", chip, open ? formatPrice(close) : "··.··");
      chip.addEventListener("click", () => onInspect(mark.id));
    });
  }

  function focusInspectChip(chipHost, markId) {
    chipHost.querySelector(`[data-mark="${markId}"]`)?.focus();
  }

  return {
    BREAK,
    CANDLE,
    CASES,
    FRAMES,
    breakCandles,
    breakEvents,
    breakStatus,
    candleDirection,
    clampToStep,
    focusInspectChip,
    frameCloses,
    frameRange,
    mountHeroFragment,
    renderExhibit,
    renderWorkspace,
  };
});
