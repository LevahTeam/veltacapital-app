(function exposeLearningApi(root, createApi) {
  const learningApi = createApi();
  if (typeof module === "object" && module.exports) {
    module.exports = learningApi;
  }
  root.VeltaLearning = learningApi;
})(typeof globalThis === "undefined" ? this : globalThis, function createLearningApi() {
  "use strict";

  function positiveNumber(value, label) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new TypeError(label + " must be a positive finite number");
    }
    return parsed;
  }

  function predictionArrays(input) {
    const guesses = input?.guesses;
    const actuals = input?.actuals;
    if (!Array.isArray(guesses) || !Array.isArray(actuals) || guesses.length === 0) {
      throw new TypeError("guesses and actuals must be non-empty arrays");
    }
    if (guesses.length !== actuals.length) {
      throw new RangeError("guesses and actuals must have the same length");
    }
    return { guesses, actuals };
  }

  function movement(end, start) {
    if (end > start) return "up";
    if (end < start) return "down";
    return "flat";
  }

  function calculatePredictionScore(input) {
    const { guesses, actuals } = predictionArrays(input);
    const bandFraction = positiveNumber(input.bandFraction, "bandFraction");
    const startValue = positiveNumber(input.startValue, "startValue");
    const totals = { shape: 0, relativeError: 0, inBand: 0 };

    guesses.forEach((guessValue, index) => {
      const guess = positiveNumber(guessValue, "guess");
      const actual = positiveNumber(actuals[index], "actual");
      const distance = Math.abs(guess - actual);
      const tolerance = actual * bandFraction;
      totals.inBand += distance <= tolerance ? 1 : 0;
      totals.shape += Math.max(0, 1 - distance / (tolerance * 3));
      totals.relativeError += distance / actual;
    });

    const actualDirection = movement(actuals.at(-1), startValue);
    const guessedDirection = movement(guesses.at(-1), startValue);

    return {
      pathScore: Math.round((totals.shape / guesses.length) * 100),
      meanErrorPct: (totals.relativeError / guesses.length) * 100,
      inBand: totals.inBand,
      total: guesses.length,
      actualDirection,
      guessedDirection,
      directionCorrect: actualDirection === guessedDirection,
    };
  }

  function calculateOptionOutcome(input) {
    const type = input?.type;
    if (type !== "call" && type !== "put") {
      throw new TypeError("type must be call or put");
    }

    const strike = positiveNumber(input.strike, "strike");
    const closingPrice = positiveNumber(input.closingPrice, "closingPrice");
    const premium = positiveNumber(input.premium, "premium");
    const budget = positiveNumber(input.budget, "budget");
    const priceDifference = type === "call" ? closingPrice - strike : strike - closingPrice;
    const intrinsicPerShare = Math.max(0, priceDifference);
    const finalValue = (budget / premium) * intrinsicPerShare;
    const profitLoss = finalValue - budget;

    return {
      intrinsicPerShare,
      finalValue,
      profitLoss,
      isInTheMoney: intrinsicPerShare > 0,
      isProfitable: profitLoss > 0,
    };
  }

  return { calculatePredictionScore, calculateOptionOutcome };
});
