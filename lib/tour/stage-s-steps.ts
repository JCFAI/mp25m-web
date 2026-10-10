/** El recorrido S describe las pantallas realmente visibles para cada perfil.
 * No modifica información y evita sugerir acciones reservadas a otros roles. */
export type StageTourStep = {
  key: string
  target?: string
  title: string
  description: string
  emptyTitle?: string
  emptyDescription?: string
}

export type StageTourAudience = {
  isBasicParticipant: boolean
  canManageAccess: boolean
  canReviewArticulations: boolean
}

export function homeStageSTourSteps(audience: StageTourAudience): StageTourStep[] {
  const introductorySteps: StageTourStep[] = [
    {
      key: 'modules',
      target: 'panel-modules',
      title: 'Bienvenido: estas son las funciones de MP25M_S',
      description:
        'Empezá por reconocer los módulos disponibles. Las tarjetas activas permiten explorar la red; las marcadas para una etapa posterior son una referencia del crecimiento previsto. Durante este recorrido no vamos a guardar datos.',
    },
    {
      key: 'people',
      target: 'module-people',
      title: 'Personas: identificar a quienes participan',
      description:
        'Consultá el directorio de personas, buscá registros existentes y abrí sus fichas para conocer participaciones territoriales y habilidades. Antes de crear una persona, comprobá que no esté registrada.',
    },
    {
      key: 'nodes',
      target: 'module-nodes',
      title: 'Nodos: comprender la organización territorial',
      description:
        'Conocé los nodos del Movimiento, sus integrantes y las capacidades relevadas. Abrí un nodo existente para entender su contexto antes de vincular nuevas actividades o personas.',
    },
    {
      key: 'organizations',
      target: 'module-organizations',
      title: 'Organizaciones: conocer las entidades de la red',
      description:
        'Encontrá empresas, instituciones y otras organizaciones. Sus fichas reúnen información para reconocerlas y evitar registros duplicados. Las altas y validaciones dependen de tus permisos.',
    },
    {
      key: 'skills',
      target: 'module-skills',
      title: 'Habilidades: descubrir capacidades disponibles',
      description:
        'Consultá las habilidades de personas y las capacidades productivas u organizacionales identificadas. Sirven para reconocer recursos existentes y posibles vínculos.',
    },
  ]

  const coordinationSteps: StageTourStep[] = audience.isBasicParticipant
    ? []
    : [
        ...(audience.canReviewArticulations
          ? [{
              key: 'articulations',
              target: 'module-articulations',
              title: 'Articulaciones: coordinar actores y recursos',
              description:
                'Una Articulación organiza un objetivo común, responsables, participantes y seguimiento. Podés consultar su historial y, si tu rol lo permite, registrar o gestionar una propuesta. Entrá al módulo para ver su guía específica.',
            }]
          : []),
        {
          key: 'projects',
          target: 'module-projects',
          title: 'Proyectos: organizar trabajo con continuidad',
          description:
            'Los Proyectos permiten describir iniciativas, responsables y avances. Consultá los existentes y revisá qué acciones están habilitadas para tu rol antes de crear o modificar uno.',
        },
        {
          key: 'themes',
          target: 'module-themes',
          title: 'Temas: seguir asuntos transversales',
          description:
            'Los Temas reúnen asuntos sostenidos por el Movimiento aunque no pertenezcan a un único proyecto o articulación. Permiten consultar su estado, responsables y seguimientos.',
        },
      ]

  return [
    ...introductorySteps,
    ...coordinationSteps,
    {
      key: 'profile',
      target: 'home-profile',
      title: 'Tu perfil y tus permisos',
      description:
        'En Mi perfil podés revisar cómo figura tu nombre dentro del sistema. En el encabezado se indican tu rol y ámbito: esas autorizaciones determinan qué opciones se muestran y cuáles podés modificar.',
    },
    {
      key: 'feedback',
      target: 'home-feedback',
      title: 'Sugerencias: ayudanos a mejorar la experiencia',
      description:
        'Si algo no se entiende, resulta incómodo o falla, enviá una sugerencia desde esta opción. El comentario se registra con tu cuenta y puede ser revisado por quienes administran el programa.',
    },
    ...(audience.canManageAccess
      ? [{
          key: 'access',
          target: 'home-access',
          title: 'Administración de accesos (según tu rol)',
          description:
            'Los responsables autorizados pueden revisar incorporaciones y permisos. Esta función es de gobierno del sistema, no un paso obligatorio para los participantes del recorrido S.',
        }]
      : []),
    {
      key: 'finish',
      title: 'Ahora recorré una pantalla por dentro',
      description: audience.isBasicParticipant
        ? 'Ya conocés las opciones de consulta disponibles para tu cuenta. Salí del recorrido, abrí Personas, Nodos, Organizaciones o Habilidades y usá «Ver recorrido» para explorar esa pantalla sin modificar datos.'
        : 'Ya identificaste las prestaciones de S. Salí del recorrido, abrí cualquiera de los módulos activos y usá «Ver recorrido» para revisar sus controles, búsquedas y fichas sin modificar datos.',
    },
  ]
}

export function contextualStageSTourSteps(pathname: string): StageTourStep[] {
  const sections: Record<string, StageTourStep[]> = {
    '/panel/personas': [
      {
        key: 'people-purpose',
        target: 's-people-intro',
        title: 'Directorio de Personas',
        description: 'Este directorio reúne identidades canónicas. Cada ficha permite consultar la información y los vínculos de una persona sin crear duplicados.',
      },
      {
        key: 'people-search',
        target: 's-people-search',
        title: 'Buscá antes de registrar',
        description: 'Usá la búsqueda y abrí una persona existente. El alta de nuevas personas sólo aparece para los perfiles autorizados.',
      },
    ],
    '/panel/nodos': [
      {
        key: 'nodes-purpose',
        target: 's-nodes-intro',
        title: 'Directorio territorial',
        description: 'Los Nodos permiten comprender dónde se organiza la red y reconocer las participaciones confirmadas.',
      },
      {
        key: 'nodes-search',
        target: 's-nodes-search',
        title: 'Explorá un Nodo',
        description: 'Usá la búsqueda, elegí un nodo existente y consultá su ficha, integrantes y capacidades. No hace falta registrar nada.',
      },
    ],
    '/panel/organizaciones': [
      {
        key: 'organizations-purpose',
        target: 's-organizations-intro',
        title: 'Organizaciones de la red',
        description: 'Aquí encontrás empresas, instituciones y otras organizaciones ya incorporadas.',
      },
      {
        key: 'organizations-search',
        target: 's-organizations-search',
        title: 'Buscá y consultá una organización',
        description: 'Localizá una organización antes de crear una nueva. Las acciones de alta, edición y validación dependen de tu rol.',
      },
    ],
    '/panel/habilidades': [
      {
        key: 'skills-purpose',
        target: 's-skills-intro',
        title: 'Habilidades y capacidades',
        description: 'La información sobre habilidades ayuda a identificar qué sabe hacer la red y con qué recursos cuenta.',
      },
      {
        key: 'skills-search',
        target: 's-skills-search',
        title: 'Explorá el catálogo',
        description: 'Usá el buscador y los filtros para reconocer habilidades y capacidades. La revisión administrativa de propuestas se explica en otro paso, únicamente si tu perfil tiene ese permiso.',
      },
      {
        key: 'skills-review',
        target: 's-skills-review',
        title: 'Revisión administrativa de propuestas',
        description: 'Esta sección muestra las propuestas pendientes de revisión y permite acceder a su evaluación. Sólo aparece para roles autorizados. No es parte del buscador del catálogo.',
      },
    ],
    '/panel/proyectos': [
      {
        key: 'projects-purpose',
        target: 's-projects-intro',
        title: '¿Para qué sirve un Proyecto?',
        description: 'Una iniciativa puede empezar de forma autónoma, definir un responsable y sumar participantes y recursos con el tiempo.',
      },
      {
        key: 'projects-create',
        target: 's-projects-create',
        title: 'Conocé el formulario',
        description: 'Revisá los campos para proponer un proyecto y los datos de su responsable. Durante el recorrido no lo guardes.',
      },
      {
        key: 'projects-list',
        target: 's-projects-list',
        title: 'Proyectos registrados',
        description: 'Abrí un proyecto existente para revisar su estado, avances y participantes. No es necesario crear uno de prueba.',
        emptyTitle: 'Proyectos: todavía sin registros',
        emptyDescription: 'Aquí aparecerán los Proyectos registrados. Como no hay registros para abrir, revisá dónde se mostrarán el objetivo y los responsables cuando se incorpore una iniciativa. No crees datos ficticios para completar la guía.',
      },
    ],
    '/panel/temas': [
      {
        key: 'themes-purpose',
        target: 's-themes-intro',
        title: 'Temas de trabajo',
        description: 'Un Tema es un asunto transversal que puede sostenerse independientemente de los proyectos o articulaciones.',
      },
      {
        key: 'themes-directory',
        target: 's-themes-directory',
        title: 'Consultá los Temas existentes',
        description: 'Explorá el directorio para conocer estados, prioridades, responsables y seguimientos. La creación depende del rol.',
        emptyTitle: 'Temas: sin resultados en el directorio',
        emptyDescription: 'El directorio todavía no muestra Temas que coincidan con los filtros. Podés reconocer los campos de búsqueda, estado y prioridad sin crear un registro. Cuando existan Temas, se podrán consultar sus responsables y seguimientos.',
      },
    ],
    '/panel/perfil': [
      {
        key: 'profile-purpose',
        target: 's-profile-intro',
        title: 'Tu identidad dentro de MP25M',
        description: 'Esta es la pantalla Mi perfil, desde la que administrás cómo se identifica tu cuenta interna. Los datos concretos están en la tarjeta «Identidad en el panel», que veremos a continuación.',
      },
      {
        key: 'profile-details',
        target: 's-profile-details',
        title: 'Datos de tu perfil',
        description: 'En «Identidad en el panel» consultás tu rol y el nombre que identifica tu cuenta. El formulario permite editar el nombre visible, pero durante el recorrido no hace falta modificar ni guardar nada.',
      },
    ],
    '/panel/comentarios-piloto': [
      {
        key: 'feedback-purpose',
        target: 's-feedback-intro',
        title: 'Tu opinión mejora el programa',
        description: 'Podés registrar dificultades, sugerencias o errores encontrados durante el uso real de MP25M.',
      },
      {
        key: 'feedback-form',
        target: 's-feedback-form',
        title: 'Enviar una sugerencia',
        description: 'Indicá qué ocurrió y, si sirve, en qué pantalla lo viste. Para este recorrido no hace falta enviar nada.',
      },
    ],
  }

  return sections[pathname] ?? []
}
