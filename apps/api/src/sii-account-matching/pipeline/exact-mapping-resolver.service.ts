import { Injectable } from "@nestjs/common";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import type {
  AccountObservation,
  PipelineCatalogAccount,
  SuggestionCandidate,
} from "./account-matching-pipeline.types";

@Injectable()
export class ExactMappingResolverService {
  resolve(
    observation: AccountObservation,
    catalog: PipelineCatalogAccount[],
  ): SuggestionCandidate[] {
    return catalog
      .filter(
        (account) =>
          normalizeAccountTerm(account.name) === observation.normalizedName,
      )
      .map((account) => ({
        siiAccountId: account.id,
        siiCode: account.code,
        siiName: account.name,
        resolutionType: "exact",
        recommendationLevel: "strong",
        evidence: ["exact_official_name"],
        warnings: [],
        technicalScore: 1,
        technicalConfidence: 1,
      }));
  }
}
