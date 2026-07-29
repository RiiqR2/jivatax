import { DataSource, EntityTarget } from "typeorm";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountTermEntity } from "../entities/sii-account-term.entity";

export function assertSyncEntitiesMetadata(dataSource: DataSource): void {
  const required: Array<[string, EntityTarget<unknown>]> = [
    ["SiiAccountTermEntity", SiiAccountTermEntity],
    ["SiiAccountEntity", SiiAccountEntity],
    ["SiiAccountPlanVersionEntity", SiiAccountPlanVersionEntity],
  ];
  const missing = required
    .filter(([, entity]) => !dataSource.hasMetadata(entity))
    .map(([name]) => name);
  if (missing.length)
    throw new Error(`Falta metadata TypeORM para: ${missing.join(", ")}`);
}
