import assert from "node:assert/strict";
import { it } from "node:test";
import type { RankedCandidate } from "../account-matching.types";
import { AccountConfidenceCalibratorService } from "./account-confidence-calibrator.service";

it("uses evidence, penalties and distance without returning 100%", () => {
  const calibrator = new AccountConfidenceCalibratorService();
  const base = {
    score: 100,
    reasons: [
      {
        signal: "exact",
        description: "exact",
        points: 70,
        kind: "evidence",
        source: "lexical",
      },
      {
        signal: "family",
        description: "family",
        points: 30,
        kind: "evidence",
        source: "knowledge",
      },
    ],
  } as RankedCandidate;
  const clear = calibrator.calibrate(base, 20, 2);
  const penalized = calibrator.calibrate(
    {
      ...base,
      reasons: [
        ...base.reasons,
        {
          signal: "penalty",
          description: "penalty",
          points: -50,
          kind: "penalty",
          source: "knowledge",
        },
      ],
    },
    80,
    5,
  );
  assert.ok(clear > penalized);
  assert.ok(clear < 1);
});
