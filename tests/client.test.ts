import { describe, expect, it, vi } from "vitest";
import { OdooAuthError, OdooClient, OdooError, OdooNetworkError } from "../src/index";
import type { OdooClientConfig } from "../src/index";

function mockFetch(response: { status?: number; body?: unknown }) {
  const status = response.status ?? 200;
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => response.body,
  });
}

function buildClient(fetchMock: ReturnType<typeof vi.fn>, overrides: Partial<OdooClientConfig> = {}) {
  return new OdooClient({
    url: "https://example.odoo.com",
    db: "mydb",
    apiKey: "secret-key",
    fetchImpl: fetchMock as unknown as typeof fetch,
    ...overrides,
  });
}

describe("OdooClient", () => {
  it("sends the correct headers and URL", async () => {
    const fetchMock = mockFetch({ body: [{ id: 1, name: "Test" }] });
    const client = buildClient(fetchMock);

    await client.searchRead("res.partner", [["id", "=", 1]], ["id", "name"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.odoo.com/json/2/res.partner/search_read");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer secret-key",
      "X-Odoo-Database": "mydb",
    });
  });

  it("strips a trailing slash from the configured url", async () => {
    const fetchMock = mockFetch({ body: [] });
    const client = buildClient(fetchMock, { url: "https://example.odoo.com/" });

    await client.searchRead("res.partner");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.odoo.com/json/2/res.partner/search_read");
  });

  it("injects a default lang and merges caller-provided context", async () => {
    const fetchMock = mockFetch({ body: [] });
    const client = buildClient(fetchMock);

    await client.searchRead("res.partner", [], undefined, { context: { tz: "Europe/Brussels" } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.context).toEqual({ lang: "fr_BE", tz: "Europe/Brussels" });
  });

  it("respects a custom defaultLang", async () => {
    const fetchMock = mockFetch({ body: [] });
    const client = buildClient(fetchMock, { defaultLang: "en_US" });

    await client.read("res.partner", [1]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.context).toEqual({ lang: "en_US" });
  });

  it("serializes a single object as vals on create()", async () => {
    const fetchMock = mockFetch({ body: 42 });
    const client = buildClient(fetchMock);

    const result = await client.create("res.partner", { name: "Acme" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.vals).toEqual({ name: "Acme" });
    expect(body.vals_list).toBeUndefined();
    expect(result).toBe(42);
  });

  it("serializes an array as vals_list on create()", async () => {
    const fetchMock = mockFetch({ body: [10, 11] });
    const client = buildClient(fetchMock);

    const result = await client.create("res.partner", [{ name: "Acme" }, { name: "Globex" }]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.vals_list).toEqual([{ name: "Acme" }, { name: "Globex" }]);
    expect(body.vals).toBeUndefined();
    expect(result).toEqual([10, 11]);
  });

  it("calls write() and unlink() with the expected body", async () => {
    const fetchMock = mockFetch({ body: true });
    const client = buildClient(fetchMock);

    await client.write("res.partner", [1, 2], { active: false });
    let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.odoo.com/json/2/res.partner/write");
    expect(JSON.parse(init.body as string)).toMatchObject({ ids: [1, 2], vals: { active: false } });

    await client.unlink("res.partner", [1, 2]);
    [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://example.odoo.com/json/2/res.partner/unlink");
    expect(JSON.parse(init.body as string)).toMatchObject({ ids: [1, 2] });
  });

  it("throws OdooAuthError on HTTP 401", async () => {
    const fetchMock = mockFetch({ status: 401, body: { error: { message: "Invalid API key" } } });
    const client = buildClient(fetchMock);

    await expect(client.read("res.partner", [1])).rejects.toBeInstanceOf(OdooAuthError);
  });

  it("throws OdooError when the response body contains an error, even on HTTP 200", async () => {
    const fetchMock = mockFetch({ status: 200, body: { error: { message: "Access denied" } } });
    const client = buildClient(fetchMock);

    await expect(client.unlink("res.partner", [1])).rejects.toThrow("Access denied");
  });

  it("throws OdooError on other non-2xx statuses without a body error", async () => {
    const fetchMock = mockFetch({ status: 500, body: {} });
    const client = buildClient(fetchMock);

    await expect(client.read("res.partner", [1])).rejects.toBeInstanceOf(OdooError);
  });

  it("wraps fetch failures in OdooNetworkError", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
    const client = buildClient(fetchMock);

    await expect(client.write("res.partner", [1], { name: "X" })).rejects.toBeInstanceOf(OdooNetworkError);
  });

  it("wraps invalid JSON responses in OdooNetworkError", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => {
        throw new Error("not json");
      },
    });
    const client = buildClient(fetchMock);

    await expect(client.read("res.partner", [1])).rejects.toBeInstanceOf(OdooNetworkError);
  });
});
