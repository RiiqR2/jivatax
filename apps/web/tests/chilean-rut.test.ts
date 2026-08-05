import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidChileanRut,
  normalizeChileanRut,
} from "../src/lib/chilean-rut.ts";
describe("company RUT validation", () => {
  it("normalizes user input", () =>
    assert.equal(normalizeChileanRut(" 12.345.678-k "), "12345678-K"));
  it("validates the verifier digit", () => {
    assert.equal(isValidChileanRut("12.345.678-5"), true);
    assert.equal(isValidChileanRut("12.345.678-9"), false);
  });
});
