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

function toCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function roundAt(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= dataset.rounds.length) {
    throw new RangeError("Invalid round index");
  }
  return dataset.rounds[index];
}

function validOptionType(value: string): value is OptionType {
  return value === "call" || value === "put";
}

function closingValue(candle: Candle | undefined) {
  const value = Number(candle?.[3]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError("Round price data is invalid");
  }
  return value;
}

function intrinsicValue(type: OptionType, strike: number, close: number) {
  const difference = type === "call" ? close - strike : strike - close;
  return Math.max(0, difference);
}

export function calculateVerifiedOptionOutcome(
  roundIndex: number,
  optionType: OptionType
): VerifiedOptionOutcome {
  if (!validOptionType(optionType)) {
    throw new TypeError("Invalid option type");
  }

  const round = roundAt(roundIndex);
  const splitIndex = Math.floor(round.candles.length * dataset.history_frac);
  const strike = closingValue(round.candles[splitIndex - 1]);
  const closingPrice = closingValue(round.candles.at(-1));
  const premium = Math.max(0.01, strike * 0.05);
  const contracts = SIMULATION_BUDGET / premium;
  const finalValue = contracts * intrinsicValue(optionType, strike, closingPrice);

  return {
    roundIndex,
    symbol: round.asset,
    optionType,
    budget: SIMULATION_BUDGET,
    strike: toCurrency(strike),
    premium: toCurrency(premium),
    closingPrice: toCurrency(closingPrice),
    finalValue: toCurrency(finalValue),
    profitLoss: toCurrency(finalValue - SIMULATION_BUDGET),
  };
}

function isCompletedRow(row: PortfolioRow) {
  return (
    row.optionBudget !== null &&
    row.optionFinalValue !== null &&
    row.optionProfitLoss !== null
  );
}

export function summarizePortfolio(rows: PortfolioRow[]) {
  const totals = rows.reduce(
    (summary, row) => {
      if (!isCompletedRow(row)) return summary;
      summary.rounds += 1;
      summary.deployed += Number(row.optionBudget);
      summary.endingValue += Number(row.optionFinalValue);
      summary.netProfitLoss += Number(row.optionProfitLoss);
      if (Number(row.optionProfitLoss) > 0) summary.profitableRounds += 1;
      return summary;
    },
    { rounds: 0, deployed: 0, endingValue: 0, netProfitLoss: 0, profitableRounds: 0 }
  );

  const deployed = toCurrency(totals.deployed);
  const endingValue = toCurrency(totals.endingValue);
  const netProfitLoss = toCurrency(totals.netProfitLoss);
  const certificateEligible =
    totals.rounds >= CERTIFICATE_MIN_ROUNDS && netProfitLoss >= CERTIFICATE_NET_PROFIT;

  return {
    rounds: totals.rounds,
    deployed,
    endingValue,
    netProfitLoss,
    profitableRounds: totals.profitableRounds,
    certificateEligible,
    certificateThreshold: CERTIFICATE_NET_PROFIT,
    certificateMinRounds: CERTIFICATE_MIN_ROUNDS,
  };
}
