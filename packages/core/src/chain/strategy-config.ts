import type { Address } from 'viem';

export interface StrategyConfigInput {
  baseToken: Address;
  quoteToken: Address;
  allowedExecutor: Address;
  takeProfitBps: number;
  stopLossBps: number;
  maxDcaCount: number;
  maxTradesPerDay: number;
  active: boolean;
  firstBuyAmount: string; // base units, as decimal string
  maxPositionSize: string;
  dcaMultiplier: string; // 1e18-scaled multiplier, as decimal string
}

export interface StrategyTuple {
  baseToken: Address;
  takeProfitBps: number;
  stopLossBps: number;
  maxDcaCount: number;
  maxTradesPerDay: number;
  active: boolean;
  quoteToken: Address;
  allowedExecutor: Address;
  firstBuyAmount: bigint;
  maxPositionSize: bigint;
  dcaMultiplier: bigint;
}

export function toStrategyTuple(i: StrategyConfigInput): StrategyTuple {
  return {
    baseToken: i.baseToken,
    takeProfitBps: i.takeProfitBps,
    stopLossBps: i.stopLossBps,
    maxDcaCount: i.maxDcaCount,
    maxTradesPerDay: i.maxTradesPerDay,
    active: i.active,
    quoteToken: i.quoteToken,
    allowedExecutor: i.allowedExecutor,
    firstBuyAmount: BigInt(i.firstBuyAmount),
    maxPositionSize: BigInt(i.maxPositionSize),
    dcaMultiplier: BigInt(i.dcaMultiplier),
  };
}
