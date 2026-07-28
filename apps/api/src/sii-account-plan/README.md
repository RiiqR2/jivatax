# Plan de cuentas maestro SII

Este módulo contiene un catálogo global e inmutable por versión. No tiene claves de
organización, empresa ni usuario, y deliberadamente no contiene mappings a cuentas
internas.

## Fuente y análisis previo

El importador está diseñado para el archivo oficial `reso18Anexo1.xls` (Anexo N°1.A
Blce). El binario no estaba presente en el workspace al implementar este cambio y no
se agregó al repositorio. Por eso no se declara una cantidad, hoja, encabezado ni
checksum del archivo oficial sin evidencia. Antes de una carga real, el modo
`--dry-run` entrega esos datos y debe conservarse su reporte como evidencia.

El lector inspecciona todas las hojas y exige exactamente una hoja con una fila que
contenga una columna de código y una columna de nombre/descripción. Lee valores
mostrados como texto para preservar ceros iniciales. Las columnas reconocidas son:

- código: `codigo`, `código`, `cod cuenta` o `codigo cuenta`;
- nombre: `descripcion`, `descripción`, `nombre`, `nombre cuenta` o `glosa`;
- descripción adicional: `detalle`, `observacion` u `observación`;
- nivel: `nivel`, únicamente si está explícito.

Todas las demás columnas se conservan normalizadas dentro de
`rawData.sourceColumns`; no se convierten en semántica de dominio. Las filas vacías
se eliminan y las filas con nombre pero sin código se reportan como títulos/notas.
No se evalúan fórmulas ni macros. La firma OLE, extensión y límite de 20 MiB se
validan antes de abrir el libro.

## Importación

```bash
pnpm --filter @jivatax/api sii:import-account-plan -- \
  --file /ruta/real/reso18Anexo1.xls \
  --code anexo-1a-blce \
  --name "Anexo N°1.A Blce" \
  --dry-run
```

Después de revisar el reporte, se repite sin `--dry-run`. Cada versión se importa
como `draft`; la activación será una operación administrativa controlada en un PR
posterior. El SHA-256 impide importar dos veces el mismo binario y la carga real usa
una única transacción. Una publicación distinta necesita un `code` de versión
nuevo; nunca se sobrescribe ni borra una versión anterior.

El paquete backend fija `xlsx` 0.18.5 para leer BIFF/OLE `.xls`. Su uso está aislado
al CLI: no abre rutas por HTTP, no ejecuta macros y solicita valores cacheados sin
fórmulas.

## API

Las rutas autenticadas son:

- `GET /api/sii/account-plan/versions`;
- `GET /api/sii/account-plan/accounts`;
- `GET /api/sii/account-plan/accounts/:accountId`.

El listado admite `versionId`, `search`, `code`, `parentId`, `level`, `page` y
`pageSize`. No expone `rawData` ni checksum. La vista administrativa y la carga HTTP
quedan fuera del alcance.

## Matching futuro

Las futuras `company_accounts` y `company_account_mappings` deberán referenciar
`sii_accounts`. La cuenta maestra no almacenará empresa, movimientos, confianza ni
estado de revisión, lo que permite muchas cuentas internas por cuenta SII sin
contaminar el catálogo oficial.
