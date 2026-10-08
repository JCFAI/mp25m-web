# MP25M1 — Acta de cierre operativo

- **Estado:** cerrado formalmente
- **Fecha de cierre:** 8 de octubre de 2026
- **Base de código:** `main` en `e6924bb`
- **Producción:** Vercel desplegado correctamente para esa base

## 1. Resolución de cierre

MP25M1 queda establecido como la primera versión operativa del sistema MP25M.
El objetivo de esta etapa fue consolidar una base utilizable, estable,
coherente, trazable y apta para operación cotidiana, sin convertir los
objetivos candidatos de MP25M2 en alcance implícito.

Este documento no declara resueltas todas las decisiones institucionales,
jurídicas o de producto del Movimiento. Registra el cierre del alcance
operativo y técnico efectivamente implementado.

## 2. Capacidades operativas consolidadas

MP25M1 incluye, entre otras, las siguientes capacidades ya integradas:

- autenticación, acceso interno y roles operativos;
- personas, organizaciones, nodos, habilidades, capacidades y Temas;
- Oportunidades con requerimientos, coincidencias, cobertura, brechas,
  seguimiento y responsabilidades;
- Articulaciones y Proyectos autónomos, vinculables explícitamente, con
  participantes, novedades, estados e historial;
- necesidades y ofertas manuales y trazables;
- Resultados estructurados de Articulaciones y Proyectos;
- Agenda operativa transversal;
- comunicaciones y convocatorias asistidas, con revisión humana;
- Informes e Indicadores operativos de sólo lectura;
- economía operativa manual y trazable para Oportunidades, Articulaciones y
  Proyectos.

## 3. Evidencia de validación

La línea de cierre se verificó sobre `main` en `e6924bb`:

- Vercel informó deployment de producción exitoso;
- `npx supabase migration list` confirmó alineación local/remota hasta
  `20261008032901`;
- 43 pruebas locales ejecutadas: 43 aprobadas;
- `npx tsc --noEmit --incremental false` finalizó sin errores;
- `npm run lint` finalizó con 0 errores y 38 warnings preexistentes;
- `npm run build` finalizó correctamente;
- se validó manualmente la concurrencia económica desde dos pestañas:
  la segunda escritura recibe conflicto inmediato y conserva su borrador;
- se verificó la visibilidad del historial de estados de Articulaciones.

## 4. Límites explícitamente aceptados

Los siguientes límites no son defectos bloqueantes de MP25M1:

- la protección contra contraseñas filtradas de Supabase no se habilita en el
  plan Free actual;
- Oportunidades usa autorización económica global por rol interno activo; no
  aplica aún un filtro por territorio o nodo;
- economía no ofrece un permiso separado de sólo lectura: quien puede
  gestionarla puede verla;
- no hay cotizaciones, conversión de moneda, pagos, facturación, distribución
  automática ni indicadores económicos agregados;
- Agenda y Comunicaciones no se integran todavía con calendarios, mensajería o
  envío externo automático;
- el Radar externo automatizado, IA y automatizaciones seleccionadas no forman
  parte de MP25M1;
- continúan pendientes decisiones institucionales sobre conservación de datos,
  auditorías, privacidad y reglas económicas marco.

## 5. Integridad técnica relevante

La economía 14A conserva fichas independientes por origen, revisiones
inmutables, semántica distinta para cero y `NULL`, autorización derivada,
auditoría y concurrencia optimista. La RPC de escritura devuelve `PT409`
ante revisiones desactualizadas, evitando reintentos impropios y permitiendo
que la interfaz conserve el borrador de quien encontró el conflicto.

El historial de estados de Articulaciones se expone mediante una vista de
lectura con `security_invoker = true`; el acceso de aplicación se realiza
desde servidor.

## 6. Transición posterior al cierre

MP25M2 no queda aprobado por este cierre. Antes de crear su primer incremento
deberá realizarse la revisión formal definida en
`MP25M2-OBJETIVOS-Y-ALCANCE-A-REVISAR.md`.

La eventual integración con ClubSmart queda fuera de MP25M2 y se analizará
recién en MP25M3.

Como estrategia de adopción, las liberaciones dirigidas a nuevas cohortes se
planificarán globalmente y de forma secuencial como MP25M_S, MP25M_M,
MP25M_L y MP25M_XL. Antes de habilitar MP25M_S deberá existir una guía visual
breve, una práctica guiada y una hoja rápida de uso para personas sin
experiencia previa con sistemas de gestión.
