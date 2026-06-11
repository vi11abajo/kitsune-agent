import type { ToolSpec } from './types.js';
import { registerMarketTools } from './market.js';
import { registerVaultTools } from './vault.js';
import { registerStrategyTools } from './strategy.js';
import { registerPortfolioTools } from './portfolio.js';
import { registerMarketplaceTools } from './marketplace.js';
import { registerExecutorTools } from './executor.js';
import { registerReferralTools } from './referral.js';
import { registerFeeTools } from './fees.js';
import { registerNotificationTools } from './notifications.js';
import { registerAgraTools } from './agra.js';

export function allToolSpecs(): ToolSpec[] {
  return [
    ...registerMarketTools(),
    ...registerVaultTools(),
    ...registerStrategyTools(),
    ...registerPortfolioTools(),
    ...registerMarketplaceTools(),
    ...registerExecutorTools(),
    ...registerReferralTools(),
    ...registerFeeTools(),
    ...registerNotificationTools(),
    ...registerAgraTools(),
  ];
}

export interface BuildToolsConfig {
  modules: string[];
  readOnly: boolean;
  hasSigner?: boolean;
}

export function buildTools(config: BuildToolsConfig): ToolSpec[] {
  const enabled = new Set(config.modules);
  let tools = allToolSpecs().filter(t => enabled.has(t.module));
  if (config.readOnly) tools = tools.filter(t => !t.isWrite);
  // No local signer → hide everything that needs a private key (jwt sign-in or on-chain tx).
  if (config.hasSigner === false) tools = tools.filter(t => t.auth === 'none');
  return tools;
}
