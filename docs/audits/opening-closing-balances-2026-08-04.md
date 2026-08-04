# Auditoría del modelo y decisión: balances de apertura y cierre

## Modelo encontrado

- `tax_documents.document_type` usa `balance`, `general_ledger` o `journal`. La versión era única por empresa, período, tipo y número; el documento reemplazado se enlaza con `replaces_document_id`, y una publicación válida cambia la versión procesada anterior a `superseded` dentro de la misma transacción.
- `balance_imports` tiene una relación única 1:1 con `tax_documents` y conserva reporte, totales, hoja y encabezado. Su metadata no distinguía apertura/cierre. `tax_documents.metadata` contiene el reporte de parsing, no una identidad de dominio estable.
- `balance_entries` conserva las filas normalizadas por importación. `tax_period_company_accounts` publica una fila vigente por cuenta interna y período, con snapshots de código/nombre y referencia al documento/entrada que la originó.
- El Balance procesado crea o reutiliza `company_accounts` mediante `(company_id, internal_code)` y crea el mapping pendiente solo para cuentas nuevas; por ello funciona como catálogo mínimo acumulativo. El nombre importado queda como snapshot y no reemplaza automáticamente el nombre canónico.
- Documentos consultaba el historial por tipo y el Explorador seleccionaba el máximo `version_number` procesado y no descartado por tipo. Por tanto, el contrato anterior tenía una fuente ambigua `balanceDocument`.
- No había metadata de dominio reutilizable y con restricciones adecuadas para dos historiales activos. Un campo JSON permitiría guardar un texto, pero no una restricción/indexación segura. No fue necesario crear una tabla: se agregó la columna explícita `balance_role` al documento existente.

## Modelo adoptado y compatibilidad

- Los balances nuevos mantienen `document_type=balance` y exigen `balance_role=opening|closing`. Versionan y superseden por empresa, período, tipo y rol. El supersede ocurre solo después de persistir una importación válida y sus filas dentro de la transacción.
- Los históricos quedan con `balance_role=NULL`: la migración no adivina ni reclasifica documentos ambiguos. No se consideran cierre operativo hasta una clasificación administrativa con evidencia.
- Se agregó `balance_entries.company_account_id` nullable. Las nuevas filas guardan la identidad persistente; el control de apertura usa código interno exacto cuando alguna fila histórica carece de esa identidad.
- Ambos roles alimentan el catálogo acumulativo sin duplicar `company_accounts`. Solo el cierre publica `tax_period_company_accounts`, evitando mezclar las dos fotografías en una tabla cuya unicidad representa el estado final del período.
- Libro Diario conserva entidades, tablas, parser, importación y pruebas, pero se oculta del selector operativo y no participa en el estado derivado de completitud.

## Estabilización previa al merge

- `tax_period_company_accounts` es una proyección operativa, no el historial. Al publicar un cierre se persisten y publican sus cuentas dentro de la transacción y, una vez completa esa publicación, se marcan como descartadas las filas activas cuyo `source_document_id` no corresponde al cierre nuevo. Las importaciones y `balance_entries` anteriores no se eliminan. Un error revierte tanto el descarte como la publicación.
- Los balances procesados con rol `NULL` se muestran como pendientes y nunca se resuelven como fuente. La clasificación es una acción separada protegida para metausuarios y registra `balance_role_classified_by_user_id` y `balance_role_classified_at`; no altera el archivo ni la importación.
- El rollback comprueba colisiones de la antigua clave única antes de modificar el esquema. Si coexisten, por ejemplo, `opening v1` y `closing v1`, falla con un mensaje explícito y no renumera datos.
- El control de apertura calcula estado y diferencias con `DECIMAL(24,4)` en MySQL. El endpoint de Balance expone solamente el resumen; el detalle paginado se solicita por separado al abrir el control.

## Auditoría de resúmenes del Balance

- La tabla publicada `balance_reported_summaries` ya conservaba por importación la etiqueta, fila fuente y las ocho columnas informadas, por lo que se reutilizó. La migración posterior agrega contexto directo de empresa, período, documento, rol, etiqueta normalizada y datos crudos; no se creó otra tabla.
- `balance_source_rows` conserva todas las filas y ahora admite `reported_summary` para etiquetas genéricas con montos. Solo `account` puede crear `balance_entries`, cuentas internas o proyecciones operativas.
- Los totales calculados y sus diferencias usan strings DECIMAL escalados a cuatro posiciones mediante `bigint`; no suman floats de JavaScript. Los valores informados nunca se reemplazan.
