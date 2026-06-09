export class KitsuneApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'KitsuneApiError';
  }
}

export function normalizeResponse(data: unknown): unknown {
  return data; // pass-through; Kitsune endpoints already return clean JSON
}
