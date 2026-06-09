import type { ToolSpec } from './types.js';

export function registerNotificationTools(): ToolSpec[] {
  return [
    {
      name: 'notifications_get_telegram_status', title: 'Telegram Status', module: 'notifications', isWrite: false, auth: 'jwt',
      description: 'Check whether a Telegram account is linked for notifications.',
      inputSchema: { type: 'object', properties: {} },
      handler: async (_a, ctx) => ctx.client.authedGet('/notifications/telegram/status'),
    },
    {
      name: 'notifications_get_preferences', title: 'Get Notification Preferences', module: 'notifications', isWrite: false, auth: 'jwt',
      description: 'List notification preferences (the global default plus any per-strategy overrides).',
      inputSchema: { type: 'object', properties: {} },
      handler: async (_a, ctx) => ctx.client.authedGet('/notifications/preferences'),
    },
    {
      name: 'notifications_set_preferences', title: 'Set Notification Preferences', module: 'notifications', isWrite: true, auth: 'jwt',
      description: 'Upsert a notification preference. Omit strategyId (or pass null) for the global default; pass a strategyId (strategy UUID) for a per-strategy override. notify* flags default to true.',
      inputSchema: {
        type: 'object',
        properties: {
          strategyId: { type: 'string', description: 'strategy UUID for per-strategy prefs; omit or null for global' },
          notifyBuy: { type: 'boolean' },
          notifySell: { type: 'boolean' },
          notifyError: { type: 'boolean' },
          notifyLowBalance: { type: 'boolean' },
        },
      },
      handler: async (a, ctx) => ctx.client.authedSend('PUT', '/notifications/preferences', a),
    },
    {
      name: 'notifications_unlink_telegram', title: 'Unlink Telegram', module: 'notifications', isWrite: true, auth: 'jwt',
      description: 'Unlink your Telegram account from notifications. [CAUTION] Stops all Telegram alerts.',
      inputSchema: { type: 'object', properties: {} },
      handler: async (_a, ctx) => ctx.client.authedSend('DELETE', '/notifications/telegram'),
    },
  ];
}
