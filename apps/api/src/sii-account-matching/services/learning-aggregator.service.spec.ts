import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LearningAggregatorService } from "./learning-aggregator.service";

describe("LearningAggregatorService confidence", () => {
  const service = new LearningAggregatorService({} as never);
  it("combina consenso con una muestra transparente y acotada", () => {
    assert.ok(Math.abs(service.calculateConfidence(0.8, 1) - 0.16) < 1e-12);
    assert.equal(service.calculateConfidence(0.8, 5), 0.8);
    assert.equal(service.calculateConfidence(0.8, 20), 0.8);
  });
});
