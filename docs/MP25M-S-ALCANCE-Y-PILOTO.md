# MP25M_S — Alcance y piloto de adopción

- **Estado:** gate global implementado; habilitación del piloto pendiente
- **Relación con MP25M1:** recorte didáctico de la versión cerrada
- **Relación con MP25M2:** el piloto S precede cualquier incremento técnico de M2

## 1. Decisión de producto

MP25M_S será la primera liberación global para cohortes que comienzan a usar
MP25M. Su objetivo es enseñar una operación básica y real sin exponer de
entrada toda la complejidad disponible en MP25M1.

No es un producto separado ni una asignación individual de versiones. La
liberación será global y secuencial: primero S, luego M, después L y,
eventualmente, XL.

## 1.1 Gate global de liberación

La etapa se configura globalmente en el despliegue mediante
\`MP25M_RELEASE_STAGE\`. Los valores admitidos son \`S\`, \`M\`, \`L\` y
\`XL\`; un valor ausente o inválido se interpreta de forma segura como \`S\`.

Las funciones de etapas posteriores permanecen visibles como mapa de crecimiento.
Si una persona intenta abrir una página todavía no habilitada, vuelve a Inicio y
recibe un aviso claro sobre la próxima etapa. Las APIs equivalentes responden
\`403\`, por lo que no quedan disponibles sólo por conocer su URL.

La primera implementación cubre las rutas y APIs de los módulos independientes.
Economía operativa y Resultados, hoy embebidos en fichas de Articulaciones y
Proyectos, se restringirán en un segundo incremento pequeño y verificable.

## 2. Módulos incluidos

MP25M_S incluirá los módulos visibles en la navegación acordada:

- Inicio;
- Articulaciones;
- Proyectos;
- Temas;
- Nodos;
- Personas;
- Organizaciones;
- Habilidades.

El Perfil personal y los mecanismos básicos de acceso son transversales a
todas las etapas y no constituyen un módulo adicional de alcance.

## 3. Operación didáctica de S

La primera cohorte podrá:

- ubicarse en Inicio y recorrer la red;
- buscar y consultar Personas, Organizaciones, Nodos, Temas y Habilidades;
- comprender para qué sirve cada entidad;
- proponer una Articulación o un Proyecto;
- registrar la información básica y sus novedades;
- identificar el responsable y el estado de una propuesta.

No se expondrán como parte de la práctica inicial los controles técnicos,
económicos o de gobierno que no sean necesarios para ese recorrido.

## 4. Regla transversal de participación

La participación se organiza por acción y responsabilidad, no como una
jerarquía rígida de pantallas.

| Figura funcional | Regla para el piloto S |
|---|---|
| Contacto | Puede estar registrado en la red, pero no opera el sistema mientras no tenga una invitación y acceso interno activo. |
| Participante | Puede consultar, aprender y proponer Articulaciones o Proyectos. Una propuesta nace en borrador y no crea un compromiso operativo. |
| Referente | Dentro de su alcance, puede orientar, validar, rechazar, dar de baja o reasignar responsabilidad, dejando motivo y trazabilidad. |
| Fundador | Resuelve gobierno global, excepciones y decisiones que superen el alcance de un Referente. |

Antes de implementar S, estos nombres funcionales deberán mapearse
explícitamente a los roles técnicos, alcances y responsabilidades existentes.
La autorización real deberá seguir validándose en servidor.

## 5. Límites de la etapa S

No forman parte de MP25M_S:

- Agenda, Informes, Comunicaciones, Oportunidades, Necesidades y Ofertas,
  Actividades, Resultados y Economía operativa, previstos para MP25M_M;
- Radar externo, IA, automatizaciones y otras ampliaciones futuras, reservadas
  para etapas posteriores como MP25M_L y MP25M_XL;
- integraciones con calendarios, mensajería u otros servicios externos;
- cambios en reglas institucionales, económicas o de privacidad.

## 6. Condiciones para habilitar el piloto

Antes de habilitar la primera cohorte deberán existir:

- una guía visual breve del sistema (`MP25M-S-TUTORIAL-CONTEXTUAL.md`);
- una práctica guiada con un caso simple (`MP25M-S-PRACTICA-GUIADA.md`);
- una hoja rápida de consulta (`MP25M-S-HOJA-RAPIDA.md`);
- una navegación y acciones de servidor limitadas al alcance S;
- una matriz comprobable entre figuras funcionales, roles técnicos y alcance;
- un mecanismo para recoger dificultades y sugerencias de la cohorte.

## 7. Evaluación del piloto

El piloto deberá registrar, como mínimo:

- si las personas logran completar el recorrido sin asistencia constante;
- en qué pantalla o concepto se detienen;
- cuánto apoyo necesitan para crear una propuesta;
- qué términos o formularios resultan confusos;
- qué información falta para operar con seguridad;
- qué capacidades justifican pasar a MP25M_M.

No se aprobará un incremento técnico de MP25M2 por inercia. La experiencia del
piloto S será una entrada concreta para priorizar MP25M_M y revisar luego la
necesidad real de Radar, IA, integraciones e Informes ampliados.
