import { allToolSpecs, buildTools, DEFAULT_MODULES, type KitsuneConfig, type ToolContext } from '@kitsune-ai/agent-core';

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const config: Partial<KitsuneConfig> = ctx.config ?? {};
  // Same filtering the MCP server applies: --read-only strips write tools,
  // and a missing signer strips every tool that needs a private key.
  const allowed = buildTools({
    modules: config.modules ?? DEFAULT_MODULES,
    readOnly: config.readOnly ?? false,
    hasSigner: config.hasSigner,
  });
  const tool = allowed.find(t => t.name === name);
  if (tool) return tool.handler(args, ctx);

  // Not runnable — say why, distinguishing typos from policy blocks.
  const spec = allToolSpecs().find(t => t.name === name);
  if (!spec) throw new Error(`Unknown tool: ${name}`);
  if (config.readOnly && spec.isWrite) {
    throw new Error(`Blocked: ${name} is a write tool and --read-only is set`);
  }
  if (config.hasSigner === false && spec.auth !== 'none') {
    throw new Error(
      `Blocked: ${name} requires a private key (auth: ${spec.auth}) and no signer is configured — add private_key to ~/.kitsune/config.toml or set KITSUNE_PRIVATE_KEY`,
    );
  }
  throw new Error(`Blocked: ${name} — module "${spec.module}" is not enabled`);
}
