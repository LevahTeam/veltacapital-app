import { readFile, writeFile } from "node:fs/promises";

const courseUrl = new URL("../public/course.json", import.meta.url);
const course = JSON.parse(await readFile(courseUrl, "utf8"));

course.author = "VeltaCapital educational team";
course.reviewStatus = "Draft curriculum. Independent professional review is required before formal classroom use.";
course.updatedAt = "2026-09-05";
course.note =
  "Educational content only, not financial, investment, tax, or legal advice. Verify time-sensitive figures with primary sources. Historical examples do not predict future results.";

const enhancements = {
  1: ["Explain what a share represents and separate a company from its market price.", "Describe three factors that could change a market participant's valuation without claiming one caused a particular trade.", "Why can a company's stock fall even when its current earnings increased?"],
  2: ["Describe exchanges, orders, indices, and trading sessions without relying on stale figures.", "Compare a market order and limit order using a hypothetical spread.", "What information does an index omit about an individual company?"],
  3: ["Compare stocks, funds, and derivatives by structure and risk, not promised return.", "Read two current fund prospectuses and identify fees, concentration, and tracking method.", "Why is a dividend or growth label not a forecast?"],
  4: ["Explain compounding assumptions and the personal constraints that precede investing.", "Change return, inflation, and fee assumptions in a compounding illustration.", "Which assumptions make a compound-growth example differ from real life?"],
  5: ["Evaluate a broker using current primary documentation and regulatory information.", "Create a comparison checklist without ranking or endorsing providers.", "Why can simulated execution differ from a real fill?"],
  6: ["Distinguish primary filings, market data, news, and commentary.", "Trace one financial claim back to an SEC filing or issuer document.", "Which source should verify a company's reported revenue?"],
  7: ["Read OHLCV, trend, range, levels, and moving averages as descriptions rather than causes.", "Annotate one chart and write both supporting and contradicting evidence.", "What can volume show, and what can it not reveal?"],
  8: ["Use market vocabulary precisely and recognize where definitions depend on convention.", "Rewrite a market headline using neutral, measurable language.", "What is the difference between volatility and permanent loss?"],
  9: ["Use financial statements and filings to form questions about a business.", "Locate revenue, cash flow, and debt in a current filing.", "Why can earnings and cash flow tell different stories?"],
  10: ["Explain how technical indicators transform historical data and why testing choices matter.", "Define one pattern mechanically, then list its failure modes and a baseline comparison.", "Why does naming a pattern not establish predictive power?"],
  11: ["Distinguish risk capacity, probability, payoff, diversification, liquidity, and execution risk.", "Build a scenario table that includes gaps and correlated losses.", "Why is a favorable payoff ratio incomplete without probability?"],
  12: ["Recognize overconfidence, selection bias, social proof, and hindsight bias.", "Keep a prediction journal that records evidence before the outcome is known.", "How can a correct prediction still reflect weak reasoning?"],
  13: ["Explain diversification and allocation without prescribing a universal portfolio.", "Compare two hypothetical allocations under different goals and liquidity needs.", "Why is the same allocation not appropriate for every person?"],
  14: ["Identify when tax information is time-sensitive and requires primary guidance.", "Find the current official publication relevant to a hypothetical question.", "Why should a course avoid hard-coding tax rates as personal advice?"],
  15: ["Create a continued-learning plan centered on sources, reflection, and uncertainty.", "Write a four-week education plan with no requirement to open or fund an account.", "What evidence would show that your reasoning improved rather than your luck?"],
};

for (const chapter of course.chapters) {
  const [objective, practice, assessment] = enhancements[chapter.n];
  chapter.objective = objective;
  chapter.practice = practice;
  chapter.assessment = assessment;
}

const replacement = new Map([
  ["1|Why do stocks go up and down?", "Trades occur when buyers and sellers agree on a price. Prices change as market participants update expectations about cash flows, risk, interest rates, liquidity, and many other factors. A chart records the resulting transactions; it does not reveal a single motive shared by all participants."],
  ["3|Growth, value, and dividend stocks", "Labels such as growth, value, and dividend describe characteristics, not guaranteed outcomes. Growth companies can be especially sensitive to missed expectations. Value depends on an estimate that can be wrong, and dividends can be reduced or suspended. Use current filings and diversified evidence rather than relying on a label or example ticker."],
  ["3|Mutual funds", "Mutual funds transact at an end-of-day net asset value, while ETFs trade throughout the day. Either structure can be active or index-based and either can be low-cost or expensive. The choice depends on fees, taxes, available accounts, liquidity, and investor needs."],
  ["4|Realistic starting points", "There is no universal minimum that makes investing appropriate. Before using real money, consider emergency savings, high-interest debt, time horizon, account eligibility, fees, diversification, and the possibility of loss. Historical and paper exercises can teach mechanics without financial exposure."],
  ["4|Time matters more than amount", "Compounding means returns can themselves earn returns, so time can have a large effect. Illustrations that assume a constant annual return are mathematical examples, not forecasts; real returns vary, losses occur, inflation matters, and taxes and fees can reduce results. Minors generally need an eligible adult-managed account and should involve a parent or guardian."],
  ["5|Top brokers for beginners", "Compare brokers using current primary information: registration and protections, total fees, execution quality, available investments, fractional-share rules, research, accessibility, customer support, data practices, and account restrictions. VeltaCapital does not endorse a broker."],
  ["5|Paper trading", "Paper trading can teach order mechanics without financial exposure, but simulated fills, emotions, liquidity, and costs differ from real markets. Time spent in a simulator does not establish readiness to invest or trade."],
  ["5|Account types", "Account types differ in eligibility, contribution limits, tax treatment, access, and withdrawal rules. These rules change. Consult current IRS publications and, when appropriate, a qualified tax professional; do not rely on a course example to choose an account."],
  ["6|TradingView: the charting standard", "Charting platforms provide price displays, indicators, drawing tools, screeners, alerts, and sometimes simulated trading. Features, delays, licensing, and prices change. Compare providers using current documentation and remember that more indicators do not necessarily produce better decisions."],
  ["7|Candlestick charts", "A candle shows the open-to-close relationship and its wicks show the period's high and low. A long upper or lower wick describes where prices traded during that period. Terms such as buying or selling pressure are interpretations, not direct observations of every participant's intent."],
  ["7|Volume", "Volume is the number of shares traded during a period. Relative volume can show that activity was unusual compared with a chosen baseline, but it does not establish who was informed, why they traded, or whether a price move will continue."],
  ["7|Time frames", "The same history can look different when aggregated into minutes, days, weeks, or months. Choose a timeframe that matches the question being studied and check whether conclusions depend on that choice. A chart alone cannot determine a suitable entry or exit for an individual."],
  ["7|Moving averages", "A moving average summarizes past prices over a chosen window and therefore lags the market. Common windows such as 20, 50, and 200 sessions are conventions, not natural laws. Crossovers describe how two lagging averages changed; usefulness varies across assets, costs, and regimes."],
  ["10|What it is", "Technical analysis studies historical price, volume, and derived indicators. Some practitioners use it to form hypotheses about future behavior, but results are uncertain and sensitive to definitions, costs, regimes, and testing choices. It should not be confused with causal analysis of a business or economy."],
  ["10|Key indicators", "Indicators transform historical data. RSI summarizes recent gains and losses; MACD compares exponential averages; Bollinger Bands place a volatility-based envelope around an average. Thresholds and crossovers are descriptive conventions, not automatic buy or sell signals. Evaluate any rule out of sample and include costs and failed signals."],
  ["10|Common chart patterns", "Pattern names such as cup and handle, head and shoulders, double bottom, flags, and triangles are human classifications with subjective boundaries. They can be useful vocabulary for describing structure, but reliability claims require clear definitions, broad out-of-sample testing, and comparisons with simple baselines."],
  ["11|The 1% rule for traders", "Position limits are risk controls, not guarantees of safety. A percentage rule does not address correlated positions, gaps, leverage, liquidity, taxes, or whether active trading is appropriate. Risk decisions depend on the entire portfolio and the person's circumstances."],
  ["11|Stop losses", "A stop order triggers when a specified price is reached, but the eventual execution price can be worse during a gap or fast market. Stops can reduce some risks while creating others, including premature exits. Understand order types and execution behavior before using them."],
  ["11|Risk/reward ratio", "A payoff ratio compares a stated downside with a stated upside, but it says nothing about their probabilities or whether the levels are realistic. Expected value requires both outcomes and probabilities, and even a positive estimate can be wrong."],
  ["12|The ten mistakes", "Common errors include using money needed soon, concentrating without understanding risk, acting on social-media claims, ignoring fees or taxes, confusing a company with its stock price, overconfidence after a lucky outcome, and treating historical averages as promises. Broad markets have recovered from past declines, but individual securities can suffer permanent loss and future recoveries are not guaranteed."],
  ["13|The simplest portfolio", "Broad index funds can provide diversification at relatively low cost, but no allocation is best for everyone. A suitable portfolio depends on goals, time horizon, income stability, liquidity needs, taxes, risk capacity, and available accounts. Fund construction, fees, tracking, and concentration should be checked using current documents."],
  ["14|Capital gains tax", "Tax treatment depends on jurisdiction, account type, holding period, income, asset, and current law. Rates and thresholds change, and special rules can apply. Use current tax-authority guidance and a qualified professional rather than a course summary for tax decisions."],
  ["15|Your action plan", "A learning plan can begin with terminology, primary-source research, historical exercises, and a journal that records evidence, uncertainty, and mistakes. Moving from education to a real account is a separate personal decision; VeltaCapital does not recommend a timeline, broker, fund, stock, or allocation. Minors should involve a parent or guardian."],
]);

for (const chapter of course.chapters) {
  for (const section of chapter.sections) {
    const revised = replacement.get(`${chapter.n}|${section.h}`);
    if (revised) section.p = revised;
  }
}

const chapter10 = course.chapters.find((chapter) => chapter.n === 10);
chapter10.summary =
  "Studying price and volume patterns while recognizing uncertainty, bias, and limited predictive evidence.";

await writeFile(courseUrl, `${JSON.stringify(course, null, 2)}\n`);
