# Auditoría técnica del motor de sugerencias de homologación

Fecha: 2026-08-01. Alcance inicial: diagnóstico y trazabilidad. La corrección posterior conserva fórmulas, pesos y umbrales, pero usa el nombre observado, corrige la fuente de clasificación y conserva candidatos revisables.

## Límite de la evidencia disponible

El checkout no incluye una base MySQL ni un volcado de los datos mencionados y `127.0.0.1:3306` rechaza conexiones. Por eso este informe separa los hallazgos demostrables por código de los valores que sólo puede producir la ejecución contra la base que contiene las 517/524/381 filas. No sería correcto inventar los destinos ni scores de esas filas. El logging temporal añadido emite esos valores exactos en la próxima generación.

## Flujo real

1. El botón web llama `accountingService.generateAccountSuggestions` y envía `POST /companies/:companyId/tax-periods/:taxPeriodId/account-mapping-suggestions`.
2. `PeriodAccountMappingsController.generateSuggestions` delega en `AccountSuggestionService.generateForPeriod`.
3. El servicio valida empresa/período y carga cuentas internas presentes y no descartadas en el período, junto con su mapping y columnas del Balance.
4. Carga términos globales activos y términos activos de la empresa; conceptos, knowledge y reglas activos; y aprendizaje cuyo `normalized_name_hash` coincide **exactamente** con alguno de los nombres internos del período.
5. Si la empresa tiene `industryId`, carga sólo las filas de `account_matching_learning_industries` vinculadas al aprendizaje global recuperado y a ese rubro. La evidencia del rubro complementa la global; no hay fallback separado porque la global ya fue cargada primero.
6. Resuelve el pool de destinos SII únicamente con IDs referenciados por términos, knowledge o el aprendizaje exacto recuperado. El generador agrupa esos datos por destino.
7. El ranking calcula metadata del nombre interno, sección observada desde el Balance y reglas. Antes de puntuar elimina: reglas `exclude`, totales/subtotales, activos prepagados sin señal explícita, clasificación desconocida frente a sección observada y secciones/contracuentas incompatibles.
8. Para los supervivientes selecciona la mejor variante entre nombre oficial y términos; suma igualdad normalizada, Jaccard de tokens singularizados, trigramas, prefijos, aprendizaje exacto, conceptos, familia, plazo, contracuenta y Balance. No hay stemming lingüístico: sólo `singularize`; no hay búsqueda fuzzy del aprendizaje.
9. Calibra confidence, toma Top 5 y decide: `review` por regla, clasificación desconocida, score menor a 45 o confidence menor a 0,60; `ambiguous` si el gap es menor a 8 o 12%; en otro caso `automatic`.
10. Los candidatos `automatic` se persisten como `active`; los candidatos `review` se persisten como `review` y quedan visibles para revisión. Los resultados ambiguos continúan sin persistirse.

## Tablas que realmente consulta la generación

- `companies`, `tax_periods`, `company_accounts`, `tax_period_company_accounts` y el mapping asociado para contexto y exclusión de confirmadas.
- `sii_account_terms`, `sii_account_concepts`, `sii_account_knowledge`, `account_matching_rules`.
- `account_matching_learning` mediante hash exacto; ésta es la estructura vigente, no una estructura legacy.
- `account_matching_learning_industries` sólo para el `industryId` de la empresa y sólo para learning global ya recuperado.
- `sii_accounts` por los IDs reunidos.
- `account_matching_diagnostics` y `company_account_suggestions` durante persistencia.
- **No consulta `account_matching_confirmations` durante ranking.** Las confirmaciones sólo participan indirectamente si `LearningAggregatorService.rebuild` ya las proyectó a learning.

## Evidencia experta

Una confirmación experta no siempre genera una sugerencia ni garantiza por sí sola un candidato final:

- Tras rebuild, una confirmación experta unánime produce confidence de learning `0,8`.
- Sólo se recupera si la normalización y SHA-256 del nombre procesado coinciden exactamente con `normalized_name_hash`.
- Si se recupera, aporta `0,8 × 30 = 24` puntos globales (más hasta 6 por rubro con confidence 0,8). Por sí sola no alcanza el score mínimo 45.
- El candidato puede desaparecer antes de sumar esos 24 puntos por regla, agregado, prepago o incompatibilidad de sección/contracuenta.
- Puede sobrevivir con score suficiente y aun ser descartado por confidence < 0,60 o ambigüedad.
- La calibración sólo otorga un bono fijo de 0,08 por la presencia de cualquier señal histórica; no prioriza explícitamente `expertConfirmationCount` sobre aprendizaje no experto con igual confidence. Por tanto, la confianza 0,8 sí se usa para puntos, pero “experto” no tiene precedencia absoluta en ranking.

Esto explica un defecto de expectativa: “existe confirmación experta” no equivale en el código actual a “siempre existe sugerencia”. El comportamiento es coherente con los umbrales implementados, pero contradice la expectativa funcional descrita.

## Los cuatro nombres

Normalización y hash usados para buscar learning:

| Cuenta                   | Normalizada                | SHA-256                                                            |
| ------------------------ | -------------------------- | ------------------------------------------------------------------ |
| IVA Crédito Fiscal       | `iva credito fiscal`       | `1ddb6a0bfa619c5028e03c25e4d926ad30bd477838b561344ec00def17222438` |
| Capital Social           | `capital social`           | `abd2acecb217dd6b50d78e1ee73cba2b7eee294b10752e4fe51303ff9324106f` |
| Costo de Servicios       | `costo de servicios`       | `75086ea8ccda532c96f028d72d8d90ff2e485c409f42d9473e659c4005eb6b22` |
| Remuneraciones por Pagar | `remuneraciones por pagar` | `6f180d516ded6e590b7047984eec00caf9af768d6b1be89d74bef08e3f1cb9ce` |

Los cuatro entran al pipeline si son cuentas no confirmadas y no descartadas del período. Sin la base de ejecución no es posible afirmar honestamente qué `sii_account_id` contienen sus filas learning ni qué columnas del Balance determinan su filtro. Sí se identifican estos puntos concretos de riesgo:

- **IVA Crédito Fiscal:** la inferencia por nombre clasifica cualquier `iva|impuesto|ppm|retencion` como `liability`. Si el Balance la observa en Activo y el destino carece de `sii_account_knowledge` que lo clasifique correctamente como asset, el destino se elimina en `isCompatible` **antes** de recibir puntos expertos. Es un bug de clasificación/integridad de metadata, no de similitud.
- **Capital Social:** el nombre interno se observa como equity cuando está en la columna Pasivo, gracias a la excepción explícita. Un destino “Capital…” también se infiere equity. Si hay learning exacto y el destino existe, no debería caer por compatibilidad; los sospechosos comprobables en runtime son learning ausente por hash, destino SII borrado/no resuelto, `review` por score/confidence o ambigüedad. Una igualdad oficial exacta añadiría 60 puntos, por lo que “Sin sugerencias” con nombre oficial sincronizado indicaría datos incompletos o descarte posterior, no una comparación textual demasiado estricta.
- **Costo de Servicios:** se infiere expense y el test unitario confirma que, con catálogo/contexto de fixture, “Costo de ventas” gana. En producción puede no existir ese destino en el pool (el generador no carga todo el catálogo, pese a su comentario), o puede acabar `review`/`ambiguous`. Learning experto aislado aporta sólo 24 puntos; las señales estructurales exactas dependen del destino y sus términos.
- **Remuneraciones por Pagar:** debido al orden de reglas de metadata, `pagar` la clasifica como liability antes de que `remuneracion` pueda clasificarla expense; esto es correcto para una obligación. Un destino de gasto de remuneraciones se eliminará por sección, mientras un destino de remuneraciones/provisiones por pagar necesita metadata liability. Si el mapping experto apunta a un destino clasificado unknown o expense, desaparece antes del score.

## Bug y comportamiento esperado

Hay dos problemas demostrables:

1. El comentario del generador dice que “every active catalogue account” entra, pero el caller carga sólo destinos referenciados por terms/knowledge/learning exacto. Las coincidencias léxicas no pueden descubrir cuentas activas fuera de ese subconjunto.
2. La evidencia experta no es una garantía de decisión automática: se aplica después de filtros duros y vale 24 puntos con confidence 0,8. La corrección conserva ahora los candidatos que resultan `review`, sin convertirlos en automáticos.

El filtro por rubro no elimina aprendizaje global: primero se carga global y luego se adjunta el rubro correspondiente. `companyId` sólo filtra términos de empresa; no filtra learning. `confirmationCount`, `expertConfirmationCount`, `distinctCompanyCount` y `agreementRate` no son filtros en generación; ya fueron condensados en `confidence` durante rebuild.

## Logging temporal agregado

Por cada cuenta procesada, `AccountSuggestionService` ahora registra en nivel DEBUG: nombre, normalización, hash, empresa/rubro, Balance, coincidencias oficiales/aliases exactas, conceptos, learning global y por rubro con todos sus contadores, reglas, cantidad que entra al pipeline, ranking y señales con score/confidence, descartes duros con condición/valor/valor requerido/punto de código, decisión, umbrales y ganador. Se declara explícitamente que confirmations no se consultó directamente.

El ranking adjunta a cada descarte duro la condición observada y el identificador estable del punto de descarte, y adjunta a la decisión final score, confidence, gaps y todos los umbrales. Estos campos sólo amplían diagnostics/logs y no cambian las condiciones existentes.

## Consulta operativa para cerrar los cuatro casos

Ejecutar “Generar sugerencias” en el período afectado con logs DEBUG y consultar el endpoint de diagnostics. Buscar cada nombre y comparar su hash con learning. La traza permitirá distinguir sin inferencias: (a) no recuperado por hash; (b) ID SII no resuelto; (c) descartado por compatibilidad/regla; (d) rankeado bajo 45/0,60; (e) ambiguo; o (f) automático persistido.

## Corrección implementada posteriormente

La generación usa `account_name_snapshot` como nombre observado para hash de learning, reglas y similitud; el nombre canónico queda limitado a una señal secundaria. La clasificación del destino registra su fuente y prioriza metadata oficial, jerarquía inequívoca del código, knowledge y finalmente texto. En particular, `1.01.59.00` queda clasificada como Activo. Los candidatos `review` se persisten con estado propio y la interfaz los muestra como “Sugerencia pendiente de revisión”. No se modificaron pesos ni umbrales.

## Auditoría residual de nombres y evidencia semántica

`canonicalName` proviene de `company_accounts.name`; el listado lo selecciona como `account.name`. El importador de Balance sólo escribe ese nombre cuando crea por primera vez la identidad `(company_id, internal_code)`. En cargas posteriores actualiza exclusivamente `last_seen_tax_period_id`, `last_seen_at` y `updated_at`; cuando el nombre difiere emite `ACCOUNT_NAME_CHANGED`, pero no ejecuta un update de `name`. Por tanto, el valor mostrado como canónico era el primer nombre registrado para ese código interno, posiblemente en otro período, no una sobrescritura reciente.

Cada fila importada conserva además `balance_entries.account_name` y el upsert de presencia conserva el nombre vigente en `tax_period_company_accounts.account_name_snapshot`. Esta combinación permite demostrar el nombre histórico de identidad y el observado por período sin modificar mappings ni crear cuentas duplicadas. La tabla muestra sólo el nombre observado. El modal denomina los campos “Nombre observado” y “Nombre registrado inicialmente”, evitando sugerir una acción de renombrado.

La persistencia exige evidencia semántica explícita. Califica evidencia fuerte directa o una combinación de similitud léxica media con corroboración estructural/conceptual. Balance, naturaleza y sección siguen sin bastar por sí solos; las palabras genéricas ya no se excluyen aisladamente.

Así, `Insumos de Lavandería → Maquinarias y equipos` se conserva en diagnostics como candidato estructural pero no se persiste. IVA Crédito Fiscal conserva nombre oficial y learning; Capital Social supera la puerta por `capital_is_equity`; y Ventas Servicios, Remuneraciones por Pagar y Costo de Servicios pueden quedar en review cuando similitud media y estructura se corroboran.

## Rediseño final del pipeline

La recuperación evalúa ahora todas las cuentas de la versión SII activa; terms, conceptos, knowledge y learning enriquecen candidatos, pero ya no determinan qué destinos existen. Los filtros duros se limitan a incompatibilidades contables. El ranking calcula evidencia y score; la calibración opera sólo sobre candidatos semánticamente elegibles; la decisión determina `automatic`, `review`, `ambiguous` o `no_candidate`; y persistencia se limita a guardar esa decisión sin repetir la puerta.

La puerta semántica dejó de excluir palabras genéricas de forma aislada. Acepta evidencia fuerte directa o evidencia combinada: similitud léxica media —incluyendo alias parcial, Jaccard o trigramas— corroborada por al menos dos señales estructurales o un concepto relacionado. La evidencia combinada siempre fuerza `review`, aunque su score/confidence alcanzara automatic. Así recupera costos, ventas y cuentas por pagar razonables sin permitir que sólo sección/naturaleza originen Maquinarias para Insumos de Lavandería.

El hash de learning se calcula exclusivamente con `account_name_snapshot`, usando `company_accounts.name` sólo cuando no existe snapshot. La tabla muestra únicamente el nombre observado; el modal usa “Nombre observado” y, si difiere, “Nombre registrado inicialmente”.
