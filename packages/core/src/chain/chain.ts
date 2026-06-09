import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { PHAROS_ATLANTIC, ADDRESSES } from '../constants.js';
import { VAULT_FACTORY_ABI, USER_VAULT_ABI } from './abis.js';
import { toStrategyTuple, type StrategyConfigInput } from './strategy-config.js';

export class KitsuneChain {
  public readonly publicClient: PublicClient;
  private readonly wallet?: WalletClient;
  private readonly account?: PrivateKeyAccount;

  constructor(opts: { rpcUrl: string; privateKey?: `0x${string}` }) {
    this.publicClient = createPublicClient({ chain: PHAROS_ATLANTIC, transport: http(opts.rpcUrl) });
    if (opts.privateKey) {
      this.account = privateKeyToAccount(opts.privateKey);
      this.wallet = createWalletClient({ account: this.account, chain: PHAROS_ATLANTIC, transport: http(opts.rpcUrl) });
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
      address: ADDRESSES.vaultFactory,
      abi: VAULT_FACTORY_ABI,
      functionName: 'getVault',
      args: [owner],
    });
  }

  async createVault(dexRouter: Address, oracle: Address): Promise<`0x${string}`> {
    const { wallet, account } = this.requireWallet();
    return wallet.writeContract({
      address: ADDRESSES.vaultFactory,
      abi: VAULT_FACTORY_ABI,
      functionName: 'createVault',
      args: [dexRouter, oracle],
      account,
      chain: PHAROS_ATLANTIC,
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
      chain: PHAROS_ATLANTIC,
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
      chain: PHAROS_ATLANTIC,
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
      chain: PHAROS_ATLANTIC,
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
      chain: PHAROS_ATLANTIC,
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
      chain: PHAROS_ATLANTIC,
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
      chain: PHAROS_ATLANTIC,
    });
  }
}
