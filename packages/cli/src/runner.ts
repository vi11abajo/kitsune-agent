import { allToolSpecs, type ToolContext } from '@kitsune/agent-core';

const TOOL_MAP = new Map(allToolSpecs().map(t => [t.name, t]));

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const tool = TOOL_MAP.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.handler(args, ctx);
}
