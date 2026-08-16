# MP25M - Diseno Tecnico Incremento 1

## 1. Objetivo del incremento

El Incremento 1 tiene como objetivo preparar la base tecnica para un backoffice privado del Sistema MP25M, con autenticacion, roles funcionales y estructura inicial de panel interno.

Este incremento debe mantener sin cambios:

- La pagina publica actual.
- El formulario `/perfil/actualizar`.
- La actualizacion mediante enlace personal.
- La Edge Function `mp25m-profile-get`.
- La Edge Function `mp25m-profile-submit`.
- Los datos actuales alojados en el esquema `mp25m`, incluyendo personas, nodos, habilidades y vectores.

El formulario personal por token continua siendo un circuito independiente. No debe transformarse en login interno, no debe depender del backoffice y no debe modificarse en este incremento.

## 2. Inventario tecnico actual

### Estado Git y rama

Antes de redactar este documento se verifico:

- `main` esta sincronizada con `origin/main`.
- `HEAD` y `origin/main` apuntan al commit `d6a552a`.
- `git status -sb` no mostro cambios pendientes antes de crear este archivo.

### Stack y dependencias

El proyecto esta definido en `package.json` como `mp25m-web`, version `0.1.0`, privado.

| Elemento | Version observada |
|---|---|
| Next.js | `16.1.6` |
| React | `19.2.3` |
| React DOM | `19.2.3` |
| TypeScript | `5.9.3` |
| postgres | `3.4.7` |

Dependencias actuales:

- `next`
- `react`
- `react-dom`
- `postgres`

Dev dependencies actuales:

- `typescript`
- `@types/node`
- `@types/react`
- `@types/react-dom`

Scripts disponibles:

| Script | Uso |
|---|---|
| `dev` | Ejecuta `next dev`. |
| `build` | Ejecuta `next build`. |
| `start` | Ejecuta `next start`. |
| `lint` | Ejecuta `next lint`. |
| `profile-link` | Ejecuta `node scripts/create-profile-link.mjs`. |

`package-lock.json` confirma las mismas dependencias raiz. No hay dependencias de Supabase JS instaladas todavia.

### Variables documentadas

`.env.example` documenta:

| Variable | Visibilidad | Uso actual |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Publica | URL publica del proyecto Supabase usada por el formulario. |
| `DATABASE_URL` | Secreta, servidor/administracion | Conexion PostgreSQL privada para `npm run profile-link`. |
| `MP25M_PUBLIC_BASE_URL` | No secreta | Base URL publica para imprimir enlaces personales. |

No se revisaron archivos `.env`, `.env.local` ni secretos locales.

### Archivos ignorados

`.gitignore` excluye:

- `node_modules`
- `.next`
- `.env`
- `.env.local`
- `.env.*.local`
- `.vercel`
- logs
- `.DS_Store`

### TypeScript

`tsconfig.json` usa modo estricto, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, plugin de Next y excluye `supabase/functions`. Incluye tipos generados de Next tanto en `.next/types` como en `.next/dev/types`.

### Rutas actuales

| Ruta | Archivo | Estado |
|---|---|---|
| `/` | `app/page.tsx` | Pagina publica institucional simple. |
| `/perfil/actualizar` | `app/perfil/actualizar/page.tsx` | Renderiza `ProfileUpdateForm`. |

No existen rutas de login, backoffice, recuperacion de clave, callback de auth, acceso denegado ni API interna.

### Componentes actuales

| Componente | Archivo | Funcion |
|---|---|---|
| `ProfileUpdateForm` | `components/ProfileUpdateForm.tsx` | Formulario cliente de seis pasos para actualizar perfil mediante token. |

El componente lee el token desde `window.location.hash`, limpia la URL con `history.replaceState`, consulta `mp25m-profile-get` y envia a `mp25m-profile-submit`.

### Integracion actual con Supabase

La integracion actual no usa `@supabase/supabase-js` ni `@supabase/ssr`. El formulario cliente usa `fetch` directo contra:

- `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mp25m-profile-get`
- `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mp25m-profile-submit`

El script administrativo `scripts/create-profile-link.mjs` usa `postgres` y `DATABASE_URL` para llamar funciones privadas de PostgreSQL y generar enlaces personales.

### Edge Functions existentes

En el repositorio local existe:

| Funcion | Archivo local | Observacion |
|---|---|---|
| `mp25m-profile-submit` | `supabase/functions/mp25m-profile-submit/index.ts` | Edge Function Deno que valida payload, hashea token y llama `mp25m_private.profile_submit_by_token`. |

`supabase/config.toml` contiene:

| Funcion | Configuracion |
|---|---|
| `mp25m-profile-submit` | `verify_jwt = false` |

El README indica que tambien existe `mp25m-profile-get`, pero su codigo no esta en el repositorio local.

### Supabase Auth y clientes Supabase

Desde el repositorio local:

| Elemento | Estado |
|---|---|
| Supabase Auth en la app Next.js | No hay implementacion visible. |
| Cliente Supabase para navegador | No existe. |
| Cliente Supabase para servidor | No existe. |
| Utilidades SSR con cookies | No existen. |
| `proxy.ts` | No existe. |
| `middleware.ts` | No existe. |
| Login/logout/recuperacion | No existen. |
| Backoffice protegido | No existe. |

### Migraciones

No hay carpeta `supabase/migrations` en el repositorio local. No debe inferirse el esquema remoto desde el codigo.

### Datos aun no determinables solo desde el repositorio

El estado remoto principal ya fue verificado y se documenta en la seccion siguiente. Desde el repositorio local todavia no puede determinarse:

- Si hay funciones SQL `SECURITY DEFINER` y como estan protegidas.
- Definiciones completas de funciones SQL, vistas, triggers y constraints no visibles en el codigo local.
- Configuracion operativa exacta de esquemas expuestos a Data API antes de modificarla.
- Configuracion de redirect URLs de Auth.
- Configuracion SMTP para recuperacion de contrasena.
- Presencia de claves publicables nuevas o anon legacy en el dashboard.

## Hallazgos verificados del entorno remoto — 2026-08-16

Estos hechos deben ser tratados como condicionantes del diseno tecnico del Incremento 1:

- El proyecto Supabase MP25M esta activo y utiliza PostgreSQL 17.
- El esquema `public` no contiene tablas.
- Los datos productivos actuales estan en el esquema `mp25m`.
- Entre las tablas existentes del esquema `mp25m` estan `persons`, `nodes`, `skills`, `vectors`, `person_contacts`, `person_skills`, `node_participations`, `person_vectors` y `node_vectors`.
- `auth.users` y `auth.identities` no tienen usuarios todavia.
- `mp25m.roles` ya representa roles territoriales. No debe reutilizarse para permisos de acceso al sistema.
- Todas las tablas de `mp25m` tienen RLS habilitado, pero actualmente no existen politicas RLS.
- `anon` y `authenticated` no tienen `USAGE` del esquema `mp25m` ni permisos sobre sus tablas. `service_role` si los tiene.
- El esquema `mp25m_private` contiene `profile_access_tokens`, `profile_submissions`, `profile_review_items` y `skill_suggestions`.
- `mp25m_private` no tiene RLS, pero tampoco concede acceso a `anon` ni `authenticated`. Debe permanecer fuera de los esquemas expuestos y accesible solamente mediante `service_role`.
- El flujo actual por token y las Edge Functions `mp25m-profile-get` y `mp25m-profile-submit` deben mantenerse sin cambios.
- `person_contacts` usa actualmente los niveles de visibilidad `private`, `internal` y `public`. No se debe modificar esa restriccion en este incremento.

## 3. Arquitectura propuesta

### Principios

- Autenticacion y autorizacion son responsabilidades distintas.
- Estar autenticado no habilita automaticamente el backoffice.
- La autorizacion debe reforzarse en la base mediante RLS.
- No usar `user_metadata` ni `raw_user_meta_data` para decisiones de autorizacion.
- No exponer `service_role`, `sb_secret_*` ni claves privadas al navegador.
- Las lecturas internas deben preferir Server Components.
- Las mutaciones internas deben preferir Server Actions cuando no se necesite una API externa.
- Usar Node.js runtime por defecto.
- En Next.js 16 se debe contemplar `proxy.ts`, no `middleware.ts`.
- No habilitar acceso directo de `authenticated` al esquema `mp25m` hasta crear, revisar y probar politicas RLS precisas.
- Mantener `mp25m_private` fuera de Data API y accesible solo por rutas privilegiadas existentes que usan `service_role`.

### Supabase Auth

Se recomienda usar Supabase Auth con email y contrasena para usuarios internos, sin registro publico. Como actualmente no existen usuarios en `auth.users` ni `auth.identities`, el primer usuario debe crearse mediante un procedimiento de bootstrap controlado; despues de eso, los usuarios deben ser creados o invitados por un administrador.

Motivo:

- Permite sesiones estandar administradas por Supabase.
- Integra los JWT con RLS.
- Evita construir autenticacion propia.
- Permite recuperacion de contrasena si se configuran correctamente los emails y redirect URLs.

### Sesion mediante cookies

Se recomienda usar sesiones SSR basadas en cookies con `@supabase/ssr`.

Motivo:

- App Router necesita acceso a sesion desde Server Components, Server Actions y rutas protegidas.
- Las cookies permiten renderizado servidor sin depender de localStorage.
- Server Components no pueden refrescar cookies por si solos, por lo que se requiere un mecanismo de renovacion en `proxy.ts`.

### Cliente Supabase para navegador

Crear una utilidad conceptual `lib/supabase/client.ts` para Client Components que necesiten operaciones de Auth, por ejemplo login, recuperacion de contrasena o cambio de contrasena.

Debe usar solo:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o clave anon publica compatible mientras se migra.

No debe recibir claves secretas.

### Cliente Supabase para servidor

Crear una utilidad conceptual `lib/supabase/server.ts` para Server Components, Server Actions y Route Handlers internos.

Debe:

- Leer cookies del request.
- Crear cliente SSR con contexto de usuario.
- Usar `supabase.auth.getClaims()` como verificacion primaria de identidad del lado servidor.
- Usar `getUser()` solo como comprobacion adicional cuando sea necesario por disponibilidad o diagnostico.
- No confiar en el usuario retornado solamente por `getSession()` para proteger paginas o datos.

### Renovacion y verificacion de sesion

Crear `proxy.ts` en la raiz del proyecto para renovar/verificar sesion y redirigir rutas protegidas cuando corresponda.

En Next.js 16, `proxy.ts` reemplaza la convencion `middleware.ts`. El proxy debe mantenerse liviano:

- Refrescar token/cookies.
- Detectar rutas protegidas como `/panel`.
- Redirigir visitantes no autenticados a `/login`.
- Evitar ejecutar logica completa de autorizacion de negocio.

La autorizacion fina debe verificarse tambien en Server Components, Server Actions y RLS.

### Proteccion de rutas

Capas recomendadas:

| Capa | Responsabilidad |
|---|---|
| `proxy.ts` | Control temprano de sesion y redirects para `/panel`. |
| Layout protegido | Verificar usuario y rol interno antes de renderizar backoffice. |
| Server Components | Ejecutar lecturas internas con cliente servidor y RLS. |
| Server Actions | Validar usuario, rol, alcance y permisos antes de mutar. |
| RLS | Garantizar autorizacion en la base incluso si falla una capa de UI. |

### Login

`/login` debe permitir email y contrasena. No debe incluir registro publico.

Flujo:

1. Usuario ingresa email y contrasena.
2. Supabase Auth valida credenciales.
3. Se crean cookies de sesion.
4. El servidor verifica si el usuario tiene rol interno activo.
5. Si tiene rol, redirige a `/panel`.
6. Si no tiene rol, redirige a `/sin-acceso`.

### Logout

El cierre de sesion debe:

- Llamar a Supabase Auth para cerrar sesion.
- Limpiar cookies.
- Redirigir a `/login`.
- Impedir volver a `/panel` con navegacion posterior.

### Recuperacion de contrasena

`/recuperar-clave` debe solicitar email y disparar el flujo de recuperacion de Supabase Auth. La URL de redireccion debe estar permitida en Supabase.

Segun el flujo que se adopte, puede requerirse:

- `/auth/callback` para intercambio de codigo o confirmacion.
- Una pagina posterior para definir nueva contrasena.

No debe almacenarse una contrasena fija en el repositorio.

### Pagina de acceso denegado

`/sin-acceso` debe explicar que la cuenta existe o la sesion es valida, pero no tiene rol interno activo para ingresar al backoffice.

No debe revelar roles, existencia de personas vinculadas ni informacion interna.

### Layout protegido del backoffice

`/panel` debe tener un layout protegido que:

- Verifique sesion.
- Verifique rol interno activo.
- Cargue identidad del usuario.
- Cargue roles y alcances habilitados.
- Muestre navegacion interna.
- Ofrezca cierre de sesion.
- Evite exponer contactos privados salvo permiso especifico.

## 4. Estructura de rutas propuesta

Se recomienda usar grupos de rutas para organizar sin afectar URLs.

Estructura candidata:

```text
app/
  (public)/
    page.tsx                  # URL: /
    perfil/
      actualizar/
        page.tsx              # URL: /perfil/actualizar
  (auth)/
    login/
      page.tsx                # URL: /login
    recuperar-clave/
      page.tsx                # URL: /recuperar-clave
    auth/
      callback/
        route.ts              # URL: /auth/callback, solo si el flujo lo requiere
    sin-acceso/
      page.tsx                # URL: /sin-acceso
  (backoffice)/
    panel/
      layout.tsx              # URL: /panel
      page.tsx
      oportunidades/
        page.tsx              # Reservado para Incremento 2
proxy.ts
lib/
  supabase/
    client.ts
    server.ts
    proxy.ts
```

La pagina publica y `/perfil/actualizar` deben continuar accesibles sin autenticacion.

`/panel/oportunidades` puede existir como item reservado o pagina placeholder del backoffice, pero el CRUD de oportunidades no pertenece al Incremento 1.

## 5. Roles funcionales

### Separacion de conceptos

Roles territoriales existentes en `mp25m.roles`:

- Fundador.
- Referente.
- Participante.
- Contacto con fuerzas productivas.

Roles de acceso al sistema:

- Administrador.
- Validador.
- Articulador.
- Referente de nodo.
- Participante.
- Autoridad/Analista.

Los roles territoriales describen participacion en nodos. Los roles de acceso determinan que puede hacer un usuario autenticado dentro del sistema.

`mp25m.roles` no debe reutilizarse para autorizacion del backoffice. Esa tabla ya expresa un concepto funcional del modelo territorial y mezclarla con permisos de sistema generaria ambiguedad, riesgo de escalamiento y reglas RLS dificiles de auditar.

### Modelo relacional conceptual

El modelo debe representar:

- Usuario de Supabase Auth.
- Vinculacion opcional con una persona existente.
- Uno o varios roles funcionales.
- Alcance global, territorial, por nodo o por proyecto.
- Quien concedio el rol.
- Fecha de concesion.
- Vigencia.
- Estado activo o revocado.
- Historial.

Un unico campo `role` dentro del usuario es insuficiente porque:

- Una persona puede tener varios roles simultaneos.
- El alcance puede variar por nodo, territorio, proyecto o articulacion.
- Los roles pueden tener vigencia temporal.
- Debe existir historial de concesion, revocacion y cambios.
- Un usuario puede estar vinculado o no a una persona existente.
- Los roles de acceso no son lo mismo que los roles territoriales.
- No se debe depender de metadatos editables por el usuario para autorizar.

## 6. Modelo tecnico candidato sin SQL

Los nombres siguientes son conceptuales y deben validarse antes de crear migraciones. La decision de diseno es que sean tablas nuevas y claramente separadas del modelo territorial existente.

### Tablas productivas existentes a respetar

El modelo productivo actual vive en `mp25m`. Para este incremento deben preservarse, como minimo, estas tablas existentes:

- `persons`
- `nodes`
- `skills`
- `vectors`
- `person_contacts`
- `person_skills`
- `node_participations`
- `person_vectors`
- `node_vectors`
- `roles`, solo como roles territoriales, no como autorizacion del sistema.

El esquema `public` no contiene tablas y no debe usarse como supuesto para el modelo productivo actual.

### Tablas privadas existentes a preservar

El esquema `mp25m_private` contiene el circuito actual por token:

- `profile_access_tokens`
- `profile_submissions`
- `profile_review_items`
- `skill_suggestions`

Estas tablas no deben exponerse a `anon` ni `authenticated`, y este incremento no debe alterar el flujo de las Edge Functions `mp25m-profile-get` y `mp25m-profile-submit`.

### Vinculacion de cuenta interna

Entidad candidata: `internal_users`.

Campos conceptuales:

- Identificador interno.
- `auth_user_id`, referencia al usuario de Supabase Auth.
- `person_id` opcional, referencia a persona existente.
- Estado: activo, suspendido, revocado.
- Fecha de creacion.
- Usuario que creo o vinculo la cuenta.
- Observacion administrativa.

### Catalogo de roles

Entidad candidata: `access_roles`.

Campos conceptuales:

- Codigo de rol.
- Nombre visible.
- Descripcion.
- Estado activo/inactivo.
- Si es rol administrativo.
- Orden de visualizacion.

Se recomienda catalogo para evitar strings dispersos y permitir cambios controlados.

### Asignaciones de roles

Entidad candidata: `access_role_assignments`.

Campos conceptuales:

- Usuario interno.
- Rol funcional.
- Alcance.
- Estado activo o revocado.
- Concedido por.
- Fecha de concesion.
- Revocado por.
- Fecha de revocacion.
- Vigencia desde/hasta.
- Motivo u observacion.

### Alcances de rol

Entidad candidata: `access_scopes`, o campos normalizados equivalentes en asignaciones si el modelo final lo justifica.

Tipos de alcance:

| Alcance | Uso |
|---|---|
| Global | Administracion completa o lectura agregada institucional. |
| Territorial | Provincia, region o territorio definido por MP25M. |
| Nodo | Acceso operativo a un nodo. |
| Proyecto | Acceso limitado a un proyecto futuro. |
| Articulacion | Acceso limitado a una articulacion futura. |

### Auditoria de acciones sensibles

Entidad candidata: `audit_events`.

Debe registrar:

- Usuario actor.
- Accion.
- Entidad afectada.
- Fecha y hora.
- Motivo.
- Datos anteriores y nuevos cuando corresponda.
- IP o user agent si la politica lo permite.
- Resultado: permitido, rechazado, error.

Acciones sensibles iniciales:

- Login exitoso/fallido si se decide registrar fuera de Auth.
- Acceso a contacto privado.
- Asignacion o revocacion de rol.
- Vinculacion de usuario Auth con persona.
- Cambio de visibilidad.
- Baja logica.
- Invalidacion de enlace personal.

## 7. Matriz de permisos

### Permisos por rol

| Rol | Ver | Crear | Modificar | Validar | Asignar | Administrar |
|---|---|---|---|---|---|---|
| Administrador | Informacion interna y restringida segun necesidad operativa; confidencial solo cuando corresponda. | Usuarios internos, roles, configuracion inicial. | Cuentas internas, roles, catalogos operativos. | Puede validar dentro de alcance global. | Puede conceder y revocar roles, excepto autoelevarse. | Configuracion completa del backoffice. |
| Validador | Datos pendientes dentro de su alcance. | Observaciones y evidencias. | Estados de validacion dentro de alcance. | Puede aprobar, rechazar o pedir correccion. | No asigna roles, salvo autorizacion futura explicita. | No administra sistema. |
| Articulador | Oportunidades/articulaciones asignadas y datos necesarios. | Seguimientos futuros y registros operativos asignados. | Oportunidades/articulaciones asignadas en futuros incrementos. | No valida datos maestros salvo permiso adicional. | Puede sugerir colaboradores, no conceder roles. | No administra sistema. |
| Referente de nodo | Informacion operativa de su nodo. | Observaciones y solicitudes vinculadas al nodo. | Datos operativos del nodo segun permisos futuros. | Puede confirmar pertenencia/rol territorial si esta autorizado. | No asigna roles de acceso. | No administra sistema. |
| Participante | Perfil propio y funciones internas habilitadas. | Declaraciones propias, respuestas a convocatorias futuras. | Perfil propio segun reglas. | No valida. | No asigna. | No administra. |
| Autoridad/Analista | Indicadores e informacion agregada. | Informes o notas analiticas futuras. | No modifica datos operativos salvo permiso adicional. | No valida por defecto. | No asigna. | No administra por defecto. |

### Permisos por visibilidad

`person_contacts` conserva en este incremento el constraint actual de visibilidad: `private`, `internal` y `public`.

Los niveles funcionales nuevos, como informacion restringida por nodo/proyecto o confidencial con motivo operativo, deben modelarse posteriormente mediante autorizacion, alcances, vistas seguras o auditoria, sin alterar ahora el constraint existente de `person_contacts`.

| Tipo de informacion | Regla propuesta |
|---|---|
| Publica | Visible sin autenticacion si fue aprobada para difusion. |
| Interna | Visible solo para usuarios autenticados con rol interno activo. |
| Restringida por nodo, articulacion o proyecto | Visible solo si el rol y alcance coinciden o si existe responsabilidad asignada. |
| Confidencial | Visible solo con autorizacion especifica y motivo operativo. |
| Contactos privados | Privados por defecto; consulta justificada, limitada y auditable cuando corresponda. |

## 8. Estrategia RLS

### Estado remoto verificado

- Todas las tablas actuales de `mp25m` tienen RLS habilitado.
- Actualmente no existen politicas RLS en `mp25m`.
- `anon` y `authenticated` no tienen `USAGE` del esquema `mp25m` ni permisos sobre sus tablas.
- `service_role` si tiene acceso y debe seguir limitado a entornos confiables.
- `mp25m_private` no tiene RLS, pero tampoco esta concedido a `anon` ni `authenticated`.

Este estado es restrictivo para clientes anonimos y autenticados. La etapa de implementacion no debe romperlo concediendo permisos antes de contar con politicas RLS revisadas y probadas.

### Que debe garantizar RLS

RLS debe garantizar que ningun cliente pueda leer o modificar datos fuera de sus permisos aunque exista un error en la UI, una llamada manual a la API o una Server Action mal protegida.

Debe cubrir:

- Usuarios internos.
- Asignaciones de roles.
- Alcances.
- Auditoria.
- Contactos privados.
- Datos operativos futuros.

### Autenticado no equivale a autorizado

El rol Postgres `authenticated` solo indica que hay un usuario autenticado. No indica que sea administrador, validador, articulador o referente. Por eso no debe usarse una politica que diga solamente `TO authenticated` sin condicion de autorizacion.

### Evaluacion de roles y alcances

Las politicas deben evaluar:

- `auth.uid()` como usuario autenticado.
- Existencia de `internal_users` activo.
- Rol funcional activo.
- Vigencia del rol.
- Alcance compatible con la entidad consultada.
- Estado no revocado.

La evaluacion debe basarse en `internal_users`, `access_roles`, `access_role_assignments` y `access_scopes`, no en `user_metadata` ni en `mp25m.roles`.

### Exposicion controlada de `mp25m`

El esquema `mp25m` solo deberia habilitarse para Data API y para el rol `authenticated` despues de:

- Crear las tablas nuevas de autorizacion.
- Crear el primer administrador de forma auditada.
- Definir politicas RLS por tabla y operacion.
- Revisar que ninguna politica use solo `TO authenticated` como autorizacion suficiente.
- Ejecutar pruebas positivas y negativas con `anon`, `authenticated` y `service_role`.
- Confirmar que los endpoints por token existentes siguen funcionando.

Hasta entonces, no se recomienda conceder `USAGE` ni permisos de tablas a `authenticated`.

### `mp25m_private`

`mp25m_private` debe permanecer fuera de los esquemas expuestos a Data API y sin permisos para `anon` o `authenticated`.

El aviso de RLS deshabilitado en `mp25m_private` requiere analisis de defensa en profundidad, pero no debe corregirse automaticamente en este incremento. Activar RLS o modificar permisos sin revisar funciones y grants podria afectar el flujo existente por token.

La proteccion inicial aceptada para este incremento es:

- Sin exposicion a Data API.
- Sin grants a `anon` ni `authenticated`.
- Acceso solo mediante `service_role` en Edge Functions o procedimientos administrativos confiables.
- Revision posterior de politicas, funciones `SECURITY DEFINER`, grants y auditoria.

### Proteccion de contactos privados

Los contactos deben tener politicas separadas o vistas seguras que:

- Oculten por defecto telefono y email.
- Permitan lectura propia.
- Permitan lectura a responsables operativos autorizados.
- Registren acceso cuando corresponda.
- Respeten revocacion de visibilidad.
- Mantengan sin cambios los valores actuales `private`, `internal` y `public` de `person_contacts`.

### Impedir elevacion de privilegios

RLS y Server Actions deben impedir que:

- Un usuario se asigne roles a si mismo.
- Un usuario modifique su propio alcance.
- Un usuario reactive un rol revocado.
- Un usuario cambie `granted_by`, fechas o auditoria.
- Un usuario use un rol territorial como si fuera rol de acceso.

### Actualizaciones

Las actualizaciones requieren politicas de lectura y condiciones `USING` y `WITH CHECK`. Sin una politica de lectura compatible, un `UPDATE` puede no encontrar filas; sin `WITH CHECK`, podria permitirse escribir valores no autorizados.

### Funciones privilegiadas y vistas

Las funciones privilegiadas requieren revision especial. No se debe usar `SECURITY DEFINER` para tapar errores de permisos sin justificarlo y auditarlo.

Las vistas deben respetar RLS mediante configuracion apropiada cuando aplique, o mantenerse fuera de esquemas expuestos si no deben ser accesibles desde Data API.

### Pruebas negativas necesarias

Como minimo:

- Usuario no autenticado no lee datos internos.
- Usuario autenticado sin rol no entra a `/panel`.
- Usuario autenticado sin rol no puede consultar directamente tablas de `mp25m` fuera de su alcance aunque conozca la URL o use un cliente manual.
- Participante no ve contactos privados de otros.
- Referente de un nodo no ve informacion restringida de otro nodo.
- Validador fuera de alcance no valida.
- Articulador no asignado no accede a articulaciones ajenas.
- Usuario no puede concederse rol.
- Usuario no puede modificar `auth_user_id` o `person_id` para escalar privilegios.
- Rol revocado deja de habilitar acceso inmediatamente.
- `anon` no obtiene datos de `mp25m`.
- `service_role` conserva acceso solo en pruebas o runtimes confiables y no aparece nunca en cliente.

## 9. Usuario administrador inicial

El primer administrador debe crearse con un procedimiento seguro, no con datos fijos en el repositorio. Como `auth.users` y `auth.identities` no tienen usuarios actualmente, el bootstrap debe crear primero una identidad Auth y luego vincularla con el modelo interno de permisos.

Requisitos:

- La direccion de email no debe quedar escrita en Git.
- No debe existir contrasena fija en codigo.
- No debe abrirse el registro publico.
- La asignacion inicial debe ser explicita, auditable y realizada una unica vez.
- Las siguientes altas deben depender de administradores autorizados.
- No debe concederse acceso general a `authenticated` antes de tener politicas RLS revisadas.
- No debe reutilizarse `mp25m.roles` para dar privilegios de administrador.

Procedimiento propuesto, sin ejecutarlo todavia:

1. Configurar Supabase Auth con email y contrasena, registro publico deshabilitado o no utilizado por la app.
2. Crear o invitar el primer usuario desde el Dashboard de Supabase, o desde un script administrativo local no versionado y ejecutado en entorno confiable.
3. Confirmar el `auth_user_id` generado por Supabase Auth sin copiarlo a archivos versionados.
4. Crear el registro conceptual en `internal_users` vinculado a ese `auth_user_id`.
5. Crear o confirmar el rol de acceso Administrador en `access_roles`, separado de `mp25m.roles`.
6. Crear una asignacion global activa en `access_role_assignments` con su `access_scope` correspondiente.
7. Registrar un evento de auditoria en `audit_events` con actor de bootstrap documentado, fecha, motivo y evidencia operacional.
8. Ejecutar pruebas de acceso con ese usuario y pruebas negativas con `anon` y con un usuario autenticado sin rol.
9. Deshabilitar o archivar el procedimiento de bootstrap para evitar reuso accidental.
10. A partir de ahi, crear usuarios internos solo mediante administradores autorizados.

Si se usa una clave secreta para la invitacion o bootstrap, debe ejecutarse solo en entorno confiable y nunca llegar al navegador.

## 10. Variables de entorno

### Existentes

| Variable | Puede ser `NEXT_PUBLIC_` | Observacion |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Si | URL publica del proyecto. |
| `DATABASE_URL` | No | Secreta; solo servidor/administracion. |
| `MP25M_PUBLIC_BASE_URL` | No necesita ser publica en cliente | Base URL para scripts y enlaces. |

### Candidatas para Incremento 1

| Variable | Puede ser `NEXT_PUBLIC_` | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Si | Clave publicable recomendada para configuraciones nuevas del cliente Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Si, solo si se mantiene compatibilidad legacy | Alternativa temporal si el proyecto aun usa anon key. |
| `SUPABASE_SECRET_KEY` o equivalente | No | Solo servidor confiable para operaciones administrativas puntuales. |
| `SUPABASE_SERVICE_ROLE_KEY` legacy | No | Evitar si ya existe clave secreta nueva; nunca exponer. |
| `MP25M_ADMIN_BOOTSTRAP_ALLOWED` | No | Bandera temporal para bootstrap, si se adopta. |
| `MP25M_APP_URL` | No necesariamente | URL canonica para redirects de Auth. |

`.env.example` deberia documentar nombres y proposito sin valores reales. Para claves publicas, puede usar placeholders. Para secretos, debe dejar claro que no se versionan valores reales.

No deben registrarse valores reales ni secretos en este documento, en `.env.example` ni en Git. Las Edge Functions actuales por token deben mantener su configuracion operativa sin cambios hasta una revision especifica.

## 11. Estructura del backoffice

Para `/panel` se propone:

- Encabezado con marca MP25M.
- Navegacion lateral en escritorio o superior simple en pantallas chicas.
- Identidad del usuario autenticado.
- Rol y alcance activo.
- Boton de cierre de sesion.
- Inicio o tablero provisional.
- Items futuros claramente marcados como no implementados.

Menu inicial de `/panel`:

| Item | Estado Incremento 1 |
|---|---|
| Inicio | Implementado como tablero provisional. |
| Oportunidades | Reservado para Incremento 2. |
| Capacidades | Reservado. |
| Articulaciones | Reservado. |
| Proyectos | Reservado. |
| Informes | Reservado. |
| Administracion | Visible solo a Administrador; funcionalidad minima de roles si se incluye. |

Debe conservarse el lenguaje visual actual de MP25M y no redisenar la pagina publica.

## 12. Alcance exacto de la primera implementacion posterior

Debe incluir unicamente:

- Dependencias necesarias para Supabase SSR.
- Utilidades cliente/servidor con `@supabase/ssr`.
- Gestion de sesion mediante cookies SSR.
- `proxy.ts` de Next.js 16 para renovacion de sesion y proteccion temprana de rutas.
- Login.
- Logout.
- Recuperacion de contrasena si puede incluirse de forma segura.
- Proteccion de `/panel`.
- Verificacion de rol interno.
- Pagina `/sin-acceso`.
- Layout y panel inicial.
- Modelo minimo de usuarios y roles con RLS.
- Usuario administrador inicial mediante procedimiento seguro.
- Documentacion de variables.
- Pruebas de que un usuario no puede consultar datos fuera de su alcance.

No debe incluir todavia:

- CRUD de oportunidades.
- Radar.
- Articulaciones.
- Proyectos.
- Pagos.
- Facturacion.
- IA.
- Integracion con ClubSmart.

## 13. Criterios de aceptacion

Como minimo:

- La pagina publica sigue funcionando.
- `/perfil/actualizar` sigue funcionando.
- Las Edge Functions `mp25m-profile-get` y `mp25m-profile-submit` siguen funcionando sin cambios de contrato.
- Un visitante no autenticado no puede ingresar a `/panel`.
- Un usuario autenticado sin rol no puede ingresar al backoffice.
- Un usuario autenticado sin rol no puede consultar datos de `mp25m` mediante Data API o cliente manual.
- Un administrador autorizado puede ingresar.
- El cierre de sesion invalida el acceso.
- Ningun rol puede concederse permisos a si mismo.
- Los contactos privados no quedan expuestos.
- Un usuario con alcance de nodo no puede consultar personas, contactos, oportunidades o registros restringidos de otro nodo.
- Un usuario con rol revocado pierde acceso en la siguiente verificacion de servidor y en consultas protegidas por RLS.
- No se expone ninguna clave privilegiada.
- `npm run build` finaliza correctamente.
- Las politicas se verifican con pruebas positivas y negativas.
- Las pruebas incluyen explicitamente `anon`, `authenticated` sin rol, `authenticated` con rol y `service_role`.
- El repositorio no contiene secretos.

## 14. Orden de implementacion posterior

La implementacion debe avanzar en fases pequenas y verificables. No se recomienda implementar el panel antes de que el modelo de autorizacion y RLS haya sido creado, revisado y probado.

### Fase 1. Tablas y modelo de autorizacion

Objetivo:

- Crear el modelo separado para `internal_users`, `access_roles`, `access_role_assignments`, `access_scopes` y `audit_events`.
- No reutilizar `mp25m.roles`.
- Mantener `mp25m_private` sin cambios.

Migracion:

- Escribir migracion revisable, sin datos personales ni secretos.
- Crear tablas nuevas con RLS habilitado desde el inicio.
- No conceder todavia `USAGE` ni permisos amplios a `authenticated` sobre `mp25m`.
- Documentar constraints, indices y referencias al modelo productivo existente.

Rollback:

- Preparar migracion inversa que elimine solo las tablas nuevas si no tienen datos productivos.
- Si ya existen datos de prueba, revocar permisos, desactivar dependencias del panel y archivar registros antes de borrar.
- Confirmar que `mp25m-profile-get` y `mp25m-profile-submit` siguen funcionando despues del rollback.

### Fase 2. Primer administrador

Objetivo:

- Crear el primer usuario Auth, actualmente inexistente.
- Vincularlo a `internal_users`.
- Asignarle rol Administrador global mediante `access_role_assignments`.
- Registrar el bootstrap en `audit_events`.

Migracion o procedimiento:

- Ejecutar el bootstrap solo en entorno confiable.
- No escribir email, UID, contrasena ni tokens en Git.
- Usar Dashboard o script local no versionado para crear o invitar el usuario Auth.
- Vincular el `auth_user_id` resultante mediante una accion administrativa unica.

Rollback:

- Revocar la asignacion del rol Administrador.
- Suspender o eliminar la fila de `internal_users` si no hay dependencias.
- Desactivar el usuario Auth desde Supabase si corresponde.
- Registrar el rollback como evento administrativo.

### Fase 3. Politicas RLS

Objetivo:

- Crear politicas RLS precisas para las tablas nuevas y, si corresponde, para lecturas controladas de `mp25m`.
- Evitar politicas que usen solamente `TO authenticated` como autorizacion.
- Evaluar `auth.uid()`, cuenta interna activa, rol, vigencia y alcance.

Migracion:

- Crear politicas por tabla, operacion y rol funcional.
- Separar lectura, insercion, actualizacion y baja logica.
- Usar `USING` y `WITH CHECK` en actualizaciones.
- Mantener sin cambios el constraint actual de `person_contacts` con `private`, `internal` y `public`.

Rollback:

- Eliminar o reemplazar politicas defectuosas.
- Revocar grants agregados durante la fase si una politica falla.
- Volver al estado restrictivo anterior: sin acceso directo de `authenticated` a datos fuera del circuito probado.

### Fase 4. Pruebas con `anon`, `authenticated` y `service_role`

Objetivo:

- Verificar autorizacion desde la base, no solo desde la UI.
- Probar usuarios anonimos, autenticados sin rol, autenticados con rol y `service_role`.
- Confirmar que un usuario no puede consultar datos fuera de su alcance.

Migracion o procedimiento:

- Crear datos minimos de prueba o usar fixtures controlados.
- Ejecutar pruebas positivas y negativas sobre lectura y mutacion.
- Probar especificamente contactos privados, alcances por nodo y revocacion de roles.
- Confirmar que el circuito por token se mantiene operativo.

Rollback:

- Eliminar o aislar datos de prueba.
- Revocar roles de prueba.
- Revertir politicas o grants que no superen pruebas.
- No continuar a exposicion controlada si falla una prueba negativa.

### Fase 5. Permisos y exposicion controlada de `mp25m`

Objetivo:

- Habilitar `mp25m` para Data API y para el rol `authenticated` solo despues de superar la Fase 4.
- Mantener `mp25m_private` fuera de esquemas expuestos.
- Conceder permisos minimos necesarios, no permisos globales preventivos.

Migracion o configuracion:

- Revisar esquemas expuestos antes de modificar configuracion.
- Conceder `USAGE` y permisos por tabla solo donde existan politicas RLS verificadas.
- Mantener `anon` sin acceso a datos internos.
- Documentar cada grant y su justificacion.

Rollback:

- Revocar `USAGE` y permisos concedidos a `authenticated`.
- Retirar `mp25m` de la exposicion Data API si la configuracion lo permite y si se detecta riesgo.
- Mantener `service_role` solo para procedimientos confiables.
- Verificar nuevamente que `mp25m_private` no haya recibido exposicion ni grants.

### Fase 6. Implementacion del panel

Objetivo:

- Implementar login, logout, recuperacion si queda habilitada, `/sin-acceso` y `/panel`.
- Usar `@supabase/ssr`, cookies SSR y `proxy.ts` de Next.js 16.
- Usar `supabase.auth.getClaims()` del lado servidor para validar identidad.
- Cargar roles y alcances desde las tablas internas, no desde `user_metadata`.

Migracion o cambios de codigo:

- Instalar dependencias Supabase SSR necesarias solo en la etapa autorizada.
- Crear `lib/supabase/client.ts`, `lib/supabase/server.ts` y `lib/supabase/proxy.ts`.
- Crear `proxy.ts` con matcher limitado a rutas protegidas.
- Crear rutas `/login`, `/recuperar-clave`, `/sin-acceso` y grupo `(backoffice)/panel`.
- Confirmar que `/` y `/perfil/actualizar` no queden bajo proteccion.

Rollback:

- Revertir el despliegue del panel si falla build, login, logout o control de acceso.
- Desactivar matcher de `/panel` si bloquea rutas publicas por error.
- Mantener el formulario por token independiente y sin dependencia de Auth.
- Revocar roles de prueba si se detecta exposicion indebida.

## 15. Riesgos y decisiones pendientes

### Informacion remota ya verificada

- PostgreSQL 17.
- `public` sin tablas.
- Datos productivos en `mp25m`.
- RLS habilitado en tablas de `mp25m`, sin politicas existentes.
- Sin usuarios en `auth.users` ni `auth.identities`.
- `anon` y `authenticated` sin `USAGE` ni permisos sobre `mp25m`.
- `service_role` con acceso.
- `mp25m_private` con tablas del flujo por token, sin RLS y sin grants a `anon` o `authenticated`.
- `mp25m.roles` como roles territoriales.
- `person_contacts` con visibilidad `private`, `internal` y `public`.

### Informacion todavia a inspeccionar

- Funciones SQL privadas, vistas, triggers, grants indirectos y uso eventual de `SECURITY DEFINER`.
- Configuracion exacta de esquemas expuestos a Data API antes de modificarla.
- Configuracion de Auth URLs.
- Configuracion SMTP para recuperacion de contrasena.
- Claves disponibles: publishable, anon legacy, secret.
- Versiones/extensiones especificas si una politica o funcion depende de ellas.

### Decisiones pendientes

- Si se usara clave publicable nueva o anon legacy temporalmente.
- URL exacta de recuperacion de contrasena.
- Si `/auth/callback` sera necesario para el flujo elegido.
- Politica SMTP para produccion.
- Nombre definitivo de tablas internas, tomando como base conceptual `internal_users`, `access_roles`, `access_role_assignments`, `access_scopes` y `audit_events`.
- Alcance del rol Autoridad/Analista en informacion agregada.
- Criterio exacto para auditar acceso a contactos privados.
- Procedimiento operacional para bootstrap del primer administrador.
- Momento exacto para habilitar `mp25m` en Data API y conceder permisos a `authenticated`, despues de RLS probado.
- Estrategia futura para niveles funcionales de confidencialidad sin alterar ahora `person_contacts`.
- Tratamiento de defensa en profundidad para el aviso de RLS deshabilitado en `mp25m_private`, sin correccion automatica en este incremento.

### Riesgos

- RLS demasiado permisiva por usar solo `TO authenticated`.
- RLS demasiado restrictiva que bloquee operaciones necesarias.
- Conceder permisos a `authenticated` sobre `mp25m` antes de probar politicas por alcance.
- Exponer accidentalmente `mp25m_private` a Data API.
- Activar RLS en `mp25m_private` sin revisar el flujo por token y romper `mp25m-profile-get` o `mp25m-profile-submit`.
- Bloquear accidentalmente `/perfil/actualizar` con `proxy.ts`.
- Confiar en `getSession()` para autorizacion.
- Exponer una clave secreta al navegador.
- Usar `user_metadata` para roles y permitir elevacion indirecta.
- Reutilizar `mp25m.roles` para permisos del sistema y mezclar roles territoriales con autorizacion.
- Crear tablas nuevas con nombres que colisionen o no expresen separacion conceptual.
- Configurar mal redirects y romper recuperacion de contrasena.
- Dar acceso a contactos privados sin trazabilidad.

## 16. Referencias tecnicas consultadas

- Next.js Proxy: `https://nextjs.org/docs/app/getting-started/proxy`
- Next.js `proxy.js` file convention: `https://nextjs.org/docs/app/api-reference/file-conventions/proxy`
- Next.js 16 upgrade guide: `https://nextjs.org/docs/app/guides/upgrading/version-16`
- Supabase SSR client for Next.js: `https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs`
- Supabase Row Level Security: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Supabase Auth users and invitations: `https://supabase.com/docs/guides/auth/users`
- Supabase password-based Auth and reset flow: `https://supabase.com/docs/guides/auth/passwords`
- Supabase changelog reviewed for breaking-change context: `https://supabase.com/changelog?types=breaking-change`

## 17. Bloqueos reales

No hay bloqueo local para redactar este documento.

Si se implementa el incremento, hay bloqueos reales previos:

- Escribir y revisar migraciones para tablas nuevas de autorizacion.
- Definir procedimiento institucional para crear el primer usuario Auth, porque actualmente no existen usuarios.
- Crear primer administrador sin registrar secretos ni datos operativos en Git.
- Disenar y revisar politicas RLS antes de conceder acceso a `authenticated`.
- Ejecutar pruebas directas con `anon`, `authenticated` y `service_role`.
- Definir si y cuando se habilita `mp25m` para Data API.
- Definir claves publicables/legacy disponibles en el proyecto.
- Configurar Auth redirects y SMTP para recuperacion de contrasena.
- Analizar defensa en profundidad para `mp25m_private` sin alterar automaticamente el flujo por token.
