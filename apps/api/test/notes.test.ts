import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Note } from "@app/shared";
import { type Ctx, setup } from "./helpers";

let t: Ctx;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

const create = async (headers: Record<string, string>, json: unknown) => {
  const res = await t.request("/api/notes", { method: "POST", headers, json });
  return { res, note: res.status === 201 ? ((await res.json()) as Note) : undefined };
};

describe("notes: CRUD", () => {
  test("bez sesji: 401", async () => {
    expect((await t.request("/api/notes")).status).toBe(401);
  });

  test("dodaj -> lista -> edytuj -> usuń", async () => {
    const u = await t.signUp();
    const { res, note } = await create(u.headers, { title: "  Pierwsza  ", body: "treść" });
    expect(res.status).toBe(201);
    expect(note?.title).toBe("Pierwsza");

    const list = (await (await t.request("/api/notes", { headers: u.headers })).json()) as Note[];
    expect(list.map((n) => n.id)).toEqual([note!.id]);

    const patched = await t.request(`/api/notes/${note!.id}`, {
      method: "PATCH",
      headers: u.headers,
      json: { title: "Zmieniona" },
    });
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as Note).title).toBe("Zmieniona");

    const del = await t.request(`/api/notes/${note!.id}`, { method: "DELETE", headers: u.headers });
    expect(del.status).toBe(204);
    const after = (await (await t.request("/api/notes", { headers: u.headers })).json()) as Note[];
    expect(after).toEqual([]);
  });

  test("walidacja: pusty tytuł i zły id -> 400", async () => {
    const u = await t.signUp();
    expect((await create(u.headers, { title: "   " })).res.status).toBe(400);
    expect((await t.request("/api/notes/nie-uuid", { headers: u.headers })).status).toBe(400);
  });
});

describe("notes: autoryzacja", () => {
  test("cudzej notatki nie widać, nie da się jej edytować ani usunąć", async () => {
    const alice = await t.signUp();
    const bob = await t.signUp();
    const { note } = await create(alice.headers, { title: "Sekret Alice" });
    const url = `/api/notes/${note!.id}`;

    const bobList = (await (await t.request("/api/notes", { headers: bob.headers })).json()) as Note[];
    expect(bobList).toEqual([]);
    expect((await t.request(url, { headers: bob.headers })).status).toBe(404);
    expect((await t.request(url, { method: "PATCH", headers: bob.headers, json: { title: "hack" } })).status).toBe(404);
    expect((await t.request(url, { method: "DELETE", headers: bob.headers })).status).toBe(404);

    const mine = (await (await t.request(url, { headers: alice.headers })).json()) as Note;
    expect(mine.title).toBe("Sekret Alice");
  });
});
