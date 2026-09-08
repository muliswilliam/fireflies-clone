import { afterAll, describe, expect, it } from "vitest";

import { createDb } from "@/lib/db/client";
import { healthResponse } from "@/lib/health";

import { testDatabaseUrl } from "../../tests/test-database";

describe("health", () => {
  const reachable = createDb(testDatabaseUrl());
  const unreachable = createDb(
    "postgres://postgres:postgres@127.0.0.1:1/nowhere",
  );

  afterAll(async () => {
    await reachable.$client.end();
    await unreachable.$client.end();
  });

  it("reports 200 with app and database ok when the database answers", async () => {
    const response = await healthResponse(reachable);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "ok" });
  });

  it("reports 503 with database unreachable when the database cannot be reached", async () => {
    const response = await healthResponse(unreachable);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unavailable",
      database: "unreachable",
    });
  });
});
