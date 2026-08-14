# Matriz de aplicabilidad A.1–A.20 — estado (2026-08-14)

La brecha de fuente del 2026-08-09 quedó cerrada. La transcripción
versionada de `Carga Masiva Plan de Cuentas V2.xlsx` vive en
`apps/api/src/tax-work-papers/data/curated-applicability-matrix.ts`
(`carga-masiva-plan-cuentas-v2-2026-08-09`).

| Métrica                            |            Resultado |
| ---------------------------------- | -------------------: |
| Filas fuente transcritas           |                  156 |
| Asociaciones persistibles A.1–A.20 |                   85 |
| Filas `0` ignoradas en compile     |                   64 |
| Filas A.21+ ignoradas en compile   |                    7 |
| Role key                           | `APPLICABILITY_ONLY` |

Persistencia: migración `1785045000000` y
`CuratedApplicabilitySyncService`. Identidad durable:
`definitionId + siiAccountCode + roleKey`.
