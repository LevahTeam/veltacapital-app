import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateVerifiedOptionOutcome,
  summarizePortfolio,
  CERTIFICATE_MIN_ROUNDS,
  CERTIFICATE_NET_PROFIT,
} from "../lib/simulationPortfolio";

test("server-owned round data produces a bounded $100 option record", () => {
  const result = calculateVerifiedOptionOutcome(0, "call");
  assert.equal(result.roundIndex, 0);
  assert.equal(result.optionType, "call");
  assert.equal(result.budget, 100);
  assert.ok(result.strike > 0);
  assert.ok(result.premium > 0);
  assert.ok(result.closingPrice > 0);
  assert.equal(result.profitLoss, Math.round((result.finalValue - 100) * 100) / 100);
});

test("invalid round indexes are rejected", () => {
  assert.throws(() => calculateVerifiedOptionOutcome(-1, "put"), /Invalid round index/);
  assert.throws(() => calculateVerifiedOptionOutcome(99_999, "call"), /Invalid round index/);
});

test("certificate requires both net profit and minimum rounds", () => {
  const profitableRow = { optionBudget: 100, optionFinalValue: 150, optionProfitLoss: 50 };
  const tooFew = summarizePortfolio(Array(CERTIFICATE_MIN_ROUNDS - 1).fill(profitableRow));
  assert.equal(tooFew.netProfitLoss >= CERTIFICATE_NET_PROFIT, true);
  assert.equal(tooFew.certificateEligible, false);

  const eligible = summarizePortfolio(Array(CERTIFICATE_MIN_ROUNDS).fill(profitableRow));
  assert.equal(eligible.netProfitLoss, 1_250);
  assert.equal(eligible.certificateEligible, true);
});
