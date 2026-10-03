import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type Ctx, setup } from "./helpers";

let t: Ctx;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

describe("auth (email + hasło)", () => {
  test("rejestracja zwraca token bearer, który otwiera sesję", async () => {
    const u = await t.signUp({ email: "ala@example.test" });
    const res = await t.request("/api/auth/get-session", { headers: u.headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe("ala@example.test");
  });

  test("logowanie poprawnym hasłem działa, błędnym nie", async () => {
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

  test("duplikat emaila jest odrzucany", async () => {
    await t.signUp({ email: "dup@example.test" });
    const res = await t.request("/api/auth/sign-up/email", {
      method: "POST",
      json: { email: "dup@example.test", password: "password123", name: "X" },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
