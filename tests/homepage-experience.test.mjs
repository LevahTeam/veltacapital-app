import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const homepage = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const chartLab = readFileSync(new URL("../public/predict-the-graph.html", import.meta.url), "utf8");
const inlineScripts = [...homepage.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
const clientScript = inlineScripts.at(-1)?.[1] ?? "";

function openingTags(name, attribute) {
  const pattern = new RegExp(`<${name}\\b[^>]*\\b${attribute}=(?:"[^"]*"|'[^']*')[^>]*>`, "gi");
  return homepage.match(pattern) ?? [];
}

function hasAttribute(tag, name, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${name}=(?:"${escaped}"|'${escaped}')`, "i").test(tag);
}

function sectionMarkup(id) {
  const start = homepage.search(new RegExp(`<section\\b[^>]*\\bid=(?:"${id}"|'${id}')[^>]*>`, "i"));
  assert.notEqual(start, -1, `missing #${id} section`);
  const end = homepage.indexOf("</section>", start);
  assert.notEqual(end, -1, `missing closing tag for #${id}`);
  return homepage.slice(start, end + "</section>".length);
}

test("homepage offers a persistent English/Korean language control", () => {
  assert.match(homepage, /<html\b[^>]*\blang="en"/i);

  const languageButtons = openingTags("button", "data-language");
  assert.equal(languageButtons.length, 2, "expected exactly two language choices");
  assert.ok(languageButtons.some((tag) => hasAttribute(tag, "data-language", "en")));
  assert.ok(languageButtons.some((tag) => hasAttribute(tag, "data-language", "ko")));
  assert.ok(languageButtons.every((tag) => /\baria-pressed=(?:"(?:true|false)"|'(?:true|false)')/i.test(tag)));

  assert.match(homepage, /role=(?:"group"|'group')[^>]*aria-label=|aria-label=[^>]*role=(?:"group"|'group')/i);
  assert.match(homepage, /velta-language/);
  assert.match(homepage, /localStorage\.getItem\s*\(/);
  assert.match(homepage, /localStorage\.setItem\s*\(/);
  assert.match(homepage, /document\.documentElement\.lang\s*=/);
  assert.match(homepage, /new URLSearchParams\s*\(|\.searchParams\b/);
});

test("Korean translations cover each major student-facing homepage section", () => {
  const translationHooks = homepage.match(/\bdata-i18n=(?:"[^"]+"|'[^']+')/g) ?? [];
  assert.ok(translationHooks.length >= 30, `expected broad translation coverage, found ${translationHooks.length} hooks`);

  assert.match(homepage, /[가-힣]{2,}/, "expected Korean-language copy in the translation catalog");
  assert.ok((homepage.match(/[가-힣]+/g) ?? []).length >= 30, "expected more than token Korean coverage");

  assert.match(homepage.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0] ?? "", /data-i18n=/);
  assert.match(homepage.match(/<section\b[^>]*class="hero[^"]*"[\s\S]*?<\/section>/i)?.[0] ?? "", /data-i18n=/);
  for (const sectionId of ["how", "course", "try", "access"]) {
    assert.match(sectionMarkup(sectionId), /data-i18n=/, `#${sectionId} lacks translation hooks`);
  }
});

test("English and Korean catalogs have parity and cover every translation hook", () => {
  const declaration = "const translations =";
  const declarationIndex = clientScript.indexOf(declaration);
  assert.notEqual(declarationIndex, -1, "missing translation catalog");
  const objectStart = clientScript.indexOf("{", declarationIndex + declaration.length);
  let depth = 0;
  let objectEnd = -1;
  let quote = "";
  let escaped = false;
  for (let index = objectStart; index < clientScript.length; index += 1) {
    const char = clientScript[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      objectEnd = index + 1;
      break;
    }
  }
  assert.notEqual(objectEnd, -1, "translation catalog is not a complete object literal");

  // The catalog is data-only. Evaluating this isolated object lets the test verify exact key parity.
  const catalog = Function(`"use strict"; return (${clientScript.slice(objectStart, objectEnd)});`)();
  const englishKeys = Object.keys(catalog.en).sort();
  const koreanKeys = Object.keys(catalog.ko).sort();
  assert.deepEqual(koreanKeys, englishKeys, "English and Korean translation keys differ");

  const hookedKeys = [...homepage.matchAll(/\bdata-i18n(?:-html)?=(?:"([^"]+)"|'([^']+)')/g)]
    .map((match) => match[1] ?? match[2]);
  for (const key of new Set(hookedKeys)) {
    assert.ok(key in catalog.en, `missing English translation: ${key}`);
    assert.ok(key in catalog.ko, `missing Korean translation: ${key}`);
  }
});

test("script element lookups and ARIA controls point to real elements", () => {
  const ids = new Set([...homepage.matchAll(/\bid=(?:"([^"]+)"|'([^']+)')/g)].map((match) => match[1] ?? match[2]));
  const scriptLookups = [...clientScript.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1]);
  for (const id of new Set(scriptLookups)) {
    assert.ok(ids.has(id), `script references missing #${id}`);
  }

  const controlledIds = [...homepage.matchAll(/\baria-controls=(?:"([^"]+)"|'([^']+)')/g)].map((match) => match[1] ?? match[2]);
  for (const id of new Set(controlledIds)) {
    assert.ok(ids.has(id), `aria-controls references missing #${id}`);
  }
});

test("curriculum explorer is semantic and keyboard navigable", () => {
  const unitButtons = openingTags("button", "data-course-unit");
  assert.equal(unitButtons.length, 9, "expected one interactive trigger per curriculum unit");
  assert.deepEqual(
    unitButtons.map((tag) => tag.match(/\bdata-course-unit=(?:"([^"]+)"|'([^']+)')/i)?.slice(1).find(Boolean)).sort(),
    ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
  );
  assert.ok(unitButtons.every((tag) => hasAttribute(tag, "aria-controls", "course-detail")));
  assert.ok(unitButtons.every((tag) => /\baria-pressed=(?:"(?:true|false)"|'(?:true|false)')/i.test(tag)));
  assert.equal(unitButtons.filter((tag) => hasAttribute(tag, "aria-pressed", "true")).length, 1);

  const detail = openingTags("div", "id").find((tag) => hasAttribute(tag, "id", "course-detail"))
    ?? openingTags("section", "id").find((tag) => hasAttribute(tag, "id", "course-detail"));
  assert.ok(detail, "missing #course-detail pane");
  assert.match(homepage, /course-detail/);
  assert.match(homepage, /aria-labelledby/);
  assert.match(clientScript, /querySelectorAll\(\s*["'][^"']*course-unit/);
  assert.match(clientScript, /ArrowDown/);
  assert.match(clientScript, /ArrowUp/);
});

test("open lab provides a concise interactive classification challenge", () => {
  const answerButtons = openingTags("button", "data-lab-answer");
  assert.equal(answerButtons.length, 2);
  assert.deepEqual(
    answerButtons.map((tag) => tag.match(/\bdata-lab-answer=(?:"([^"]+)"|'([^']+)')/i)?.slice(1).find(Boolean)).sort(),
    ["assumption", "evidence"]
  );
  assert.ok(answerButtons.every((tag) => /\baria-pressed=(?:"false"|'false')/i.test(tag)));
  assert.match(homepage, /id="claim-feedback"[^>]*aria-live="polite"/i);
  assert.match(homepage, /id="claim-next"/i);
  assert.match(clientScript, /const labClaims\s*=/);
  assert.match(clientScript, /data-lab-answer/);
  assert.match(clientScript, /renderClaim\(\)/);
  assert.doesNotMatch(homepage, /class="evidence-chart"/);
  assert.doesNotMatch(homepage, /id="course-sketch"/);
});

test("free access does not regress to legacy prices or checkout behavior", () => {
  const forbidden = [
    "$9",
    "$19",
    "$39",
    "$69",
    "Preparing checkout",
    "Choose Course Trial",
    "Choose Starter",
    "Choose Standard",
    "Choose Premium",
    "buy.stripe.com",
    "/api/stripe",
    "apiBuy(",
    "apiConfirmCheckout(",
  ];
  for (const text of forbidden) {
    assert.equal(homepage.includes(text), false, `legacy payment behavior remains: ${text}`);
  }

  assert.equal(homepage.includes("$0"), false, "free experience still looks like a zero-dollar pricing tier");
  assert.match(homepage, /data-i18n="lab\.heading"/);
  assert.match(homepage, /data-i18n="lab\.primary"/);
});

test("the embedded chart lab receives and applies the Korean locale", () => {
  assert.match(homepage, /frameUrl\.searchParams\.set\(\s*["']lang["']/);
  assert.match(chartLab, /new URLSearchParams\(location\.search\)/);
  assert.match(chartLab, /pageParams\.get\(["']lang["']\)\s*===\s*["']ko["']/);
  assert.match(chartLab, /document\.documentElement\.lang\s*=/);
  assert.match(chartLab, /과거 차트 추론 연습/);
  assert.match(chartLab, /과거 캔들 열기/);
  assert.match(chartLab, /키보드 대체 기능/);
});
