import { Injectable } from "@nestjs/common";
import type { MatchingResolutionResult } from "../pipeline/account-matching-pipeline.types";
import { SiiAccountMatchingPipelineService } from "../pipeline/sii-account-matching-pipeline.service";
import {
  MatchingResolutionContextFactoryService,
  type MatchingResolutionContextRequest,
} from "./matching-resolution-context-factory.service";

/** Shadow-only facade: deliberately contains no repository or persistence dependency. */
@Injectable()
export class SiiAccountMatchingV2EvaluationService {
  constructor(
    private readonly contexts: MatchingResolutionContextFactoryService,
    private readonly pipeline: SiiAccountMatchingPipelineService,
  ) {}

  async evaluate(
    input: MatchingResolutionContextRequest,
  ): Promise<MatchingResolutionResult> {
    return this.pipeline.resolve(await this.contexts.create(input));
  }
}
