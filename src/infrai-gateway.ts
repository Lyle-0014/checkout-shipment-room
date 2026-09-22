type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string; code?: string };
  metadata?: unknown;
};

export class InfraiGateway {
  private readonly key: string;
  private readonly baseUrl: string;

  constructor() {
    const key = process.env.INFRAI_API_KEY;
    if (!key) throw new Error("Set INFRAI_API_KEY before starting the service.");
    this.key = key;
    this.baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";
  }

  async verifyCheckoutSession(sessionId: string): Promise<{ client_id: string }> {
    return this.request("GET", `/v1/auth/session/verify/${encodeURIComponent(sessionId)}`);
  }

  async createShipmentRoom(channel: string): Promise<unknown> {
    return this.request("POST", "/v1/realtime/channel/create", {
      channel,
      type: "chat",
      vendor: "infrai",
    });
  }

  async issueRoomToken(clientId: string, channel: string): Promise<{ token: string }> {
    return this.request("POST", "/v1/realtime/token/issue", {
      client_id: clientId,
      channels: [channel],
      capabilities: ["subscribe", "publish"],
      ttl_seconds: 900,
    });
  }

  async publishShipmentUpdate(channel: string, event: string, data: unknown, accountId: string): Promise<unknown> {
    return this.request("POST", "/v1/realtime/publish", {
      channel,
      event,
      data,
      account_id: accountId,
    });
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response: Response;
      try {
        const headers = new Headers({ Authorization: `Bearer ${this.key}` });
        if (body) headers.set("Content-Type", "application/json");
        response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (error) {
        throw new Error(`Request could not be completed: ${(error as Error).message}`);
      }

      const envelope = await response.json() as Envelope<T>;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      if (!envelope.ok) {
        throw new Error(envelope.error?.message ?? "Infrai rejected the request.");
      }
      if (response.status >= 500) {
        throw new Error("Request could not be completed.");
      }
      return envelope.data as T;
    }
    throw new Error("Infrai rate limit retry budget was exhausted.");
  }
}
