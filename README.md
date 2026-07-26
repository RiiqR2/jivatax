# Balance Tributario SaaS

Base inicial del MVP interno.

## Stack

- Next.js
- NestJS
- MySQL 8
- TypeORM
- Redis + BullMQ
- Almacenamiento privado compatible con S3
  - MinIO en desarrollo local
  - Cloudflare R2, AWS S3 u otro proveedor compatible en producción
- Monorepo con pnpm workspaces, sin Turborepo

## Por qué no usamos Turborepo todavía

`pnpm workspaces` ya permite mantener `apps/web`, `apps/api` y los paquetes compartidos dentro del mismo repositorio. Turborepo agrega caché y coordinación avanzada de tareas, pero no es necesario para comenzar con dos aplicaciones. Puede incorporarse después sin modificar la arquitectura del producto.

## Inicio local

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/health
- MinIO: http://localhost:9001

## Archivos privados

El bucket se crea sin acceso anónimo. El navegador no recibe credenciales permanentes.

Flujo de carga:

1. El frontend solicita `POST /api/files/upload-url`.
2. La API genera una URL firmada de carga válida durante 15 minutos.
3. El frontend sube el archivo directamente al almacenamiento.
4. El frontend registra sus metadatos con `POST /api/files/register`.

Flujo de descarga:

1. El frontend solicita `GET /api/files/:id/download-url`.
2. La API valida el acceso —la autorización por usuario se incorporará con autenticación— y genera una URL firmada válida durante 5 minutos.

En producción, el bucket debe permanecer privado y bloquear completamente el acceso público.

## Base de datos

Durante el arranque inicial se permite `DB_SYNCHRONIZE=true` para facilitar el desarrollo. Antes de comenzar pruebas con datos importantes se debe cambiar a migraciones de TypeORM y establecer `DB_SYNCHRONIZE=false`.

## Próximo módulo

Empresas y períodos tributarios, para asociar cada archivo a una empresa y un período específico.
