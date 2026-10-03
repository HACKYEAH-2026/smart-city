import { describe, expect, test } from "bun:test";
import { gugikAddress, photonAddress } from "./open";

/** Turning the providers' answers into addresses (the shapes as Photon and GUGiK answered on 2026-10-03). */
describe("photonAddress", () => {
  const at = { coordinates: [19.93986, 50.06274] as [number, number] };
  test("a building: street and number, then postcode and town", () => {
    const building = { street: "Floriańska", housenumber: "15", postcode: "31-019", city: "Kraków" };
    expect(photonAddress({ geometry: at, properties: building })).toEqual({
      label: "Floriańska 15",
      detail: "31-019 Kraków",
      lat: 50.06274,
      lng: 19.93986,
    });
  });

  test("a named place: its name, then its street address", () => {
    const cafe = { name: "TwistCafe", street: "Floriańska", housenumber: "15", postcode: "31-019", city: "Kraków" };
    expect(photonAddress({ geometry: at, properties: cafe })).toMatchObject({
      label: "TwistCafe",
      detail: "Floriańska 15, 31-019 Kraków",
    });
  });

  test("a street: its name and the town", () => {
    const street = { name: "Floriańska", postcode: "31-157", city: "Kraków" };
    expect(photonAddress({ geometry: at, properties: street })).toMatchObject({
      label: "Floriańska",
      detail: "31-157 Kraków",
    });
  });
});

describe("gugikAddress", () => {
  test("an address point in a town: street and number; WGS 84 from x (longitude) and y (latitude)", () => {
    const point = { city: "Kraków", street: "Floriańska", number: "12", code: "31-022", x: "19.9396", y: "50.0627" };
    expect(gugikAddress(point)).toEqual({
      label: "Floriańska 12",
      detail: "31-022 Kraków",
      lat: 50.0627,
      lng: 19.9396,
    });
  });

  test("a village without streets: the village and the number", () => {
    const point = { city: "Zabierzów", street: null, number: "12", code: "32-080", x: "19.8", y: "50.1" };
    expect(gugikAddress(point)).toMatchObject({ label: "Zabierzów 12", detail: "32-080 Zabierzów" });
  });
});
