import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidChileanRut, normalizeChileanRut } from "./chilean-rut";

describe("Chilean RUT helpers", () => {
  it("normalizes dots, whitespace and verifier casing", () =>
    assert.equal(normalizeChileanRut(" 12.345.678-k "), "12345678-K"));
  it("accepts valid formatted and normalized RUTs", () => {
    assert.equal(isValidChileanRut("12.345.678-5"), true);
    assert.equal(isValidChileanRut("12345678-5"), true);
  });
  it("rejects missing, incorrect and arbitrary verifier values", () => {
    assert.equal(isValidChileanRut("12345678"), false);
    assert.equal(isValidChileanRut("12345678-9"), false);
    assert.equal(isValidChileanRut("RUT inválido"), false);
  });
});
