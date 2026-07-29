# AGENTS.md — odoo-client-api

Guide for AI coding agents (Cursor, Copilot, Claude Code) using this library. See `llms.txt` for a terser machine-readable summary.

## What this is

A TypeScript client for Odoo's `/json/2` HTTP API (Bearer token auth). Works in Node.js and the browser. No dependencies beyond `fetch`.

## Instantiate

```ts
import { OdooClient } from "odoo-client-api";

const odoo = new OdooClient({
  url: "https://mycompany.odoo.com", // trailing slash optional
  db: "mycompany",
  apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  defaultLang: "fr_BE", // optional, defaults to "fr_BE"
});
```

Every request sends `Authorization: Bearer <apiKey>` and `X-Odoo-Database: <db>` headers, and merges `{ lang: defaultLang }` into `context` unless overridden.

## CRUD methods

```ts
searchRead<T>(model: string, domain?: OdooDomain, fields?: string[], options?: { limit?; offset?; order?; context? }): Promise<T[]>
read<T>(model: string, ids: number[], fields?: string[], context?: Record<string, unknown>): Promise<T[]>
create<T>(model: string, vals: Record<string, unknown> | Record<string, unknown>[], context?): Promise<T>
write(model: string, ids: number[], vals: Record<string, unknown>, context?): Promise<boolean>
unlink(model: string, ids: number[], context?): Promise<boolean>
```

For anything not covered by a shortcut, use the generic escape hatch:

```ts
call<T>(model: string, options: OdooCallOptions): Promise<T>
// options: { action, domain?, fields?, ids?, vals?, vals_list?, limit?, offset?, order?, context? }
```

`action` is the Odoo method name (`"search_count"`, `"name_search"`, or any custom model method).

## Odoo domain filters

A `domain` is an array of `[field, operator, value]` leaves, optionally combined with prefix logical operators `"&"`, `"|"`, `"!"` (Odoo's own polish notation — `&`/`|` apply to the next two terms, `!` negates the next one).

```ts
// active partners named "Acme"
await odoo.searchRead("res.partner", [["name", "=", "Acme"], ["active", "=", true]]);

// name contains "Acme" OR email contains "acme.com"
await odoo.searchRead("res.partner", [
  "|",
  ["name", "ilike", "Acme"],
  ["email", "ilike", "acme.com"],
]);
```

## create(): single vs. batch (`vals_list`)

Pass a single object for one record, or an array for a batch — the client picks `vals` vs `vals_list` automatically:

```ts
const id = await odoo.create("res.partner", { name: "Acme Corp" }); // -> number

const ids = await odoo.create("res.partner", [
  { name: "Acme Corp" },
  { name: "Globex Corp" },
]); // -> number[]
```

## Errors

- `OdooAuthError` — thrown on HTTP 401/403 (bad/expired API key). Has a `status` property.
- `OdooNetworkError` — thrown when `fetch` itself fails (offline, DNS, timeout) or the response body isn't valid JSON. Has a `cause`.
- `OdooError` — base class; also thrown when Odoo returns `{ error: ... }` in the response body, or on any other non-2xx HTTP status.

```ts
import { OdooError, OdooAuthError, OdooNetworkError } from "odoo-client-api";

try {
  await odoo.write("res.partner", [1], { name: "New Name" });
} catch (err) {
  if (err instanceof OdooAuthError) {
    // re-authenticate / refresh the API key
  } else if (err instanceof OdooNetworkError) {
    // retry / surface connectivity issue
  } else if (err instanceof OdooError) {
    // Odoo-side rejection (validation, access rights, ...)
  }
}
```

## Testing consumers of this library

`OdooClientConfig.fetchImpl` lets you inject a mock `fetch` instead of hitting a real Odoo instance — see `tests/client.test.ts` in this repo for the pattern.
