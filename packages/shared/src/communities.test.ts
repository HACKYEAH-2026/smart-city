import { describe, expect, test } from "bun:test";
import { parseInviteCode } from "./communities";

describe("parseInviteCode", () => {
  test("accepts the bare code in any letter case, with or without the dash", () => {
    expect(parseInviteCode("KRKMST")).toBe("KRKMST");
    expect(parseInviteCode(" krk-mst ")).toBe("KRKMST");
  });

  test("rejects anything that is not a code of the alphabet", () => {
    expect(parseInviteCode("KRK0ST")).toBeNull(); // zero is a look-alike
    expect(parseInviteCode("KRKMS")).toBeNull(); // too short
    expect(parseInviteCode("twojemiejsce://app/preview")).toBeNull();
  });
});
