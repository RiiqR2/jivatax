# Plan de cuentas por empresa

## Versionado

Cada importación crea una versión inmutable. La versión utilizable vigente es la
versión `ready` más reciente por `created_at`; no se modifica `CompanyEntity` ni
se archivan versiones anteriores de forma implícita.

## Importación

La importación es sincrónica y responde `201 Created`. Conserva durante el
proceso los estados `processing`, `ready` y `failed`, limita los archivos a 10 MB
y 20.000 cuentas, y soporta XLSX, XLS y CSV mediante SheetJS. Detecta una hoja
no vacía y, dentro de las primeras 30 filas, encabezados explícitos para código
y nombre. Reconoce los alias documentados en el servicio de parser y columnas
opcionales de descripción, nivel, código padre y estado.

Los códigos se convierten únicamente a `string` y se recortan en sus extremos;
no se convierten a número ni se eliminan ceros, puntos o guiones. Los nombres se
recortan y compactan sus espacios. Una descripción vacía pasa a `null`. La
jerarquía no se infiere por longitud: sin señal explícita confiable queda en
`null`.

## Correspondencias SII

Las sugerencias usan exclusivamente la versión SII `active` más reciente y se
generan con índices en memoria, no con una consulta por cuenta. Las reglas y
puntuaciones heurísticas son:

1. código exacto: `1.0000`;
2. nombre exacto (mayúsculas/minúsculas ignoradas): `0.9800`;
3. nombre normalizado, sin tildes y puntuación no semántica: `0.9300`;
4. contención controlada para nombres de ocho o más caracteres: `0.7500`.

La confianza es una puntuación heurística, no una probabilidad. Un empate deja
la cuenta `unmapped` y registra la ambigüedad; nunca se confirma una sugerencia
automáticamente. Confirmar, rechazar, asignar o desmapear registra revisor y
fecha. Un rechazo conserva el candidato para trazabilidad.

## Permisos

Owner, admin, accountant y auditor pueden consultar. Owner, admin y accountant
pueden importar y revisar correspondencias. Viewer no tiene acceso al módulo.
Todas las operaciones validan membresía activa, organización seleccionada y
pertenencia de la empresa al tenant.

## Contrato de importación

La plantilla oficial se descarga autenticadamente desde
`GET /api/companies/:companyId/account-plan/template` y usa la hoja **Plan de
cuentas** con estos encabezados canónicos, en este orden:

1. `Código` (obligatorio, texto, máximo 100 caracteres y único en el archivo).
2. `Nombre` (obligatorio, texto, máximo 255 caracteres).
3. `Descripción` (opcional, texto).
4. `Nivel` (opcional, entero positivo).
5. `Código padre` (opcional, texto y referencia a otro código del archivo).
6. `Estado` (opcional: `active`, `inactive`, `activo` o `inactivo`; el valor por
   defecto es `active`).

Los códigos deben mantenerse como texto para preservar ceros iniciales, puntos y
guiones. Se admiten archivos XLSX, XLS y CSV de hasta 10 MB y 20.000 cuentas. No
se deben incluir totales, encabezados repetidos, fórmulas ni celdas combinadas.
Cada fila debe representar una cuenta.

Los alias históricos se conservan en el contrato del parser. `Cuenta` no se usa
como alias porque es ambiguo. Cuando se detectan encabezados duplicados o
ambiguos, la importación se aborta y recomienda usar la plantilla oficial.

## Próximo PR: previsualización

El endpoint de previsualización queda fuera de este cambio para no ampliar el
flujo de importación ni duplicar su lógica. Una implementación futura debe
reutilizar el mismo parser y no persistir versiones ni generar mappings.
