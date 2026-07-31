import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NormalizationService } from "./normalization.service";

describe("NormalizationService", () => {
  const service = new NormalizationService();
  it("normaliza tildes, mayúsculas y espacios sin equivalencias semánticas", () => {
    assert.equal(
      service.normalizeIndustry("  METALÚRGIA   Industrial "),
      "metalurgia industrial",
    );
    assert.notEqual(
      service.normalizeIndustry("Metalurgia"),
      service.normalizeIndustry("Metalmecánica"),
    );
  });
  it("produce un hash SHA-256 estable", () => {
    assert.match(service.hash("clientes"), /^[a-f0-9]{64}$/);
    assert.equal(service.hash("clientes"), service.hash("clientes"));
  });
});
