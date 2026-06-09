import { describe, it, expect } from 'vitest';
import { encodeFunctionData } from 'viem';
import { USER_VAULT_ABI } from '../src/chain/abis.js';
import { toStrategyTuple, type StrategyConfigInput } from '../src/chain/strategy-config.js';

describe('strategy config encoding', () => {
  const input: StrategyConfigInput = {
    baseToken: '0x0000000000000000000000000000000000000010',
    quoteToken: '0x0000000000000000000000000000000000000020',
    allowedExecutor: '0x0000000000000000000000000000000000000030',
    takeProfitBps: 500,
    stopLossBps: 1000,
    maxDcaCount: 5,
    maxTradesPerDay: 3,
    active: true,
    firstBuyAmount: '1000000',
    maxPositionSize: '5000000',
    dcaMultiplier: '1500000000000000000',
  };

  it('maps fields to the struct order from IUserVault.sol', () => {
    const tuple = toStrategyTuple(input);
    expect(tuple.baseToken).toBe(input.baseToken);
    expect(tuple.dcaMultiplier).toBe(1500000000000000000n);
    expect(tuple.firstBuyAmount).toBe(1000000n);
    expect(tuple.takeProfitBps).toBe(500);
  });

  it('produces deterministic calldata for createStrategy', () => {
    const data = encodeFunctionData({ abi: USER_VAULT_ABI, functionName: 'createStrategy', args: [toStrategyTuple(input)] });
    expect(data.startsWith('0x')).toBe(true);
    const data2 = encodeFunctionData({ abi: USER_VAULT_ABI, functionName: 'createStrategy', args: [toStrategyTuple(input)] });
    expect(data).toBe(data2);
  });
});
