import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const field = require("../public/assets/field-desk.js");
const homepage = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../public/assets/home.css", import.meta.url), "utf8");
const course = JSON.parse(readFileSync(new URL("../public/course.json", import.meta.url), "utf8"));

function exampleCatalog(language) {
  const start = homepage.indexOf(language === "en" ? "  en: {" : "  ko: {");
  return homepage.slice(start, homepage.indexOf("\n  }", start));
}

test("candle handles stay inside the fixed high and low", () => {
  const { low, high, step } = field.CANDLE;
  assert.equal(field.clampToStep(500, low, high, step), high);
  assert.equal(field.clampToStep(-20, low, high, step), low);
  assert.equal(field.clampToStep(100.26, low, high, step), 100.5);
  assert.equal(field.clampToStep("not a number", low, high, step), low);
});

test("candle direction reports up, down, and flat", () => {
  assert.equal(field.candleDirection(100, 110), "up");
  assert.equal(field.candleDirection(110, 100), "down");
  assert.equal(field.candleDirection(100, 100), "flat");
});

test("both frames read one unchanged series and tell different stories", () => {
  const closes = field.frameCloses();
  assert.equal(closes.length, field.FRAMES.long);
  assert.deepEqual(field.frameCloses(), closes, "series must be deterministic");

  const short = field.frameRange(closes, "short");
  const long = field.frameRange(closes, "long");
  assert.equal(short.last, long.last, "the last close must match in both views");
  assert.equal(short.end, long.end);
  assert.deepEqual(closes.slice(short.start), closes.slice(long.start).slice(-field.FRAMES.short));
  assert.ok(short.changePct < 0, "the short window should read as a fall");
  assert.ok(long.changePct > 0, "the long window should read as a rise");
});

test("the false break starts below the level, crosses, and returns one step at a time", () => {
  const { level, base, steps } = field.BREAK;
  assert.ok(base.every((candle) => candle[1] < level), "the chart must pause before the level is crossed");
  assert.equal(field.breakStatus(0), "paused");

  const { crossing, returned } = field.breakEvents();
  assert.ok(crossing >= 0 && returned > crossing);
  assert.ok(steps[crossing][3] > level);
  assert.ok(steps[returned][3] < level);
  assert.equal(field.breakStatus(crossing + 1), "crossed");
  assert.equal(field.breakStatus(returned + 1), "returned");
  for (let step = 0; step <= steps.length; step += 1) {
    assert.equal(field.breakCandles(step).length, base.length + step);
  }
});

test("candles in every teaching dataset are internally valid", () => {
  const sets = [...field.CASES.map((item) => item.candles), [...field.BREAK.base, ...field.BREAK.steps]];
  for (const candles of sets) {
    for (const [open, high, low, close] of candles) {
      assert.ok(high >= Math.max(open, close) && low <= Math.min(open, close));
    }
  }
});

test("evidence cases match the claims they are paired with", () => {
  const [closes] = field.CASES;
  const previous = closes.candles[closes.marks[0].index][3];
  const final = closes.candles[closes.marks[1].index][3];
  assert.ok(final > previous, "case one must be supported by its chart");
  assert.match(homepage, /answer:"evidence"[\s\S]*answer:"assumption"[\s\S]*answer:"assumption"/);
  assert.ok(field.CASES[2].emptySlots > 0, "the guarantee case needs unrecorded space after the last candle");
});

test("curriculum counts stay honest", () => {
  assert.equal(course.chapters.length, 15);
  assert.match(exampleCatalog("en"), /"lab\.artifact1":"15 guided lessons"/);
  assert.match(exampleCatalog("ko"), /"lab\.artifact1":"단계별 수업 15개"/);
  assert.equal((homepage.match(/chapters:"Course chapter/g) ?? []).length, 9);
  for (const match of homepage.matchAll(/chapters:"Course chapters? ([\d, and]+)"/g)) {
    for (const chapter of match[1].match(/\d+/g)) {
      assert.ok(Number(chapter) <= course.chapters.length, `chapter ${chapter} does not exist`);
    }
  }
  assert.doesNotMatch(homepage, /LESSON 0\d \/ 09/);
});

test("invented data is labeled and the disclaimer no longer calls every chart historical", () => {
  for (const language of ["en", "ko"]) {
    assert.doesNotMatch(exampleCatalog(language), /All charts are historical|모든 차트는 과거 자료/);
  }
  assert.match(exampleCatalog("en"), /"demo\.illustrative":"Illustrative data/);
  assert.match(exampleCatalog("en"), /"lab\.illustrative":"ILLUSTRATIVE DATA/);
  assert.match(exampleCatalog("en"), /"hero\.fragmentTag":"ILLUSTRATIVE"/);
});

test("photographs exist, are sized, described, and credited", () => {
  const images = [...homepage.matchAll(/<img\b[^>]*src="(assets\/img\/photos\/[^"]+)"[^>]*>/g)];
  assert.ok(images.length >= 5);
  for (const [tag, source] of images) {
    assert.ok(existsSync(new URL(`../public/${source}`, import.meta.url)), `missing ${source}`);
    assert.match(tag, /\bwidth="\d+"/);
    assert.match(tag, /\bheight="\d+"/);
    assert.match(tag, /\balt="/);
  }
  for (const credit of ["John Vachon", "John Collier", "Gary Hoover", "Syced", "Peter Elfelt", "Ladabohac", "City of Columbus"]) {
    assert.ok(homepage.includes(credit), `missing photo credit: ${credit}`);
  }
  assert.match(homepage, /creativecommons\.org\/licenses\/by\/4\.0/);
});

test("motion is opt-out and drag has non-pointer alternatives", () => {
  assert.match(stylesheet, /prefers-reduced-motion:reduce/);
  assert.match(homepage, /prefers-reduced-motion:reduce/);
  const source = readFileSync(new URL("../public/assets/field-desk.js", import.meta.url), "utf8");
  assert.match(source, /role: "slider"/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /type: "number"/);
  assert.match(source, /setPointerCapture/);
});
