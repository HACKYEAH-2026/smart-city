import { expect, test } from "bun:test";
import { inviteCodeFromScan } from "./inviteScan";

test("a scanned invite link gives its code", () => {
  expect(inviteCodeFromScan("twojemiejsce://app/preview?code=KRKMST")).toBe("KRKMST");
  expect(inviteCodeFromScan("exp://192.168.0.2:8081/--/app/preview?code=krk-mst")).toBe("KRKMST");
});

test("a bare scanned code is taken as it is; any other QR code gives nothing", () => {
  expect(inviteCodeFromScan("KRKMST")).toBe("KRKMST");
  expect(inviteCodeFromScan("https://example.test/unrelated")).toBeNull();
});
