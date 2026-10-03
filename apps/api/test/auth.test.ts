import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type Ctx, setup } from "./helpers";

let t: Ctx;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

describe("auth (email + password)", () => {
  test("sign-up returns a bearer token that opens a session", async () => {
    const u = await t.signUp({ email: "ala@example.test" });
    const res = await t.request("/api/auth/get-session", { headers: u.headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe("ala@example.test");
  });

  test("sign-in works with the correct password, not with a wrong one", async () => {
    await t.signUp({ email: "ola@example.test", password: "password123" });
    const ok = await t.request("/api/auth/sign-in/email", {
      method: "POST",
      json: { email: "ola@example.test", password: "password123" },
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-auth-token")).toBeTruthy();

    const bad = await t.request("/api/auth/sign-in/email", {
      method: "POST",
      json: { email: "ola@example.test", password: "zlehaslo1" },
    });
    expect(bad.status).toBe(401);
  });

  test("duplicate email is rejected", async () => {
    await t.signUp({ email: "dup@example.test" });
    const res = await t.request("/api/auth/sign-up/email", {
      method: "POST",
      json: { email: "dup@example.test", password: "password123", name: "X" },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
