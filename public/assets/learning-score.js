(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.VeltaLearning = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function finitePositive(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new TypeError(label + " must be a positive finite number");
    }
    return number;
  }

  function calculatePredictionScore(input) {
    const guesses = input && input.guesses;
    const actuals = input && input.actuals;
    if (!Array.isArray(guesses) || !Array.isArray(actuals) || guesses.length === 0) {
      throw new TypeError("guesses and actuals must be non-empty arrays");
    }
    if (guesses.length !== actuals.length) {
      throw new RangeError("guesses and actuals must have the same length");
    }

    const bandFraction = finitePositive(input.bandFraction, "bandFraction");
    const startValue = finitePositive(input.startValue, "startValue");
    let shapeTotal = 0;
    let errorTotal = 0;
    let inBand = 0;

    for (let i = 0; i < guesses.length; i += 1) {
      const guess = finitePositive(guesses[i], "guess");
      const actual = finitePositive(actuals[i], "actual");
      const distance = Math.abs(guess - actual);
      const tolerance = actual * bandFraction;
      if (distance <= tolerance) inBand += 1;
      shapeTotal += Math.max(0, 1 - distance / (tolerance * 3));
      errorTotal += distance / actual;
    }

    const actualEnd = actuals[actuals.length - 1];
    const guessEnd = guesses[guesses.length - 1];
    const actualDirection = actualEnd > startValue ? "up" : actualEnd < startValue ? "down" : "flat";
    const guessedDirection = guessEnd > startValue ? "up" : guessEnd < startValue ? "down" : "flat";

    return {
      pathScore: Math.round((shapeTotal / guesses.length) * 100),
      meanErrorPct: (errorTotal / guesses.length) * 100,
      inBand,
      total: guesses.length,
      actualDirection,
      guessedDirection,
      directionCorrect: actualDirection === guessedDirection,
    };
  }

  function calculateOptionOutcome(input) {
    const type = input && input.type;
    if (type !== "call" && type !== "put") throw new TypeError("type must be call or put");
    const strike = finitePositive(input.strike, "strike");
    const closingPrice = finitePositive(input.closingPrice, "closingPrice");
    const premium = finitePositive(input.premium, "premium");
    const budget = finitePositive(input.budget, "budget");

    const intrinsicPerShare =
      type === "call" ? Math.max(0, closingPrice - strike) : Math.max(0, strike - closingPrice);
    const shareEquivalent = budget / premium;
    const finalValue = shareEquivalent * intrinsicPerShare;
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
