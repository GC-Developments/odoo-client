import { OdooAuthError, OdooError, OdooNetworkError } from "./errors";
import type { OdooCallOptions, OdooClientConfig, OdooDomain } from "./types";

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return undefined;
  }
  const error = (payload as { error: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return JSON.stringify(error);
}

export class OdooClient {
  private readonly baseUrl: string;
  private readonly db: string;
  private readonly apiKey: string;
  private readonly defaultLang: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OdooClientConfig) {
    if (!config.url) throw new OdooError("OdooClientConfig.url is required");
    if (!config.db) throw new OdooError("OdooClientConfig.db is required");
    if (!config.apiKey) throw new OdooError("OdooClientConfig.apiKey is required");

    this.baseUrl = `${config.url.replace(/\/+$/, "")}/json/2`;
    this.db = config.db;
    this.apiKey = config.apiKey;
    this.defaultLang = config.defaultLang ?? "fr_BE";
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async call<T>(model: string, options: OdooCallOptions): Promise<T> {
    const { action, context, ...params } = options;
    if (!action) {
      throw new OdooError('OdooClient.call requires an "action" (e.g. "search_read", "create"...)');
    }

    const url = `${this.baseUrl}/${model}/${action}`;
    const body: Record<string, unknown> = {
      context: { lang: this.defaultLang, ...context },
    };
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) body[key] = value;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "X-Odoo-Database": this.db,
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new OdooNetworkError(`Network error while calling ${model}.${action}`, cause);
    }

    let payload: unknown;
    try {
      payload = response.status === 204 ? undefined : await response.json();
    } catch (cause) {
      throw new OdooNetworkError(`Failed to parse response from ${model}.${action}`, cause);
    }

    if (response.status === 401 || response.status === 403) {
      throw new OdooAuthError(
        extractErrorMessage(payload) ?? `Authentication failed calling ${model}.${action} (HTTP ${response.status})`,
        response.status,
      );
    }

    const errorMessage = extractErrorMessage(payload);
    if (errorMessage) {
      throw new OdooError(errorMessage);
    }

    if (!response.ok) {
      throw new OdooError(`Odoo call to ${model}.${action} failed with HTTP ${response.status}`);
    }

    return payload as T;
  }

  searchRead<T = Record<string, unknown>>(
    model: string,
    domain: OdooDomain = [],
    fields?: string[],
    options: Pick<OdooCallOptions, "limit" | "offset" | "order" | "context"> = {},
  ): Promise<T[]> {
    return this.call<T[]>(model, { action: "search_read", domain, fields, ...options });
  }

  read<T = Record<string, unknown>>(
    model: string,
    ids: number[],
    fields?: string[],
    context?: Record<string, unknown>,
  ): Promise<T[]> {
    return this.call<T[]>(model, { action: "read", ids, fields, context });
  }

  create<T = number | number[]>(
    model: string,
    vals: Record<string, unknown> | Record<string, unknown>[],
    context?: Record<string, unknown>,
  ): Promise<T> {
    const options: OdooCallOptions = Array.isArray(vals)
      ? { action: "create", vals_list: vals, context }
      : { action: "create", vals, context };
    return this.call<T>(model, options);
  }

  write(model: string, ids: number[], vals: Record<string, unknown>, context?: Record<string, unknown>): Promise<boolean> {
    return this.call<boolean>(model, { action: "write", ids, vals, context });
  }

  unlink(model: string, ids: number[], context?: Record<string, unknown>): Promise<boolean> {
    return this.call<boolean>(model, { action: "unlink", ids, context });
  }
}
