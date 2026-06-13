import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { chainFor, addressesFor, ALLOWED_DODO_TARGETS, type ChainAddresses } from '../constants.js';
import { VAULT_FACTORY_ABI, USER_VAULT_ABI, ERC20_ABI, WRAPPED_NATIVE_ABI } from './abis.js';
import { toStrategyTuple, type StrategyConfigInput } from './strategy-config.js';

/** A DODO swap route the deposit flow will execute. Mirrors frontend/lib/dodo.ts. */
export interface DepositRoute {
  target: Address;
  callData: `0x${string}`;
  priceImpact?: number; // fraction, e.g. 0.05 = 5%
}

export type DepositToken = 'usdc' | 'wpros' | 'native' | Address;

export interface DepositResult {
  txHash: `0x${string}`; // final USDC transfer into the vault
  usdcDeposited: string; // base units actually transferred
  wrapTxHash?: `0x${string}`;
  swapTxHash?: `0x${string}`;
}

export class KitsuneChain {
  public readonly publicClient: PublicClient;
  public readonly chain: Chain;
  public readonly addresses: ChainAddresses;
  private readonly wallet?: WalletClient;
  private readonly account?: PrivateKeyAccount;

  constructor(opts: { rpcUrl: string; chainId: number; privateKey?: `0x${string}` }) {
    this.chain = chainFor(opts.chainId);
    this.addresses = addressesFor(opts.chainId);
    this.publicClient = createPublicClient({ chain: this.chain, transport: http(opts.rpcUrl) });
    if (opts.privateKey) {
      this.account = privateKeyToAccount(opts.privateKey);
      this.wallet = createWalletClient({ account: this.account, chain: this.chain, transport: http(opts.rpcUrl) });
    }
  }

  get address(): Address | undefined {
    return this.account?.address;
  }

  private requireWallet(): { wallet: WalletClient; account: PrivateKeyAccount } {
    if (!this.wallet || !this.account) throw new Error('No signer: add private_key to your profile');
    return { wallet: this.wallet, account: this.account };
  }

  async getVault(owner: Address): Promise<Address> {
    return this.publicClient.readContract({
      address: this.addresses.vaultFactory,
      abi: VAULT_FACTORY_ABI,
      functionName: 'getVault',
      args: [owner],
    });
  }

  async createVault(dexRouter?: Address, oracle?: Address): Promise<`0x${string}`> {
    const { wallet, account } = this.requireWallet();
    return wallet.writeContract({
      address: this.addresses.vaultFactory,
      abi: VAULT_FACTORY_ABI,
      functionName: 'createVault',
      args: [dexRouter ?? this.addresses.defaultDexRouter, oracle ?? this.addresses.defaultOracle],
      account,
      chain: this.chain,
    });
  }

  async createStrategy(vault: Address, config: StrategyConfigInput): Promise<`0x${string}`> {
    const { wallet, account } = this.requireWallet();
    return wallet.writeContract({
      address: vault,
      abi: USER_VAULT_ABI,
      functionName: 'createStrategy',
      args: [toStrategyTuple(config)],
      account,
      chain: this.chain,
    });
  }

  async updateStrategy(vault: Address, strategyId: bigint, config: StrategyConfigInput): Promise<`0x${string}`> {
    const { wallet, account } = this.requireWallet();
    return wallet.writeContract({
      address: vault,
      abi: USER_VAULT_ABI,
      functionName: 'updateStrategy',
      args: [strategyId, toStrategyTuple(config)],
      account,
      chain: this.chain,
    });
  }

  async withdrawStrategy(vault: Address, strategyId: bigint): Promise<`0x${string}`> {
    const { wallet, account } = this.requireWallet();
    return wallet.writeContract({
      address: vault,
      abi: USER_VAULT_ABI,
      functionName: 'withdrawStrategy',
      args: [strategyId],
      account,
      chain: this.chain,
    });
  }

  async pauseStrategy(vault: Address, strategyId: bigint): Promise<`0x${string}`> {
    const { wallet, account } = this.requireWallet();
    return wallet.writeContract({
      address: vault,
      abi: USER_VAULT_ABI,
      functionName: 'pauseStrategy',
      args: [strategyId],
      account,
      chain: this.chain,
    });
  }

  async resumeStrategy(vault: Address, strategyId: bigint): Promise<`0x${string}`> {
    const { wallet, account } = this.requireWallet();
    return wallet.writeContract({
      address: vault,
      abi: USER_VAULT_ABI,
      functionName: 'resumeStrategy',
      args: [strategyId],
      account,
      chain: this.chain,
    });
  }

  async withdraw(vault: Address, token: Address, amount: bigint): Promise<`0x${string}`> {
    const { wallet, account } = this.requireWallet();
    return wallet.writeContract({
      address: vault,
      abi: USER_VAULT_ABI,
      functionName: 'withdraw',
      args: [token, amount],
      account,
      chain: this.chain,
    });
  }

  /**
   * Fund a vault with USDC. Ports frontend/hooks/useDeposit.ts:
   *   - usdc            → approve(vault) + transfer(vault)
   *   - wpros / ERC-20  → approve(dodoApprove) → swap to USDC (DODO) → transfer(vault)
   *   - native (PROS)   → wrap (WPROS.deposit) → swap → transfer(vault)
   * `amount` is the input token's base units (for native: PROS wei). `getRoute` returns a fresh
   * DODO route per call so swap reverts can be retried with up-to-date pricing.
   */
  async deposit(opts: {
    vault: Address;
    token: DepositToken;
    amount: bigint;
    getRoute?: (fromToken: Address, fromAmount: bigint) => Promise<DepositRoute>;
  }): Promise<DepositResult> {
    const { wallet, account } = this.requireWallet();
    const usdc = this.addresses.usdc;
    const owner = account.address;

    // Resolve the input token → swap source, and whether a swap is needed.
    let tokenToSwap: Address;
    let needsSwap: boolean;
    let wrapTxHash: `0x${string}` | undefined;

    if (opts.token === 'native') {
      // Wrap native → WPROS first (1:1), then swap WPROS → USDC.
      const native = await this.publicClient.getBalance({ address: owner });
      if (opts.amount >= native) {
        throw new Error('Deposit would use your entire native balance — leave some PROS for gas.');
      }
      wrapTxHash = await wallet.writeContract({
        address: this.addresses.wrappedNative,
        abi: WRAPPED_NATIVE_ABI,
        functionName: 'deposit',
        value: opts.amount,
        account,
        chain: this.chain,
      });
      const wrapReceipt = await this.publicClient.waitForTransactionReceipt({ hash: wrapTxHash, confirmations: 1 });
      if (wrapReceipt.status !== 'success') throw new Error('Wrapping native token failed on-chain. No funds were swapped.');
      tokenToSwap = this.addresses.wrappedNative;
      needsSwap = true;
    } else {
      tokenToSwap = opts.token === 'usdc' ? usdc : opts.token === 'wpros' ? this.addresses.wrappedNative : opts.token;
      needsSwap = tokenToSwap.toLowerCase() !== usdc.toLowerCase();
    }

    let usdcAmount = opts.amount;
    let swapTxHash: `0x${string}` | undefined;

    if (needsSwap) {
      if (!opts.getRoute) throw new Error('A swap is required for this token but no DODO route provider was supplied.');
      const swapAmount = opts.amount;

      const usdcBefore = (await this.publicClient.readContract({
        address: usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [owner],
      })) as bigint;

      // Approve the DODO proxy to pull the input token (one-time if allowance is short).
      const swapAllowance = (await this.publicClient.readContract({
        address: tokenToSwap, abi: ERC20_ABI, functionName: 'allowance', args: [owner, this.addresses.dodoApprove],
      })) as bigint;
      if (swapAllowance < swapAmount) {
        const approveHash = await wallet.writeContract({
          address: tokenToSwap, abi: ERC20_ABI, functionName: 'approve',
          args: [this.addresses.dodoApprove, swapAmount], account, chain: this.chain,
        });
        await this.publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
      }

      // Fetch a fresh route and execute; retry once on revert (price moved).
      const MAX_ATTEMPTS = 2;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const route = await opts.getRoute(tokenToSwap, swapAmount);
        if (!ALLOWED_DODO_TARGETS.includes(route.target.toLowerCase())) {
          throw new Error(`Untrusted DODO route target: ${route.target}`);
        }
        if ((route.priceImpact ?? 0) > 0.05) {
          throw new Error(`Price impact too high (${(((route.priceImpact ?? 0)) * 100).toFixed(1)}%) — insufficient liquidity for this size.`);
        }
        swapTxHash = await wallet.sendTransaction({
          to: route.target, data: route.callData, account, chain: this.chain, gas: BigInt(1_500_000),
        });
        const swapReceipt = await this.publicClient.waitForTransactionReceipt({ hash: swapTxHash, confirmations: 1 });
        if (swapReceipt.status !== 'reverted') break;
        if (attempt === MAX_ATTEMPTS) throw new Error('Swap reverted on-chain due to price movement — please retry.');
      }

      const usdcAfter = (await this.publicClient.readContract({
        address: usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [owner],
      })) as bigint;
      usdcAmount = usdcAfter - usdcBefore;
      if (usdcAmount <= BigInt(0)) throw new Error('Swap completed but no USDC was received.');
    }

    // Transfer USDC into the vault (the vault credits whatever USDC it holds).
    const txHash = await wallet.writeContract({
      address: usdc, abi: ERC20_ABI, functionName: 'transfer', args: [opts.vault, usdcAmount], account, chain: this.chain,
    });
    await this.publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });

    return { txHash, usdcDeposited: usdcAmount.toString(), wrapTxHash, swapTxHash };
  }
}
