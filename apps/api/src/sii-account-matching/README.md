# Términos y sugerencias de cuentas SII

## Pipeline de homologación v2 (Bloques 1–3, aislado)

El directorio `pipeline/` establece una base conservadora y testeable para reemplazar gradualmente el ranking. Su orden futuro es **clasificación → compatibilidad → resolución exacta → reglas contables → ranking compatible → decisión**. En este bloque la fachada existe únicamente para pruebas: no está registrada en el módulo ni es llamada por `AccountSuggestionService.generateForPeriod`; el motor descrito más abajo sigue siendo el productivo.

Compatibilidad y ranking son responsabilidades distintas. La compatibilidad es una barrera contable: elimina destinos imposibles por sección, temporalidad, naturaleza o significado antes de comparar candidatos. El ranking sólo ordena los destinos que atravesaron esa barrera y no convierte una similitud lexical en validez contable. La decisión puede responder `ambiguous` o `no_candidate`; ninguna salida confirma mappings automáticamente.

El Bloque 3 aplica barreras duras y trazables antes de todo ranking: sección y
naturaleza (sin confundir una con otra), corto frente a largo plazo, cobrar
frente a pagar, relación explícita, subfamilias financieras, cuentas puente y
elegibilidad oficial del destino. Una temporalidad ausente no descarta current
ni non-current, pero agrega `temporal_class_undetermined`; “cuenta corriente
bancaria” no constituye plazo. Una relación presente sólo en el origen conserva
el destino no marcado como candidato incierto, nunca fuerte.

`PipelineCatalogAccount` acepta `active`, `mappable` e `isLeaf` como metadata
oficial mínima. Un valor explícitamente falso excluye la cuenta con un reason
estable; en particular `isLeaf: false` identifica encabezados y nodos
agrupadores. No se adivina esa condición desde el formato del código. Cuando la
metadata no está disponible, la ausencia no se transforma en una exclusión.

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

También quedan protegidas las operaciones con relacionados y las donaciones
rechazadas, cubiertas por las categorías explícitas relacionadas/donación o
gasto rechazado. Señales genéricas como gasto, débito o pérdida no acreditan
ninguna de estas categorías. Ante sección `unknown` no se inventa una barrera de
sección: el candidato puede conservarse como `uncertain` con warnings, mientras
que las incompatibilidades explícitas y las categorías protegidas siguen siendo
exclusiones duras.

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

## Pipeline v2 aislado: resolución priorizada

Antes del ranking semántico, la fachada v2 evalúa, en este orden: (1) mapping
confirmado de la `companyAccount`, (2) mapping histórico confirmado de la misma
empresa y cuenta, (3) alias activo de empresa, (4) nombre oficial SII exacto,
(5) alias o término curado exacto, (6) regla contable determinística y (7)
ranking compatible. La primera capa con evidencia detiene las inferiores; dos
destinos diferentes dentro de una misma capa producen `ambiguous`, nunca un
desempate por UUID, código u orden de entrada.

Reutilizar un mapping ya confirmado se informa como `confirmed_mapping` y
`reusedConfirmedMapping`; no equivale a crear una confirmación. Todas las demás
salidas son sugerencias con `reviewRequired`, y el resultado declara siempre
`autoConfirmed: false`.

`resolve()` es el único entrypoint de la fachada v2. Si existe un mapping
confirmado aplicable, ninguna capa inferior se evalúa: una referencia vigente o
remapeable se reutiliza incluso si el contexto actual parece incompatible; una
referencia que no puede resolverse inequívocamente devuelve
`confirmed_mapping_unresolved`, sin candidatos y con el warning estable
`confirmed_mapping_requires_manual_resolution` para revisión humana.

Cada referencia se valida contra una cuenta vigente, activa, hoja y homologable.
Si su UUID desapareció, sólo se remapea cuando el código SII estable identifica
una única cuenta vigente, conservando `originalSiiAccountId`,
`resolvedSiiAccountId` y `referenceResolution=remapped`. Un código ausente o
ambiguo no produce candidato.

Este pipeline sigue completamente aislado: sus contratos reciben catálogo y
evidencias por inyección pura, no consulta repositorios ni `DataSource`, no
persiste. Su registro para evaluación no le agrega dependencias de TypeORM ni repositorios.

## Bloque 9: reforma de precisión práctica

Cuatro cambios mínimos, validados contra el reporte real de 134 cuentas
(`tmp/account-matching-evaluation/`), corrigen la causa raíz de la baja
precisión sin agregar reglas por cuenta:

1. **Decisión sin cortocircuito.** `resolve()` ya no marca `ambiguous` sólo
   porque una capa devolvió más de un destino distinto; siempre delega en
   `SuggestionDecisionService.decide()`, que compara el score del primer y
   segundo candidato. Un ganador claramente superior deja de perderse frente
   a alternativas mucho más débiles que igual pasaron la compatibilidad.
2. **Ranking sin ruido léxico.** `CompatibleCandidateRankerService` reutiliza
   `weightedTokenSimilarity`/`relevantWords` (el mismo cálculo del motor
   productivo) en vez de un conteo de tokens propio que contaba palabras
   vacías ("por", "cuenta", "otros"...) como evidencia de similitud.
3. **Jerarquía real del catálogo para el destino.** El código del catálogo
   importado sigue la numeración oficial del Balance Tributario 8 Columnas:
   capítulo 1 = Activos, 2.03 = Patrimonio, 2.\* = Pasivos. Esa jerarquía
   ahora prevalece sobre una heurística léxica del nombre del destino (una
   cuenta de activo llamada "Gastos Diferidos" ya no se clasifica como
   gasto). El capítulo 5 es el prontuario de agregados/deducciones a la RLI
   (~60% del catálogo): no es un destino de Balance o resultado, y el
   ranking por solapamiento léxico nunca puede resolver hacia él; sólo un
   nombre exacto, alias/término curado o regla contable pueden hacerlo.
4. **`sii_account_knowledge` conectado.** `MatchingResolutionContextFactoryService`
   carga la tabla (hoy vacía) y el clasificador la antepone a la heurística
   léxica cuando existe una fila para esa cuenta SII (familia, sección,
   naturaleza, plazo, contracuenta, residualidad). Es aditivo y no cambia
   nada mientras la tabla esté vacía; queda listo para el día en que se
   cargue conocimiento curado.

Sobre el mismo Balance de 134 cuentas, `ambiguous` bajó de 48 a 16 cuentas y
el total que requiere revisión manual bajó de 62 a 40, sin cambiar ningún
`confirmed_mapping`, `strong_candidate` ni `protected_tax_case` existente.

## Bloque 5: contexto productivo de solo lectura y evaluación shadow

`MatchingResolutionContextFactoryService.create()` es el único adapter entre las
entidades productivas y `MatchingResolutionContext`. Recibe `companyId`,
`taxPeriodId`, `companyAccountId` y, obligatoriamente, `balanceImportId`. Este
último es el UUID real de `tax_documents`: hoy el dominio permite varios balances
por período, pero no expone un único "balance seleccionado" inequívoco. Por eso
el adapter no usa `MAX(created_at)`, número de versión ni ninguna heurística.
Valida que el documento sea un Balance del mismo período/empresa y toma solamente
el snapshot activo de `tax_period_company_accounts` cuyo `source_document_id`
coincide exactamente.

Fuentes del contexto:

- `accountObservation`: código, nombre, débitos, créditos y los seis saldos/importes
  del snapshot del Balance indicado;
- `confirmedMapping`: `company_account_mappings` únicamente con estado
  `confirmed`, unido a su cuenta SII;
- `historicalCompanyMappings`: transiciones reales a `confirmed` de
  `company_account_mapping_history`; se omite el destino actual para no duplicarlo;
- `companyAliases`: términos `alias`, activos, de scope `company`, propiedad de la
  empresa y asociados a cuentas del catálogo vigente;
- `catalogTerms`: términos activos globales o de la empresa y con destino vigente.
  `negative_term` se conserva. El esquema actual no tiene `industry_id` en
  `sii_account_terms`; por seguridad los `industry_term` no se aplican sin scope
  demostrable. El `industryId` real de la empresa sí viaja en el contexto para
  cuando exista evidencia correctamente asociada;
- `catalogAccounts`: exclusivamente `CurrentSiiAccountCatalogService`. Se conservan
  `id`, código, nombre, padre y nivel. Como `sii_accounts` no contiene `active`,
  `isLeaf` ni `mappable`, v2 deriva `isLeaf` únicamente de las relaciones reales:
  una cuenta referenciada como padre por otra cuenta del catálogo vigente es un
  agrupador. El `level` disponible se deriva durante la importación y no demuestra
  por sí solo que un nodo sin hijos sea agrupador; por eso no se usa como heurística
  ni se infiere elegibilidad por el formato del código. Un agrupador sin hijos no
  puede distinguirse de una hoja con el modelo actual y queda sin clasificación
  adicional hasta que exista metadata explícita.

La construcción normal requiere nueve operaciones de lectura (cuatro validaciones
de contexto en paralelo, snapshot, y cuatro cargas de evidencia en paralelo; el
resolver de catálogo hace internamente la lectura de versión activa y de cuentas).
Las cargas son por lote y no existe un query por candidato (N+1).

`SiiAccountMatchingV2EvaluationService` sólo encadena el factory con
`SiiAccountMatchingPipelineService.resolve()`. No tiene repositorios, no persiste,
no crea ni modifica sugerencias, no confirma mappings, no invoca aprendizaje y no
está conectado a ningún controller o endpoint. Por tanto v2 continúa siendo un
flujo shadow y no reemplaza al motor v7 ni afecta homologaciones productivas.

## Shadow de Balance (Bloque 6)

El shadow compara, sin efectos productivos, todas y únicamente las cuentas no
descartadas de un Balance explícito. V2 se ejecuta en memoria. Para V7, el
diagnóstico persistido aporta la decisión final y la sugerencia persistida de
rank 1 de esa misma generación aporta el candidato final; nunca se interpreta
`diagnostic.candidates[0]`, porque esa colección contiene candidatos anteriores
a los filtros semánticos. No se generan sugerencias, no se escriben mappings y
no se invoca aprendizaje.

El modelo actual no relaciona diagnósticos ni sugerencias con
`balanceImportId`. Por ello todo resultado V7 persistido se informa con
`contextMatch=unverified` y no incrementa `sameWinner`, `differentWinner`,
`v7Only` ni `v2Only`. No se deduce el Balance a partir de timestamps o de la
última ejecución. `comparableAccounts` sólo cuenta resultados cuyo contexto
fuera verificable. La ausencia de resultado se marca `unavailable`; una cuenta
omitida por V7 debido a un mapping confirmado se marca `confirmed_mapping` con
el código vigente del mapping.

```bash
pnpm --filter @jivatax/api matching:v2-shadow \
  --company-id <uuid> \
  --tax-period-id <uuid> \
  --balance-import-id <uuid>
```

El JSON queda en `tmp/account-matching-shadow/` e incluye metadata, resumen y
detalle por cuenta. `sameWinner` exige igualdad del **código SII** estable; no
basta el nombre ni el UUID. Los mappings confirmados se reutilizan y se marcan
con `confirmedMappingReused`, pero nunca se autoaprueban ni convierten una
diferencia en regresión automática.

El contexto batch realiza aproximadamente nueve lecturas constantes (empresa,
período, documento, snapshots, catálogo, mappings, historial, terms y cuentas),
más dos lecturas batch para diagnósticos y sugerencias V7. La cantidad no crece
con el número de cuentas o candidatos y no utiliza caches globales.
