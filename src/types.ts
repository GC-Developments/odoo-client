export interface OdooClientConfig {
  /** Base URL of the Odoo instance, e.g. "https://mycompany.odoo.com". */
  url: string;
  /** Database name, sent via the X-Odoo-Database header. */
  db: string;
  /** Odoo API key, sent as a Bearer token. */
  apiKey: string;
  /** Default `context.lang` injected into every call. Defaults to "fr_BE". */
  defaultLang?: string;
  /** Override for `fetch`, e.g. for testing or non-standard runtimes. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

export type OdooDomainLeaf = [string, string, unknown];
export type OdooDomainOperator = "&" | "|" | "!";
export type OdooDomain = Array<OdooDomainLeaf | OdooDomainOperator>;

export interface OdooCallOptions {
  /** Odoo method name to call on the model, e.g. "search_read", "create". */
  action: string;
  domain?: OdooDomain;
  fields?: string[];
  ids?: number[];
  vals?: Record<string, unknown>;
  vals_list?: Record<string, unknown>[];
  limit?: number;
  offset?: number;
  order?: string;
  context?: Record<string, unknown>;
}
