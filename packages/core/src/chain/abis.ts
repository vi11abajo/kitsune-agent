export const VAULT_FACTORY_ABI = [
  {
    type: 'function', name: 'createVault', stateMutability: 'nonpayable',
    inputs: [{ name: 'dexRouter', type: 'address' }, { name: 'oracle', type: 'address' }],
    outputs: [{ name: 'vault', type: 'address' }],
  },
  {
    type: 'function', name: 'getVault', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'vault', type: 'address' }],
  },
  {
    type: 'function', name: 'isVault', stateMutability: 'view',
    inputs: [{ name: 'vault', type: 'address' }], outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Struct field order MUST match contracts/src/interfaces/IUserVault.sol:9-21
const STRATEGY_CONFIG_TUPLE = {
  name: 'config', type: 'tuple',
  components: [
    { name: 'baseToken', type: 'address' },
    { name: 'takeProfitBps', type: 'uint16' },
    { name: 'stopLossBps', type: 'uint16' },
    { name: 'maxDcaCount', type: 'uint8' },
    { name: 'maxTradesPerDay', type: 'uint8' },
    { name: 'active', type: 'bool' },
    { name: 'quoteToken', type: 'address' },
    { name: 'allowedExecutor', type: 'address' },
    { name: 'firstBuyAmount', type: 'uint256' },
    { name: 'maxPositionSize', type: 'uint256' },
    { name: 'dcaMultiplier', type: 'uint256' },
  ],
} as const;

export const USER_VAULT_ABI = [
  {
    type: 'function', name: 'createStrategy', stateMutability: 'nonpayable',
    inputs: [STRATEGY_CONFIG_TUPLE], outputs: [{ name: 'strategyId', type: 'uint256' }],
  },
  {
    type: 'function', name: 'updateStrategy', stateMutability: 'nonpayable',
    inputs: [{ name: 'strategyId', type: 'uint256' }, STRATEGY_CONFIG_TUPLE], outputs: [],
  },
  {
    type: 'function', name: 'pauseStrategy', stateMutability: 'nonpayable',
    inputs: [{ name: 'strategyId', type: 'uint256' }], outputs: [],
  },
  {
    type: 'function', name: 'resumeStrategy', stateMutability: 'nonpayable',
    inputs: [{ name: 'strategyId', type: 'uint256' }], outputs: [],
  },
  {
    type: 'function', name: 'withdrawStrategy', stateMutability: 'nonpayable',
    inputs: [{ name: 'strategyId', type: 'uint256' }], outputs: [],
  },
  {
    type: 'function', name: 'withdraw', stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [],
  },
  {
    type: 'function', name: 'getStrategyCount', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
