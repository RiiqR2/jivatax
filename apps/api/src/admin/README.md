# Administración global

Los endpoints `/api/admin/*` requieren un usuario activo con `platform_role = 'metauser'`.
El rol de plataforma es independiente de los roles de `organization_members`; los endpoints
tenant de empresas conservan su validación por organización activa.

Para promover al primer metausuario, ejecute manualmente con un correo controlado:

```sql
UPDATE users
SET platform_role = 'metauser'
WHERE email = 'admin@jivatax.cl';
```

La contraseña temporal creada por administración se almacena con Argon2id. El flujo de
cambio obligatorio de contraseña queda pendiente para un PR posterior; este módulo no
agrega `must_change_password` para no bloquear el acceso sin una pantalla disponible.
