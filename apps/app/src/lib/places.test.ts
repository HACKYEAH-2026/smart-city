import { describe, expect, test } from "bun:test";
import type { MyPlace } from "@app/shared";
import { currentPlace, initials } from "./places";

const place = (slug: string, extra: Partial<MyPlace> = {}): MyPlace => ({
  id: slug,
  slug,
  name: slug,
  role: "user",
  isDefault: false,
  lastVisitAt: null,
  ...extra,
});

describe("currentPlace", () => {
  test("none when the user has no places", () => {
    expect(currentPlace([])).toBeNull();
  });

  test("the most recently visited place wins over the default", () => {
    const places = [
      place("a", { isDefault: true, lastVisitAt: "2026-10-01T10:00:00.000Z" }),
      place("b", { lastVisitAt: "2026-10-02T10:00:00.000Z" }),
    ];
    expect(currentPlace(places)?.slug).toBe("b");
  });

  test("without any visit the default place, otherwise the first one", () => {
    expect(currentPlace([place("a"), place("b", { isDefault: true })])?.slug).toBe("b");
    expect(currentPlace([place("a"), place("b")])?.slug).toBe("a");
  });
});

describe("initials", () => {
  test("first letters of up to two words, uppercase", () => {
    expect(initials("Osiedle Słoneczne")).toBe("OS");
    expect(initials("Kraków")).toBe("K");
    expect(initials("  Biuro  Kwadrat  Północ ")).toBe("BK");
  });
});
