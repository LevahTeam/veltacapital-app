import test from "node:test";
import assert from "node:assert/strict";
import learningScore from "../public/assets/learning-score.js";

const { calculateOptionOutcome, calculatePredictionScore } = learningScore;

test("prediction score separates path accuracy from direction", () => {
  const result = calculatePredictionScore({
    guesses: [100, 101, 102, 103, 104],
    actuals: [100, 101, 102, 103, 104],
    startValue: 99,
    bandFraction: 0.05,
  });
  assert.equal(result.pathScore, 100);
  assert.equal(result.directionCorrect, true);
  assert.equal(result.inBand, 5);
  assert.equal(result.meanErrorPct, 0);
});

test("a reasonable path can score independently of the final direction", () => {
  const result = calculatePredictionScore({
    guesses: [99, 98, 97, 96, 95],
    actuals: [99, 98, 97, 96, 101],
    startValue: 100,
    bandFraction: 0.05,
  });
  assert.ok(result.pathScore >= 80);
  assert.equal(result.directionCorrect, false);
});

test("the previously observed put example is in the money, not worthless", () => {
  const result = calculateOptionOutcome({
    type: "put",
    strike: 746.74,
    closingPrice: 738.93,
    premium: 11.79,
    budget: 100,
  });
  assert.equal(result.isInTheMoney, true);
  assert.ok(result.intrinsicPerShare > 0);
  assert.ok(result.finalValue > 0);
  assert.equal(result.isProfitable, false);
});

test("in the money and profitable are not treated as synonyms", () => {
  const result = calculateOptionOutcome({
    type: "call",
    strike: 100,
    closingPrice: 101,
    premium: 5,
    budget: 100,
  });
  assert.equal(result.isInTheMoney, true);
  assert.equal(result.isProfitable, false);
  assert.equal(result.finalValue, 20);
  assert.equal(result.profitLoss, -80);
});
