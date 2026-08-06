import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MatchingSignal } from "../account-matching.types";
import type { BasicAccountFamily } from "../metadata/basic-account-family";
import type { OrphanCatalogReference } from "./catalog-reference-resolver.service";

export type HomologationAccountReport = {
  accountCode: string;
  accountName: string;
  observedSection: string;
  inferredFamily: BasicAccountFamily;
  winnerCode: string | null;
  winnerName: string | null;
  score: number | null;
  confidence: number | null;
  decision: string;
  reasons: MatchingSignal[];
  secondCandidate: {
    code: string;
    name: string;
    score: number;
    confidence: number;
  } | null;
  absoluteGap: number | null;
  orphanReferenceDetected: OrphanCatalogReference | null;
};

export function writeHomologationReport(
  report: HomologationAccountReport[],
  targetPath: string,
) {
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export function defaultHomologationReportPath(
  companyId: string,
  taxPeriodId: string,
) {
  return join(
    process.cwd(),
    "tmp",
    "homologation-reports",
    `${companyId}-${taxPeriodId}.json`,
  );
}
