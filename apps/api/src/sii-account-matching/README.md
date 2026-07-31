# Términos y sugerencias de cuentas SII

`sii_accounts` continúa siendo el único catálogo oficial. `sii_account_terms` sólo contiene conocimiento auditable para puntuar sugerencias; los datos del Manual MiPyme son auxiliares y sus códigos nunca se usan como códigos SII.

Ejecute explícitamente `pnpm --filter @jivatax/api sii-accounts:sync-terms` después de importar o actualizar el catálogo. El comando crea el nombre oficial de cada cuenta activa y el conocimiento curado de `data/sii-account-aliases.ts`. Es idempotente: no reactiva, elimina ni sobrescribe términos existentes.

Ejecute también, de forma explícita, `pnpm --filter @jivatax/api sii-accounts:sync-concepts` para cargar el conocimiento económico y contable versionado en `data/sii-account-concepts.ts`. Los conceptos complementan aliases y señales estructurales del ranking, pero nunca crean ni confirman mappings. El comando es idempotente y conserva conceptos inactivos, pesos editados y registros borrados lógicamente.

Para agregar un alias global, un metausuario debe revisar el código SII estable y agregarlo al archivo versionado (o administrarlo mediante una operación administrativa). Para desactivarlo, marque `active = false`; la sincronización conservará esa decisión. Los términos con `company_id` se aprenden sólo al confirmar una homologación de esa empresa y jamás se promueven globalmente.

## Inferencia contable determinística

El algoritmo `deterministic-v7-inference` mantiene al catálogo `sii_accounts` como única fuente de destinos y agrega capas administrables:

- `sii_account_knowledge`: familia, sección, naturaleza, clasificación tributaria y financiera, temporalidad, contracuenta, control y residualidad. La ausencia de una fila conserva la inferencia histórica desde el nombre oficial.
- `account_matching_rules`: reglas declarativas JSON con prioridad, condición, acción y explicación. Las reglas incorporadas de seguridad siguen el mismo contrato y nunca inventan una cuenta.
- `account_matching_learning`: confirmaciones supervisadas por empresa, giro y alcance global. Cinco empresas distintas solo vuelven un aprendizaje global elegible para promoción; nunca lo convierten automáticamente en alias.
- `account_matching_diagnostics`: fotografía idempotente por empresa/período con todos los candidatos, metadata, señales, penalizaciones, reglas, score, confidence, descartes y decisión.

La confidence se calibra separadamente del score usando cantidad de evidencias, penalizaciones, distancia, competencia, historial y reglas fuertes. Un resultado inferior a 60% queda en revisión y no se persiste como sugerencia activa.

### Diagnóstico y cobertura

- `GET /companies/:companyId/account-matching/tax-periods/:taxPeriodId/diagnostics`
- `GET /companies/:companyId/account-matching/coverage/sii-versions/:versionId`

Ambos endpoints son aditivos, protegidos por acceso a empresa y no alteran los contratos públicos existentes.

## Importación de homologaciones expertas

El CLI crea evidencia histórica `source=expert`; nunca crea empresas, cuentas internas ni mappings operacionales. `account_matching_learning` y su detalle por rubro son proyecciones reconstruibles y sólo las actualiza `LearningAggregatorService`.

```bash
pnpm --filter @jivatax/api import:expert-account-mappings --file ./data/expert-account-mappings.xlsx --dry-run
pnpm --filter @jivatax/api import:expert-account-mappings --file ./data/expert-account-mappings.xlsx --confirmed-by-user-id <uuid>
pnpm --filter @jivatax/api import:expert-account-mappings --file ./data/expert-account-mappings.xlsx --confirmed-by-user-id <uuid> --industry-id <uuid>
```

Se aceptan `.xlsx` y `.xls`, `--sheet` es opcional y el usuario confirmador también lo es porque la FK real es nullable. Los encabezados de nombre son `nombre_cuenta`, `nombre cuenta`, `cuenta`, `descripcion`, `descripción`, `internal_name` o `account_name`; los de código SII son `codigo_sii`, `código sii`, `cuenta_sii`, `cuenta sii`, `sii_code` o `sii_account_code`. El código interno opcional acepta `codigo_cuenta`, `código cuenta`, `codigo interno`, `código interno`, `internal_code` y `account_code`.

La identidad idempotente es el SHA-256 de `expert + hash del nombre normalizado + siiAccountId + industryId`; por ello reordenar o volver a importar el archivo no aumenta evidencia. El reporte JSON separa filas importadas, duplicadas y rechazadas. Sin `industryId` la evidencia es global; con un rubro activo también participa en su proyección.

La confianza es `agreementRate * max(min(1, distinctCompanyCount / 5), expertConfirmationCount > 0 ? 0.8 : 0)`: 0.8 reconoce la revisión experta sin equipararla a certeza colectiva. Las confirmaciones incorrectas deben invalidarse mediante `AccountMatchingConfirmationService.invalidate`; la siguiente reconstrucción excluye evidencia invalidada.
