import roundsData from "@/public/rounds.json";

export const SIMULATION_BUDGET = 100;
export const CERTIFICATE_NET_PROFIT = 1_000;
export const CERTIFICATE_MIN_ROUNDS = 25;

type OptionType = "call" | "put";
type Candle = [number, number, number, number, number];
type Dataset = {
  history_frac: number;
  rounds: Array<{ asset: string; candles: Candle[] }>;
};

export type VerifiedOptionOutcome = {
  roundIndex: number;
  symbol: string;
  optionType: OptionType;
  budget: number;
  strike: number;
  premium: number;
  closingPrice: number;
  finalValue: number;
  profitLoss: number;
};

export type PortfolioRow = {
  optionBudget: number | null;
  optionFinalValue: number | null;
  optionProfitLoss: number | null;
};

const dataset = roundsData as unknown as Dataset;

function moneyPrecision(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateVerifiedOptionOutcome(
  roundIndex: number,
  optionType: OptionType
): VerifiedOptionOutcome {
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex >= dataset.rounds.length) {
    throw new RangeError("Invalid round index");
  }
  if (optionType !== "call" && optionType !== "put") {
    throw new TypeError("Invalid option type");
  }

  const round = dataset.rounds[roundIndex];
  const splitIndex = Math.floor(round.candles.length * dataset.history_frac);
  const strike = Number(round.candles[splitIndex - 1]?.[3]);
  const closingPrice = Number(round.candles.at(-1)?.[3]);
  if (!(strike > 0) || !(closingPrice > 0)) throw new TypeError("Round price data is invalid");

  const premium = Math.max(0.01, strike * 0.05);
  const intrinsic =
    optionType === "call"
      ? Math.max(0, closingPrice - strike)
      : Math.max(0, strike - closingPrice);
  const finalValue = (SIMULATION_BUDGET / premium) * intrinsic;

  return {
    roundIndex,
    symbol: round.asset,
    optionType,
    budget: SIMULATION_BUDGET,
    strike: moneyPrecision(strike),
    premium: moneyPrecision(premium),
    closingPrice: moneyPrecision(closingPrice),
    finalValue: moneyPrecision(finalValue),
    profitLoss: moneyPrecision(finalValue - SIMULATION_BUDGET),
  };
}

export function summarizePortfolio(rows: PortfolioRow[]) {
  const completed = rows.filter(
    (row) => row.optionBudget !== null && row.optionFinalValue !== null && row.optionProfitLoss !== null
  );
  const deployed = moneyPrecision(completed.reduce((sum, row) => sum + Number(row.optionBudget), 0));
  const endingValue = moneyPrecision(
    completed.reduce((sum, row) => sum + Number(row.optionFinalValue), 0)
  );
  const netProfitLoss = moneyPrecision(
    completed.reduce((sum, row) => sum + Number(row.optionProfitLoss), 0)
  );
  const profitableRounds = completed.filter((row) => Number(row.optionProfitLoss) > 0).length;
  const certificateEligible =
    completed.length >= CERTIFICATE_MIN_ROUNDS && netProfitLoss >= CERTIFICATE_NET_PROFIT;

  return {
    rounds: completed.length,
    deployed,
    endingValue,
    netProfitLoss,
    profitableRounds,
    certificateEligible,
    certificateThreshold: CERTIFICATE_NET_PROFIT,
    certificateMinRounds: CERTIFICATE_MIN_ROUNDS,
  };
}
