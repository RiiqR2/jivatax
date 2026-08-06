import { Injectable } from "@nestjs/common";
import type {
  AccountObservation,
  PipelineCatalogAccount,
  SuggestionCandidate,
} from "./account-matching-pipeline.types";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";

const FAMILY_DESTINATIONS: Record<string, RegExp> = {
  cash: /^(disponible|efectivo y equivalentes)/,
  vat_credit: /iva credito fiscal/,
  vat_debit: /iva debito fiscal/,
  supplier_advance: /anticipo(?:s)? a proveedores/,
  trade_payable: /proveedores por pagar/,
  bank_debt: /obligaciones? (?:con )?banc|prestamos? bancarios?/,
  issued_capital: /capital emitido/,
};

@Injectable()
export class AccountingRuleResolverService {
  constructor(
    private readonly compatibility = new AccountCompatibilityFilterService(),
  ) {}

  resolve(
    observation: AccountObservation,
    catalog: PipelineCatalogAccount[],
  ): SuggestionCandidate[] {
    const destinationPattern = FAMILY_DESTINATIONS[observation.accountFamily];
    if (!destinationPattern) return [];
    return catalog.flatMap((account) => {
      const result = this.compatibility.evaluate(observation, account.name);
      if (
        !destinationPattern.test(account.name.toLocaleLowerCase("es")) ||
        !result.compatible
      )
        return [];
      return [
        {
          siiAccountId: account.id,
          siiCode: account.code,
          siiName: account.name,
          resolutionType: "accounting_rule" as const,
          recommendationLevel: "strong" as const,
          evidence: [`account_family:${observation.accountFamily}`],
          warnings: result.warnings,
          technicalScore: 1,
          technicalConfidence: 1,
        },
      ];
    });
  }
}
