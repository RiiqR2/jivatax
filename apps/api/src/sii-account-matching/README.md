# Términos y sugerencias de cuentas SII

## Pipeline de homologación v2 (Bloque 1, aislado)

El directorio `pipeline/` establece una base conservadora y testeable para reemplazar gradualmente el ranking. Su orden futuro es **clasificación → compatibilidad → resolución exacta → reglas contables → ranking compatible → decisión**. En este bloque la fachada existe únicamente para pruebas: no está registrada en el módulo ni es llamada por `AccountSuggestionService.generateForPeriod`; el motor descrito más abajo sigue siendo el productivo.

Compatibilidad y ranking son responsabilidades distintas. La compatibilidad es una barrera contable: elimina destinos imposibles por sección, temporalidad, naturaleza o significado antes de comparar candidatos. El ranking sólo ordena los destinos que atravesaron esa barrera y no convierte una similitud lexical en validez contable. La decisión puede responder `ambiguous` o `no_candidate`; ninguna salida confirma mappings automáticamente.

La clasificación reutiliza `statementSection`, `term`, `contraAccount` y `expectedBalanceNature` de `accountingMetadata`. Una familia específica v2 tiene precedencia; después se aplican la condición correctora y la sección/naturaleza de la metadata, dejando la heurística local sólo como fallback. La taxonomía pequeña de familias propia de v2 está centralizada en `pipeline/account-family-taxonomy.ts`, donde cada familia documenta su correspondencia con la familia común; sólo conserva distinciones que la metadata general no expresa, como IVA crédito frente a IVA débito. Tanto las reglas observadas como las de destino se mantienen en ese único archivo.

### Entrada y precedencia de la observación v2

El clasificador recibe un `AccountObservationInput` explícito con `accountCode`,
`accountName` y las columnas opcionales `assetAmount`, `liabilityAmount`,
`lossAmount`, `gainAmount`, `debitBalance`, `creditBalance`, `debits` y `credits`
(importes DECIMAL como `string | null`). La sobrecarga que recibe sólo el nombre
se conserva únicamente para compatibilidad de pruebas.

La precedencia es: (1) columnas estructurales del Balance, (2) metadata contable
explícita, (3) familia específica v2, (4) nombre normalizado y (5) `unknown`.
`classificationEvidence` hace trazable la decisión y `classificationWarnings`
conserva importes inválidos o señales contradictorias. Dos secciones positivas
no se resuelven arbitrariamente; dos saldos de naturaleza opuesta producen
naturaleza `unknown`.

La condición correctora es distinta de la columna física informada. Una
depreciación acumulada presentada en `assetAmount` conserva sección
`contra_asset` y naturaleza `credit`; asimismo, metadata explícita de patrimonio
puede conservar patrimonio aunque el formato la presente en el bloque pasivo.

Gastos rechazados, donaciones, gastos no documentados, multas tributarias, rentas extranjeras, impuestos diferidos y partes relacionadas son categorías sensibles. Sólo son compatibles cuando el nombre observado aporta evidencia positiva explícita de la misma categoría, porque un falso positivo puede cambiar el tratamiento tributario. El catálogo SII vigente continuará siendo la única fuente admisible de destinos cuando se integre el pipeline.

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

La confidence se calibra separadamente del score usando cantidad de evidencias, penalizaciones, distancia respecto al segundo candidato, competencia, historial (`historical_company_mapping`, aprendizaje supervisado), reglas fuertes y confirmaciones expertas. El denominador usa `scoreForFullConfidence` de la configuración. Un resultado inferior a 60% queda en revisión; las sugerencias en revisión sí se persisten con estado `REVIEW`, pero nunca se marcan como activas automáticamente.

### Ranking determinístico (`deterministic-v7-inference`)

Flujo único: `AccountCandidateGeneratorService.generate` → `AccountSuggestionRankingService.rank` → `AccountConfidenceCalibratorService.calibrate`.

- **Retrieval:** todo el catálogo activo entra al pool; los términos positivos y negativos se adjuntan por candidato.
- **Pesos exactos diferenciados:** `exact_official_name`, `exact_alias`, `exact_company_alias`, `exact_erp_term`, `exact_industry_term`, `exact_manual_term`, `exact_abbreviation`.
- **Similitud parcial:** `token_similarity`, `lexical_similarity`, `jaccard`, `character_trigrams`, `prefix_match`.
- **Conceptos y conocimiento:** conceptos curados, familia contable, sección, contracuenta, naturaleza de saldo.
- **Aprendizaje supervisado:** `supervised_learning_global`, `supervised_learning_industry`, `supervised_learning_expert`, `supervised_learning_expert_industry` (nunca confirman automáticamente).
- **Historial de empresa:** `historical_company_mapping` aporta evidencia desde `company_account_mapping_history` (última confirmación por cuenta interna); no reemplaza mappings confirmados ni auto-confirma.
- **Términos negativos:** penalizan score/confidence cuando el nombre observado coincide o contiene el término; no descartan candidatos por sí solos.
- **Evidencia semántica:** candidatos sin señal fuerte requieren combinación de similitud media + corroboración estructural o regla; de lo contrario no entran al Top N persistible.
- **Decisión conservadora:** `automatic` exige evidencia fuerte, score mínimo, confidence mínima y separación respecto al segundo candidato; ambigüedad descarta persistencia activa.

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
