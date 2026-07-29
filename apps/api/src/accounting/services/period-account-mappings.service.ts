import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  ListPeriodAccountMappingsDto,
  UpdatePeriodAccountMappingDto,
} from "../dto/account-mappings.dto";
import { TaxPeriodsService } from "./tax-periods.service";

type CountRow = { status: string; count: string };

@Injectable()
export class PeriodAccountMappingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly periods: TaxPeriodsService,
  ) {}

  async list(
    companyId: string,
    taxPeriodId: string,
    query: ListPeriodAccountMappingsDto,
  ) {
    const period = await this.periods.get(companyId, taxPeriodId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const conditions = ["tpca.company_id = ?", "tpca.tax_period_id = ?"];
    const parameters: unknown[] = [companyId, taxPeriodId];
    if (query.documentId) {
      conditions.push("tpca.source_document_id = ?");
      parameters.push(query.documentId);
    }
    if (query.status) {
      conditions.push("mapping.status = ?");
      parameters.push(query.status);
    }
    if (query.newInPeriod)
      conditions.push("account.first_seen_tax_period_id = tpca.tax_period_id");
    if (query.nameChanged)
      conditions.push("account.name <> tpca.account_name_snapshot");
    if (query.search?.trim()) {
      conditions.push(
        "(account.internal_code LIKE ? OR account.name LIKE ? OR tpca.account_name_snapshot LIKE ? OR sii.code LIKE ? OR sii.name LIKE ?)",
      );
      const search = `%${query.search.trim()}%`;
      parameters.push(search, search, search, search, search);
    }
    const where = conditions.join(" AND ");
    const rows = await this.dataSource.query(
      `SELECT account.id AS companyAccountId, account.internal_code AS code,
        account.name AS canonicalName, tpca.account_name_snapshot AS periodName,
        account.first_seen_tax_period_id AS firstSeenTaxPeriodId,
        account.last_seen_tax_period_id AS lastSeenTaxPeriodId,
        account.last_seen_at AS lastSeenAt, mapping.id AS mappingId,
        mapping.status AS mappingStatus, mapping.mapping_method AS matchMethod,
        mapping.confidence, sii.id AS siiAccountId, sii.code AS siiCode,
        sii.name AS siiName
       FROM tax_period_company_accounts tpca
       INNER JOIN company_accounts account ON account.id = tpca.company_account_id
       INNER JOIN company_account_mappings mapping ON mapping.company_account_id = account.id
       LEFT JOIN sii_accounts sii ON sii.id = mapping.sii_account_id
       WHERE ${where}
       ORDER BY account.internal_code ASC LIMIT ? OFFSET ?`,
      [...parameters, limit, (page - 1) * limit],
    );
    const totalRows = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM tax_period_company_accounts tpca
       INNER JOIN company_accounts account ON account.id = tpca.company_account_id
       INNER JOIN company_account_mappings mapping ON mapping.company_account_id = account.id
       LEFT JOIN sii_accounts sii ON sii.id = mapping.sii_account_id WHERE ${where}`,
      parameters,
    );
    const counts: CountRow[] = await this.dataSource.query(
      `SELECT mapping.status, COUNT(*) AS count FROM tax_period_company_accounts tpca
       INNER JOIN company_accounts account ON account.id = tpca.company_account_id
       INNER JOIN company_account_mappings mapping ON mapping.company_account_id = account.id
       WHERE tpca.company_id = ? AND tpca.tax_period_id = ? GROUP BY mapping.status`,
      [companyId, taxPeriodId],
    );
    const summary = Object.fromEntries(
      counts.map((row) => [row.status, Number(row.count)]),
    );
    const extras = await this.dataSource.query(
      `SELECT COUNT(*) AS total,
       SUM(account.first_seen_tax_period_id = tpca.tax_period_id) AS newInPeriod,
       SUM(account.name <> tpca.account_name_snapshot) AS nameChanged
       FROM tax_period_company_accounts tpca INNER JOIN company_accounts account ON account.id = tpca.company_account_id
       WHERE tpca.company_id = ? AND tpca.tax_period_id = ?`,
      [companyId, taxPeriodId],
    );
    return {
      items: rows.map((row: Record<string, unknown>) => ({
        companyAccountId: row.companyAccountId,
        code: row.code,
        canonicalName: row.canonicalName,
        periodName: row.periodName,
        firstSeenTaxYear:
          row.firstSeenTaxPeriodId === taxPeriodId ? period.taxYear : null,
        lastSeenTaxYear:
          row.lastSeenTaxPeriodId === taxPeriodId ? period.taxYear : null,
        lastSeenAt: row.lastSeenAt,
        usedInPeriod: true,
        isNewInPeriod: row.firstSeenTaxPeriodId === taxPeriodId,
        nameChanged: row.canonicalName !== row.periodName,
        mapping: {
          id: row.mappingId,
          status: row.mappingStatus,
          matchMethod: row.matchMethod,
          confidence: row.confidence === null ? null : Number(row.confidence),
          siiAccount: row.siiAccountId
            ? { id: row.siiAccountId, code: row.siiCode, name: row.siiName }
            : null,
        },
        suggestions: [],
      })),
      total: Number(totalRows[0]?.total ?? 0),
      page,
      limit,
      summary: {
        total: Number(extras[0]?.total ?? 0),
        pending: summary.pending ?? 0,
        suggested: summary.suggested ?? 0,
        confirmed: summary.confirmed ?? 0,
        rejected: summary.rejected ?? 0,
        newInPeriod: Number(extras[0]?.newInPeriod ?? 0),
        nameChanged: Number(extras[0]?.nameChanged ?? 0),
      },
    };
  }

  async update(
    companyId: string,
    accountId: string,
    userId: string,
    dto: UpdatePeriodAccountMappingDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT mapping.id, mapping.status, mapping.sii_account_id AS siiAccountId
         FROM company_account_mappings mapping INNER JOIN company_accounts account ON account.id = mapping.company_account_id
         WHERE account.id = ? AND account.company_id = ? LIMIT 1`,
        [accountId, companyId],
      );
      const current = rows[0];
      if (!current) throw new NotFoundException("Homologación no encontrada.");
      if (dto.action === "confirm") {
        const sii = await manager.query(
          "SELECT id FROM sii_accounts WHERE id = ? LIMIT 1",
          [dto.siiAccountId],
        );
        if (!sii[0])
          throw new BadRequestException(
            "La cuenta SII seleccionada no existe.",
          );
      }
      const nextStatus = dto.action === "confirm" ? "confirmed" : "rejected";
      const nextSiiAccountId =
        dto.action === "confirm" ? dto.siiAccountId : current.siiAccountId;
      await manager.query(
        `INSERT INTO company_account_mapping_history
         (id, company_account_id, previous_sii_account_id, new_sii_account_id, previous_status, new_status, changed_by_user_id, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(6))`,
        [
          randomUUID(),
          accountId,
          current.siiAccountId,
          nextSiiAccountId,
          current.status,
          nextStatus,
          userId,
          dto.action === "confirm"
            ? "Confirmación manual"
            : "Sugerencia rechazada",
        ],
      );
      await manager.query(
        `UPDATE company_account_mappings SET sii_account_id = ?, status = ?, mapping_method = 'manual', confidence = NULL,
         reviewed_by_user_id = ?, reviewed_at = NOW(6), updated_at = NOW(6) WHERE id = ?`,
        [nextSiiAccountId, nextStatus, userId, current.id],
      );
      return {
        id: current.id,
        status: nextStatus,
        siiAccountId: nextSiiAccountId,
      };
    });
  }

  async history(companyId: string, accountId: string) {
    const account = await this.dataSource.query(
      "SELECT id FROM company_accounts WHERE id = ? AND company_id = ? LIMIT 1",
      [accountId, companyId],
    );
    if (!account[0])
      throw new NotFoundException("Cuenta interna no encontrada.");
    const items = await this.dataSource.query(
      `SELECT history.id, history.created_at AS changedAt, history.previous_status AS previousStatus,
       history.new_status AS newStatus, history.reason, previous.code AS previousCode, previous.name AS previousName,
       next.code AS newCode, next.name AS newName, user.email, user.first_name AS firstName, user.last_name AS lastName
       FROM company_account_mapping_history history
       LEFT JOIN sii_accounts previous ON previous.id = history.previous_sii_account_id
       LEFT JOIN sii_accounts next ON next.id = history.new_sii_account_id
       INNER JOIN users user ON user.id = history.changed_by_user_id
       WHERE history.company_account_id = ? ORDER BY history.created_at DESC`,
      [accountId],
    );
    return {
      items: items.map((item: Record<string, unknown>) => ({
        ...item,
        user: {
          name: `${item.firstName} ${item.lastName}`.trim(),
          email: item.email,
        },
      })),
    };
  }
}
