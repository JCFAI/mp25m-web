# MP25M_S — Tutorial contextual y revisión de experiencia

## Propósito

Orientar a las primeras cohortes en la consulta de la red y en el seguimiento
de trabajo real. La guía debe permitir entender para qué sirve cada pantalla,
qué opciones son visibles según los permisos y dónde pedir ayuda.

**No crea datos ficticios ni ejecuta acciones de guardado.**

## Recorrido de Inicio

Al ingresar por primera vez, el recorrido presenta «Módulos del sistema».
Cada explicación se presenta en una **ventana flotante**, anclada al área
que explica (a un lado, arriba o abajo según el espacio), sin tapar la zona
resaltada ni crear grandes franjas vacías. La ventana puede arrastrarse desde
su encabezado «↔ Mover ventana». Se puede abrir nuevamente con «Ver recorrido».

El orden del recorrido refleja el uso de MP25M_S:

1. Panorama y disponibilidad de módulos.
2. Personas: identidades y participaciones.
3. Nodos: estructura territorial.
4. Organizaciones: entidades de la red.
5. Habilidades: capacidades personales y productivas.
6. Articulaciones: coordinación, responsables e historial, si el acceso lo permite.
7. Proyectos: iniciativas y seguimiento, según el perfil.
8. Temas: asuntos transversales y responsables, según el perfil.
9. Mi perfil: identidad, rol y ámbito.
10. Sugerencias para este Programa: registro de dificultades y propuestas.
11. Administración de accesos, sólo para quien tenga rol autorizado.
12. Cierre: invitación a explorar por dentro los módulos habilitados.

Las prestaciones previstas para MP25M_M permanecen señaladas como futuras
cuando la liberación activa es S, pero no se incluyen en esta visita.

## Recorrido según acceso

- **Participante básico nuevo:** recibe sólo Personas, Nodos,
  Organizaciones, Habilidades, Mi perfil y Sugerencias.
- **Otros perfiles habilitados:** también reciben Proyectos y Temas.
  Articulaciones sólo se incluye cuando la cuenta tiene los permisos
  actualmente exigidos para abrir esa pantalla.
- **Gobierno de accesos:** aparece sólo para roles autorizados.

Esta distinción refleja el funcionamiento técnico actual. La diferencia
entre el «Participante» previsto originalmente para S y el «Participante
básico» habilitado en M deberá evaluarse expresamente en el piloto.

## Guías dentro de las pantallas

El botón «Ver recorrido» también orienta en:

- Personas: presentación y directorio.
- Nodos: presentación y búsqueda territorial.
- Organizaciones: presentación y búsqueda.
- Habilidades: presentación y exploración del catálogo.
- Articulaciones: propósito, creación, directorio y ficha con estado,
  historial, participantes y novedades (guía de S existente).
- Proyectos: propósito, formulario y directorio.
- Temas: propósito y directorio.
- Mi perfil y Sugerencias: ayuda para entender la función de cada pantalla.

**Límite actual:** la guía es contextual por pantalla, no navega de manera
automática entre rutas ni ejecuta botones o formularios. El usuario abre
un módulo y vuelve a iniciar «Ver recorrido» allí.

## Interacción y accesibilidad

- Botones «Anterior», «Siguiente», «Finalizar» y «Salir».
- «Escape» cierra el cuadro.
- **Todas** las descripciones aparecen en ventanas flotantes independientes
  de la página, ubicadas al lado del objetivo cuando el ancho lo permite,
  o por encima/debajo cuando no lo permite (incluido el móvil).
- La persona puede arrastrar cualquier descripción desde «↔ Mover ventana»,
  conservando a la vista el elemento señalado. La ventana no sale de pantalla.
- Los pasos sin área objetivo muestran una ventana flotante centrada.
- El acceso `/login?tour=1` conserva la petición al iniciar sesión y abre
  automáticamente la primera descripción flotante al llegar al panel. La
  variante `/panel?tour=1` funciona para sesiones ya iniciadas. Nunca omiten
  la autenticación.
- Cada paso mide la altura real de la guía y calcula el área visible antes
  de presentar el cuadro y el resaltado juntos.
- No se modifica el `padding` ni el alto artificialmente del documento.
  Se desplaza sólo lo necesario cuando un destino no entra en el área libre.
- Para secciones muy grandes se ilumina únicamente la parte visible que no
  está cubierta por la ventana flotante; se procura conservar su encabezado y
  el primer control a la vista.
- Si la explicación es larga, el texto del cuadro puede desplazarse dentro
  de un alto máximo, sin deformar el resto de la página.
- Las áreas resaltadas se muestran para observación, pero no se interactúa
  con ellas hasta salir del recorrido.
- El desplazamiento respeta la preferencia de movimiento reducido.
- La bienvenida automática se muestra una vez por navegador en la versión v2;
  «Ver recorrido» la reinicia en cualquier momento.

## Ajustes UX de la revisión V3

- En Inicio, el primer paso desplaza el directorio de módulos hacia el inicio
  del área visible en móvil y portátil, procurando mostrar su encabezado y
  la primera tarjeta sin alterar los márgenes ni la altura de la página.
- Si los directorios de Articulaciones, Proyectos o Temas están vacíos,
  la guía lo reconoce y explica para qué servirán las fichas cuando existan,
  sin invitar a abrir registros inexistentes ni crear datos ficticios.
- En Habilidades el buscador y los filtros se destacan por separado de la
  revisión administrativa de propuestas; esta última sólo aparece en cuentas
  con autorización.
- En Mi perfil la introducción señala el encabezado de la pantalla y el
  segundo paso explica los campos de la tarjeta «Identidad en el panel».
- La auditoría automatizada verifica adicionalmente que en móvil/portátil
  la primera tarjeta sea visible, y que las áreas de ayuda correspondan a
  los controles y estados efectivamente presentes.

La revisión visual con capturas y la prueba de participantes básicos y fichas
con registros reales continúan pendientes. Ningún resultado técnico por sí
solo equivale a la aceptación funcional del piloto.

## Revisión UX/UI pendiente de aprobación

Antes de cerrar el piloto S, verificar en escritorio y móvil:

1. Entrada al bloque de módulos con la explicación bien posicionada.
2. Orden completo de funciones S sin terminar en Articulaciones.
3. Ausencia de pasos inaccesibles para el Participante básico.
4. Claridad del texto, etiquetas de botones y significado de cada función.
5. Que el cuadro no oculte formularios o controles que está explicando,
   probando cada paso en escritorio, portátil y móvil.
6. Que los recorridos internos destaquen las áreas esperadas.
7. Que la experiencia pueda completarse sin guardar datos.
8. Identificar y acordar ajustes de UI reutilizables en los incrementos siguientes.

## Prueba funcional aislada de Supabase local

Los recorridos automáticos de roles y Articulaciones se preparan con
`scripts/seed-local-stage-s-functional.mjs` y se comprueban con
`tests/e2e/stage-s-functional-local.spec.ts`.

**Aislamiento obligatorio:** el preparador exige `API_URL=http://127.0.0.1:54321`
y `DB_URL` de PostgreSQL en `localhost:54322/postgres`. Reutiliza la
cuenta de administrador E2E local y crea una cuenta de Participante básico
con rol `participant`, sin permisos elevados.

Los datos sintéticos incluyen una persona, una Articulación autónoma,
un responsable, tres entradas de historial de estado, un participante y
dos novedades. Todos los nombres llevan el prefijo `E2E LOCAL S`.
No se incluyen credenciales reales y el comando no usa ningún proyecto
remoto ni invoca `supabase db reset`.

La prueba comprueba el recorrido autorizado para Participante básico,
el acceso directo a rutas restringidas, la ficha poblada y su tutorial
en escritorio y móvil. La ejecución es sólo una verificación: **no
equivale a aceptar el piloto**. Los registros sintéticos se conservan
en la base local para inspección y no se limpian mediante borrados
automáticos, ya que existe trazabilidad de auditoría.

## Materiales de apoyo

- `MP25M-S-ALCANCE-Y-PILOTO.md`
- `MP25M-S-PRACTICA-GUIADA.md`
- `MP25M-S-HOJA-RAPIDA.md`

La aprobación funcional final depende de revisar este recorrido con usuarios
reales; el deploy por sí solo no constituye aceptación del piloto.

## Verificación geométrica

Se añadió `tests/e2e/stage-s-tour-visual.spec.ts` para iniciar sesión con un
usuario de pruebas autorizado y recorrer automáticamente las pantallas de S
en escritorio (1440×900), portátil (1024×768) y móvil (390×844).

En cada paso espera a que la guía confirme `data-tour-ready=true`;
compara la identidad del paso y la del resaltado, mide los rectángulos reales
del navegador y comprueba que **la zona iluminada no intersecte el cuadro**,
que pertenezca al elemento correcto y sea visible. También verifica que no
se modifiquen los márgenes del documento y que se capture un paso estable. Puede generar capturas con
`MP25M_E2E_TOUR_SCREENSHOTS=true`.

Este test requiere credenciales del entorno de pruebas
(`MP25M_E2E_EMAIL` y `MP25M_E2E_PASSWORD`). Si no están disponibles,
se omite. Un deploy en estado READY no reemplaza la ejecución real de esta
prueba ni la aprobación visual del piloto.

## Ventanas flotantes del tutorial — revisión final del piloto

El renderizador es único para todas las rutas del panel: Inicio, Personas,
Nodos, Organizaciones, Habilidades, Articulaciones, Proyectos, Temas, Mi perfil,
Sugerencias y las fichas habilitadas por el perfil. La misma ventana flotante
se reutiliza en cada paso y no se acopla a los márgenes superior/inferior.
El botón «Ver recorrido» permite reiniciar, y el enlace `?tour=1` fuerza su
apertura para revisar la experiencia, incluso si ya se completó anteriormente.
La ventana no realiza acciones de escritura y la experiencia sólo es visible
tras ingresar con una cuenta autorizada.
