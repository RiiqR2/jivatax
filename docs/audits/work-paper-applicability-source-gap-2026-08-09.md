# Matriz de aplicabilidad A.1–A.20 — bloqueo de fuente (2026-08-09)

## Resultado

La matriz externa mencionada en el requerimiento no está incluida en el
repositorio, en archivos no versionados del workspace ni en el historial Git
disponible. Por seguridad tributaria **no se transcribió ni infirió ninguna
asociación**. En particular, no se usaron nombres, jerarquía, regex, UUID ni
semejanza semántica.

Se dejó versionado el compilador/auditor determinístico y la ubicación del
dataset. Cuando el equipo tributario entregue la fuente, debe transcribirse con
su número de fila original y fijarse un identificador verificable de versión.

## Reporte actual

| Métrica                               | Resultado |
| ------------------------------------- | --------: |
| Filas fuente A.1–A.20 disponibles     |         0 |
| Asociaciones persistibles             |         0 |
| Duplicados                            |         0 |
| Códigos inexistentes verificables     |         0 |
| Filas `0` disponibles                 |         0 |
| Filas A.21+ disponibles               |         0 |
| Papeles sin asociaciones              |  A.1–A.20 |
| Códigos asociados a múltiples papeles |   ninguno |

## Role key

Cuando una fila curada no trae rol inequívoco, el compilador asigna
`APPLICABILITY_ONLY`. Es una marca explícita de detección, no un rol tributario
del calculator. A.17 requerirá curación adicional antes de convertir esas filas
en `LEASE_LIABILITY` o `DEFERRED_LEASE_INTEREST`.

## Validación real pendiente

No existe una base MySQL ni un catálogo/empresa de prueba accesible en este
entorno. Sin asociaciones fuente no es posible afirmar qué papeles detectaría
la empresa homologada. Ejecutar esa consulta inventando códigos contradiría la
regla central del requerimiento.

## Insumo requerido del auditor

1. Matriz original (o exportación CSV/XLSX) con código de papel, código SII y
   número/identificador estable de fila.
2. Identificador de versión o checksum aprobado por el equipo tributario.
3. Para A.17, asignación explícita de rol solo si la fuente permite distinguir
   obligación de leasing e interés diferido.
