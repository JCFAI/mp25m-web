# MP25M Web

Primera aplicación web del Movimiento Productivo 25 de Mayo para actualización de perfiles, nodos, habilidades y vectores.

## Estado del backend

El proyecto Supabase `MP25M` ya tiene desplegadas estas Edge Functions:

- `mp25m-profile-get`
- `mp25m-profile-submit`

El esquema `mp25m` está protegido con RLS y sin acceso directo desde `anon`/`authenticated`. Las Edge Functions trabajan del lado servidor.

## Ejecutar localmente

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Formulario

La ruta es:

```text
/perfil/actualizar#t=TOKEN_PERSONAL
```

El token se envía en el fragmento `#t=` para que no viaje como query string al servidor ni quede en logs HTTP. El componente lo lee una vez y limpia la barra de direcciones.

## Generar un enlace personal

Este comando es exclusivamente administrativo y requiere una conexión PostgreSQL privada en `DATABASE_URL`.

Por nombre, solo si la búsqueda devuelve exactamente una persona:

```bash
npm run profile-link -- --search "Nombre Apellido" --base-url https://tu-dominio.org
```

O por UUID:

```bash
npm run profile-link -- --person-id UUID --base-url https://tu-dominio.org
```

La duración predeterminada es 30 días. Puede cambiarse:

```bash
npm run profile-link -- --person-id UUID --days 14
```

Al generar un enlace nuevo se revoca cualquier token activo anterior de esa persona. PostgreSQL almacena únicamente el hash SHA-256 del token.

## Variables

- `NEXT_PUBLIC_SUPABASE_URL`: identificador público del proyecto Supabase. No contiene secretos.
- `DATABASE_URL`: **secreto de administración/servidor**. Nunca debe tener prefijo `NEXT_PUBLIC_`.
- `MP25M_PUBLIC_BASE_URL`: dominio utilizado por el script al imprimir enlaces.

## Flujo de datos

1. La persona abre su enlace personal.
2. `mp25m-profile-get` valida el hash y devuelve su perfil y catálogos.
3. El navegador completa los seis pasos.
4. `mp25m-profile-submit` registra el payload en la capa de ingesta.
5. Cambios seguros se aplican automáticamente.
6. Nodos, roles y propuestas que requieren validación quedan en revisión.
7. El token queda usado y no puede reutilizarse.
