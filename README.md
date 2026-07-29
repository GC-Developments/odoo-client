# odoo-client-api

Lightweight, modern TypeScript client for connecting Node.js/Browser projects to the Odoo API via the `/json/2`
protocol (Bearer token authentication).

Source code: [github.com/GC-Developments/odoo-client](https://github.com/GC-Developments/odoo-client)

## Installation

```bash
npm install odoo-client-api
```

## Usage

```ts
import {OdooClient} from "odoo-client-api";

const odoo = new OdooClient({
    url: "https://mycompany.odoo.com", // trailing slash optional
    db: "mycompany",
    apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    defaultLang: "fr_BE", // optional, defaults to "fr_BE"
});

const partners = await odoo.searchRead("res.partner", [["active", "=", true]], ["id", "name"]);
```

Every request automatically sends the `Authorization: Bearer <apiKey>` and `X-Odoo-Database: <db>` headers, and merges
`{ lang: defaultLang }` into the `context` (overridable per call).

## CRUD methods

```ts
searchRead<T>(model, domain ?, fields ?, options ? : {limit?, offset?, order?, context?})
:
Promise<T[]>
read<T>(model, ids, fields ?, context ?)
:
Promise<T[]>
create<T>(model, vals, context ?)
:
Promise<T>
write(model, ids, vals, context ?)
:
Promise<boolean>
unlink(model, ids, context ?)
:
Promise<boolean>
```

### `domain` filters

A `domain` is an array of `[field, operator, value]` conditions, combinable with the prefixed logical operators `"&"`,
`"|"`, `"!"` (Odoo's polish notation).

```ts
// active partners named "Acme"
await odoo.searchRead("res.partner", [
    ["name", "=", "Acme"],
    ["active", "=", true],
]);

// name containing "Acme" OR email containing "acme.com"
await odoo.searchRead("res.partner", [
    "|",
    ["name", "ilike", "Acme"],
    ["email", "ilike", "acme.com"],
]);
```

### `create()`: a single record or a batch (`vals_list`)

Pass a single object to create one record, or an array for a batch — the client automatically picks between `vals` and
`vals_list`:

```ts
const id = await odoo.create("res.partner", {name: "Acme Corp"}); // -> number

const ids = await odoo.create("res.partner", [
    {name: "Acme Corp"},
    {name: "Globex Corp"},
]); // -> number[]
```

### Generic call (`call`)

For anything not covered by a shortcut (a custom method on a model, `search_count`, `name_search`, ...):

```ts
const count = await odoo.call<number>("res.partner", {
    action: "search_count",
    domain: [["active", "=", true]],
});
```

## Error handling

```ts
import {OdooError, OdooAuthError, OdooNetworkError} from "odoo-client-api";

try {
    await odoo.write("res.partner", [1], {name: "New Name"});
} catch (err) {
    if (err instanceof OdooAuthError) {
        // invalid/expired API key (HTTP 401/403), err.status is available
    } else if (err instanceof OdooNetworkError) {
        // fetch failed (network, timeout) or the response wasn't JSON, err.cause is available
    } else if (err instanceof OdooError) {
        // Odoo-side rejection (validation, access rights, ...)
    }
}
```

## Configuration (`OdooClientConfig`)

| Option        | Type           | Required | Description                                                  |
|---------------|----------------|----------|--------------------------------------------------------------|
| `url`         | `string`       | yes      | Base URL of the Odoo instance                                |
| `db`          | `string`       | yes      | Database name, sent via `X-Odoo-Database`                    |
| `apiKey`      | `string`       | yes      | Odoo API key, sent as a Bearer token                         |
| `defaultLang` | `string`       | no       | Default `context.lang` on every call (`"fr_BE"`)             |
| `fetchImpl`   | `typeof fetch` | no       | Custom `fetch` implementation (tests, non-standard runtimes) |

## Development

```bash
npm run build      # build ESM + CJS + .d.ts into dist/
npm test           # vitest test suite
npm run typecheck  # tsc --noEmit
```

For details aimed at AI agents, see [AGENTS.md](./AGENTS.md) and [llms.txt](./llms.txt).

## License

[MIT](./LICENSE)
