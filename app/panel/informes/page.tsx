import Link from 'next/link'

import {
  getReportsDashboard,
  normalizeReportPeriodPreset,
  type ReportPeriodPreset,
} from '../../../lib/reports/indicators'

export const dynamic = 'force-dynamic'

type ReportsPageProps = {
  searchParams: Promise<{
    period?: string | string[]
  }>
}

const periodOptions: {
  value: ReportPeriodPreset
  label: string
}[] = [
  {
    value: '30d',
    label: '30 días',
  },
  {
    value: '90d',
    label: '90 días',
  },
  {
    value: 'year',
    label: 'Año actual',
  },
]

function percent(
  value: number | null
) {
  if (value === null) {
    return 'No calculable'
  }

  return `${value.toLocaleString(
    'es-AR',
    {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }
  )} %`
}

function number(
  value: number
) {
  return value.toLocaleString(
    'es-AR'
  )
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string
  value: string
  detail: string
  tone?: 'default' | 'attention'
}) {
  return (
    <article
      className={[
        'rounded-2xl border bg-white p-4 shadow-sm sm:p-5',
        tone === 'attention'
          ? 'border-amber-200'
          : 'border-slate-200',
      ].join(' ')}
    >
      <p className="text-sm font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </article>
  )
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>

      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  )
}

export default async function ReportsPage({
  searchParams,
}: ReportsPageProps) {
  const params =
    await searchParams

  const rawPeriod =
    Array.isArray(params.period)
      ? params.period[0]
      : params.period

  const preset =
    normalizeReportPeriodPreset(
      rawPeriod
    )

  const report =
    await getReportsDashboard(
      preset
    )

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
          Incremento 13A
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Informes e indicadores
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-100/80">
          Lectura agregada y de sólo consulta sobre la información operativa registrada en MP25M. Cada indicador conserva una definición explícita y evita inferir datos que el sistema todavía no puede demostrar.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              Período de flujos
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {report.period.label}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {periodOptions.map(
              (option) => {
                const active =
                  option.value ===
                  preset

                return (
                  <Link
                    key={option.value}
                    href={`/panel/informes?period=${option.value}`}
                    aria-current={
                      active
                        ? 'page'
                        : undefined
                    }
                    className={[
                      'rounded-xl px-3 py-2 text-sm font-semibold transition',
                      active
                        ? 'bg-[#1E3A5F] text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-[#2F5D8C]/40 hover:text-[#1E3A5F]',
                    ].join(' ')}
                  >
                    {option.label}
                  </Link>
                )
              }
            )}
          </div>
        </div>

        <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          El período sólo modifica indicadores de flujo. Las métricas de red, oportunidades activas, coincidencias y brechas muestran el estado vigente.
        </p>
      </section>

      <section className="space-y-4">
        <SectionTitle
          eyebrow="Corte actual"
          title="Red MP25M"
          description="Dimensión vigente de las entidades principales registradas en el sistema."
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Personas activas"
            value={number(report.network.activePeople)}
            detail="Personas canónicas activas; no incluye archivadas ni fusionadas."
          />

          <MetricCard
            label="Nodos activos"
            value={number(report.network.activeNodes)}
            detail="Nodos cuyo estado vigente es activo."
          />

          <MetricCard
            label="Organizaciones activas"
            value={number(report.network.activeOrganizations)}
            detail="Organizaciones activas; no incluye archivadas ni fusionadas."
          />

          <MetricCard
            label="Habilidades confirmadas"
            value={number(report.network.confirmedPersonSkills)}
            detail="Habilidades personales activas con verificación confirmada."
          />

          <MetricCard
            label="Capacidades confirmadas"
            value={number(report.network.confirmedOrganizationCapabilities)}
            detail="Capacidades organizacionales activas con verificación confirmada."
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle
          eyebrow="Corte actual"
          title="Necesidades y ofertas"
          description="Registros vigentes independientes de las oportunidades."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard
            label="Necesidades vigentes"
            value={number(report.needsOffers.activeNeeds)}
            detail="Necesidades actualmente en estado activo."
          />

          <MetricCard
            label="Ofertas vigentes"
            value={number(report.needsOffers.activeOffers)}
            detail="Ofertas actualmente en estado activo."
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle
          eyebrow="Oportunidades"
          title="Actividad y análisis productivo"
          description="Combina el flujo del período con el estado operativo vigente del análisis."
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Detectadas en el período"
            value={number(report.opportunities.detectedInPeriod)}
            detail={`Oportunidades registradas entre ${report.period.label}.`}
          />

          <MetricCard
            label="Oportunidades activas"
            value={number(report.opportunities.active)}
            detail="Estados open, under_analysis e in_progress."
          />

          <MetricCard
            label="Análisis iniciado"
            value={percent(report.opportunities.analysisStartedPercent)}
            detail={
              report.opportunities.analysisStartedDenominator
                ? `${number(report.opportunities.analysisStarted)} de ${number(report.opportunities.analysisStartedDenominator)} oportunidades activas tienen al menos un requerimiento activo.`
                : 'No existen oportunidades activas para calcular el porcentaje.'
            }
          />

          <MetricCard
            label="Completitud promedio"
            value={percent(report.opportunities.averageCompleteness)}
            detail={
              report.opportunities.completenessSampleCount
                ? `Calculada sobre ${number(report.opportunities.completenessSampleCount)} oportunidades con requerimientos activos en la lectura vigente.`
                : 'No hay oportunidades con universo de requerimientos calculable.'
            }
          />

          <MetricCard
            label="Requerimientos activos"
            value={number(report.requirements.active)}
            detail="Universo vigente incluido en las lecturas actuales de cobertura."
          />

          <MetricCard
            label="Requerimientos evaluados"
            value={number(report.requirements.evaluated)}
            detail="Requerimientos activos que poseen evaluación vigente."
          />

          <MetricCard
            label="No evaluados"
            value={number(report.requirements.unevaluated)}
            detail="No se interpretan como faltantes hasta que exista una evaluación."
          />

          <MetricCard
            label="Sin seguimiento registrado"
            value={number(report.opportunities.withoutRegisteredFollowup)}
            detail="Oportunidades activas sin un seguimiento formal registrado. No equivale a ausencia total de actividad."
            tone={
              report.opportunities.withoutRegisteredFollowup
                ? 'attention'
                : 'default'
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle
          eyebrow="Análisis"
          title="Coincidencias y brechas"
          description="Lectura vigente. Una coincidencia no implica asignación ni disponibilidad."
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Coincidencias vigentes"
            value={number(report.requirements.currentMatches)}
            detail={`${number(report.requirements.suggestedMatches)} sugeridas · ${number(report.requirements.acceptedMatches)} aceptadas para análisis.`}
          />

          <MetricCard
            label="Brechas abiertas"
            value={number(report.gaps.open)}
            detail="Incluye abiertas, en tratamiento y bloqueadas."
          />

          <MetricCard
            label="Brechas resueltas"
            value={number(report.gaps.resolved)}
            detail="Sólo brechas cuyo estado vigente es resolved."
          />

          <MetricCard
            label="Otros cierres de brechas"
            value={number(report.gaps.closedUnresolved + report.gaps.cancelled)}
            detail={`${number(report.gaps.closedUnresolved)} cerradas sin resolver · ${number(report.gaps.cancelled)} canceladas.`}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle
          eyebrow="Flujo del período"
          title="Articulaciones y proyectos"
          description={`Eventos registrados entre ${report.period.label}.`}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Articulaciones iniciadas"
            value={number(report.execution.articulationsStarted)}
            detail="Articulaciones creadas durante el período seleccionado."
          />

          <MetricCard
            label="Proyectos iniciados"
            value={number(report.execution.projectsStarted)}
            detail="Proyectos creados durante el período. No se interpreta como evento formal de acuerdo."
          />

          <MetricCard
            label="Proyectos finalizados"
            value={number(report.execution.projectsCompleted)}
            detail="Proyectos completados durante el período según completed_at."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <p className="text-sm font-semibold text-slate-800">
          Alcance de esta primera lectura
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Los indicadores económicos, propuestas presentadas, nuevos contactos o aliados y tiempo hasta primera acción siguen pendientes porque todavía no existe una definición o fuente estructurada suficiente para medirlos sin inferencias.
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          La desagregación completa de requerimientos en Cubierto, Parcialmente cubierto y Faltante se incorporará cuando la capa de cobertura de red quede expuesta de forma inequívoca para Informes. Mientras tanto se muestran únicamente evaluados y no evaluados.
        </p>
      </section>
    </div>
  )
}
