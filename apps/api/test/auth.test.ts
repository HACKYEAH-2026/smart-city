import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { TEST_GOOGLE_CLIENT_ID, testGoogleIdToken } from "../src/test-google";
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

  test("the only password rule is at least 5 characters (MIN_PASSWORD_LENGTH in the app)", async () => {
    const signUp = (email: string, password: string) =>
      t.request("/api/auth/sign-up/email", { method: "POST", json: { email, password, name: "X" } });
    expect((await signUp("four@example.test", "abcd")).status).toBe(400);
    expect((await signUp("five@example.test", "abcde")).status).toBe(200);
  });
});

describe("auth (Google ID token from the phone)", () => {
  const signInWithGoogle = (token: string) =>
    t.request("/api/auth/sign-in/social", { method: "POST", json: { provider: "google", idToken: { token } } });

  const sessionOf = async (res: Response) => {
    const token = res.headers.get("set-auth-token");
    const session = await t.request("/api/auth/get-session", { headers: { authorization: `Bearer ${token}` } });
    return (await session.json()) as { user: { id: string; email: string; name: string; emailVerified: boolean } };
  };

  test("the app learns the Google client IDs from the API", async () => {
    const res = await t.request("/api/auth-providers");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ google: { webClientId: TEST_GOOGLE_CLIENT_ID, iosClientId: null } });
  });

  test("the first sign-in creates the account, the next one opens the same account", async () => {
    const token = testGoogleIdToken({ email: "Jan@Gmail.test", name: "Jan Kowalski" });
    const first = await signInWithGoogle(token);
    expect(first.status).toBe(200);
    const created = await sessionOf(first);
    expect(created.user).toMatchObject({ email: "jan@gmail.test", name: "Jan Kowalski", emailVerified: true });

    const again = await signInWithGoogle(testGoogleIdToken({ email: "jan@gmail.test", name: "Jan Kowalski" }));
    expect(again.status).toBe(200);
    expect((await sessionOf(again)).user.id).toBe(created.user.id);
  });

  test("a token that Google did not sign is rejected", async () => {
    const [header, payload] = testGoogleIdToken({ email: "eve@gmail.test" }).split(".");
    const res = await signInWithGoogle(`${header}.${payload}.forged`);
    expect(res.status).toBe(401);
    expect(res.headers.get("set-auth-token")).toBeNull();
  });

  test("an email registered with a password is not taken over by Google sign-in", async () => {
    await t.signUp({ email: "ola@gmail.test" });
    const res = await signInWithGoogle(testGoogleIdToken({ email: "ola@gmail.test" }));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("OAUTH_LINK_ERROR");
    expect(res.headers.get("set-auth-token")).toBeNull();
  });

  test("the iOS client ID is accepted too when it is configured", async () => {
    await t.close();
    t = await setup({ GOOGLE_IOS_CLIENT_ID: "test-ios-client.apps.googleusercontent.com" });
    const res = await t.request("/api/auth-providers");
    expect(await res.json()).toEqual({
      google: { webClientId: TEST_GOOGLE_CLIENT_ID, iosClientId: "test-ios-client.apps.googleusercontent.com" },
    });
  });

  test("without GOOGLE_CLIENT_ID there is no Google sign-in", async () => {
    await t.close();
    t = await setup({ GOOGLE_CLIENT_ID: undefined });
    expect(await (await t.request("/api/auth-providers")).json()).toEqual({ google: null });
    const res = await signInWithGoogle(testGoogleIdToken({ email: "jan@gmail.test" }));
    expect(res.status).toBe(404);
  });
});
