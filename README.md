# JivaTax

Base monorepo para el desarrollo de JivaTax.

## Requisitos

- Node.js 22
- pnpm 9
- Docker Desktop

## Inicio rápido

```bash
nvm use
cp .env.example .env
pnpm install
pnpm infra:up
pnpm --filter @jivatax/api migration:run
pnpm dev
```

## Estructura

- `apps/api`: API NestJS
- `apps/web`: frontend Next.js
- `packages/shared`: código compartido
- `infra`: infraestructura y scripts

## Autenticación local y sesiones

La API mantiene sesiones en Redis; el navegador recibe únicamente `jivatax.sid` como cookie opaca `HttpOnly`. Copia `.env.example`, genera un `SESSION_SECRET` aleatorio de al menos 32 bytes y levanta MySQL, Redis y MinIO con `docker compose up -d`.

Para asignar una contraseña inicial en desarrollo (nunca hay una por defecto):

```bash
JIVATAX_DEV_PASSWORD='una-clave-segura-de-desarrollo' pnpm --filter @jivatax/api auth:set-password --email admin@jivatax.cl
```

La variable temporal no debe guardarse ni versionarse. En producción configura `SESSION_SECURE=true` y, si termina TLS detrás de un proxy, `TRUST_PROXY=true`.
