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
import { chainFor, addressesFor, type ChainAddresses } from '../constants.js';
import { VAULT_FACTORY_ABI, USER_VAULT_ABI } from './abis.js';
import { toStrategyTuple, type StrategyConfigInput } from './strategy-config.js';

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
}
