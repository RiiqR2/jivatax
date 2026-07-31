"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  useAdminAccountMatchingCoverage,
  useAdminSiiAccountPlanVersions,
} from "@/hooks/admin/use-admin-sii-account-plan";
import type { AdminLearningDistribution } from "@/types/admin-sii-account-plan.types";

const percentage = new Intl.NumberFormat("es-CL", {
  style: "percent",
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("es-CL");

export function AdminAccountMatchingSummaryPage() {
  const versions = useAdminSiiAccountPlanVersions();
  const [versionId, setVersionId] = useState("");
  const coverage = useAdminAccountMatchingCoverage(versionId);

  useEffect(() => {
    if (!versionId && versions.data?.length) setVersionId(versions.data[0].id);
  }, [versionId, versions.data]);

  return (
    <main className="mx-auto w-full max-w-7xl p-5 sm:p-8">
      <PageHeader
        title="Resumen de homologación"
        description="Estado global de la evidencia y del aprendizaje del motor de homologación."
      />

      {versions.isPending || (versionId && coverage.isPending) ? (
        <div className="mt-6">
          <LoadingState label="Calculando estado del aprendizaje…" />
        </div>
      ) : versions.isError || coverage.isError ? (
        <div className="mt-6">
          <ErrorState
            description="No fue posible cargar el resumen de homologación."
            onRetry={() => {
              void versions.refetch();
              void coverage.refetch();
            }}
          />
        </div>
      ) : versions.data?.length === 0 ? (
        <EmptyState message="No hay versiones del plan de cuentas SII disponibles." />
      ) : coverage.data ? (
        <Dashboard
          data={coverage.data}
          versions={versions.data ?? []}
          versionId={versionId}
          onVersionChange={setVersionId}
        />
      ) : null}
    </main>
  );
}

function Dashboard({
  data,
  versions,
  versionId,
  onVersionChange,
}: {
  data: NonNullable<ReturnType<typeof useAdminAccountMatchingCoverage>["data"]>;
  versions: Array<{ id: string; code: string; name: string }>;
  versionId: string;
  onVersionChange: (versionId: string) => void;
}) {
  const lastEvidence = data.global.lastEvidenceAt
    ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(
        new Date(data.global.lastEvidenceAt),
      )
    : "Sin evidencia";
  return (
    <>
      <Section
        title="Resumen global"
        description="Estas métricas consideran todo el aprendizaje disponible y no dependen de la versión del catálogo seleccionada más abajo."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Aprendizajes globales"
            value={integer.format(data.global.learningCount)}
          />
          <Metric
            label="Confirmaciones activas"
            value={integer.format(data.global.activeConfirmationCount)}
          />
          <Metric
            label="Confirmaciones expertas"
            value={integer.format(data.global.expertConfirmationCount)}
          />
          <Metric
            label="Empresas contribuyentes"
            value={integer.format(data.global.contributingCompanyCount)}
          />
          <Metric
            label="Rubros con evidencia"
            value={integer.format(data.global.industryCount)}
          />
          <Metric
            label="Confianza promedio"
            value={percentage.format(data.global.averageConfidence)}
          />
          <Metric label="Última evidencia" value={lastEvidence} />
          <Metric
            label="Evidencia últimos 30 días"
            value={integer.format(data.global.recentConfirmationCount)}
            detail={`${integer.format(data.global.previousPeriodConfirmationCount)} en los 30 días anteriores`}
          />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Calidad del aprendizaje"
          description="Distribución informativa; no modifica los umbrales del motor."
        >
          <Distribution title="Confianza" values={data.quality.confidence} />
          <Distribution
            title="Tasa de acuerdo"
            values={data.quality.agreement}
          />
        </Section>
        <Section
          title="Diversidad de evidencia"
          description="Indica qué tan ampliamente está respaldado el conocimiento agregado."
        >
          <dl className="divide-y divide-slate-100">
            <Row
              label="Sustentado por una empresa"
              value={data.diversity.singleCompanyLearningCount}
            />
            <Row
              label="Sustentado por múltiples empresas"
              value={data.diversity.multipleCompanyLearningCount}
            />
            <Row
              label="Evidencia solo experta"
              value={data.diversity.expertOnlyLearningCount}
            />
            <Row
              label="Evidencia mixta"
              value={data.diversity.mixedEvidenceLearningCount}
            />
            <Row
              label="Confirmaciones invalidadas"
              value={data.diversity.invalidatedConfirmationCount}
            />
          </dl>
        </Section>
      </div>

      <Section
        title="Conflictos que requieren atención"
        description="Nombres normalizados con evidencia hacia más de una cuenta SII, priorizados por volumen de confirmaciones."
      >
        {data.conflicts.length ? (
          <div className="space-y-4">
            {data.conflicts.map((conflict) => (
              <article
                key={conflict.normalizedName}
                className="rounded-lg border border-amber-200 bg-amber-50/40 p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-semibold text-slate-950">
                    {conflict.normalizedName}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {conflict.destinationCount} destinos ·{" "}
                    {conflict.confirmationCount} confirmaciones
                  </p>
                </div>
                <ul className="mt-3 grid gap-2 lg:grid-cols-2">
                  {conflict.candidates.map((candidate) => (
                    <li
                      key={candidate.siiAccountId}
                      className="rounded-md bg-white p-3 text-sm shadow-sm"
                    >
                      <p className="font-medium text-slate-900">
                        {candidate.siiAccountCode ?? "Sin código"} —{" "}
                        {candidate.siiAccountName ?? "Cuenta no disponible"}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {candidate.confirmationCount} confirmaciones ·{" "}
                        {candidate.distinctCompanyCount} empresas · confianza{" "}
                        {percentage.format(candidate.confidence)} · acuerdo{" "}
                        {percentage.format(candidate.agreementRate)}
                      </p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            message="No se detectaron nombres con destinos SII en conflicto."
            compact
          />
        )}
      </Section>

      <Section
        title="Cobertura por rubro"
        description="Agregados industriales ordenados por mayor cantidad de evidencia."
      >
        {data.industries.length ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Rubro</th>
                  <th>Empresas</th>
                  <th>Confirmaciones</th>
                  <th>Nombres aprendidos</th>
                  <th>Confianza promedio</th>
                </tr>
              </thead>
              <tbody>
                {data.industries.map((industry) => (
                  <tr key={industry.industryId}>
                    <td className="font-medium text-slate-900">
                      {industry.industryName}
                    </td>
                    <td>{integer.format(industry.companyCount)}</td>
                    <td>{integer.format(industry.confirmationCount)}</td>
                    <td>{integer.format(industry.learnedNameCount)}</td>
                    <td>{percentage.format(industry.averageConfidence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            message="Todavía no existe aprendizaje agregado por rubro."
            compact
          />
        )}
      </Section>

      <Section
        title="Feedback del motor"
        description="Resultados observados en las revisiones registradas."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Revisiones registradas"
            value={integer.format(data.feedback.total)}
          />
          <Metric
            label="Sugerencias aceptadas"
            value={integer.format(data.feedback.accepted)}
          />
          <Metric
            label="Tasa de aceptación"
            value={percentage.format(data.feedback.acceptanceRate)}
          />
          <Metric
            label="Sugerencias corregidas"
            value={integer.format(data.feedback.corrected)}
            detail={`Tasa de corrección: ${percentage.format(data.feedback.correctionRate)}`}
          />
        </div>
      </Section>

      <Section
        title="Preparación del catálogo"
        description="Estas métricas sí corresponden exclusivamente a la versión seleccionada; describen fuentes disponibles, no calidad del aprendizaje global."
      >
        <label
          className="text-sm font-medium text-slate-800"
          htmlFor="coverage-version"
        >
          Versión del catálogo
        </label>
        <select
          id="coverage-version"
          value={versionId}
          onChange={(event) => onVersionChange(event.target.value)}
          className="mt-1 h-11 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3"
        >
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.code} — {version.name}
            </option>
          ))}
        </select>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Cuentas del catálogo"
            value={integer.format(data.catalogue.total)}
          />
          <Metric
            label="Con aliases"
            value={integer.format(data.catalogue.withAliases)}
            detail={`${data.catalogue.withoutAliases} sin aliases`}
          />
          <Metric
            label="Con conceptos"
            value={integer.format(data.catalogue.withConcepts)}
            detail={`${data.catalogue.withoutConcepts} sin conceptos`}
          />
          <Metric
            label="Usadas en aprendizaje"
            value={integer.format(data.catalogue.usedInLearning)}
            detail={`${data.catalogue.neverUsedInLearning} nunca utilizadas`}
          />
        </div>
        <Link
          href="/admin/sii-account-plan"
          className="mt-5 inline-flex text-sm font-medium text-emerald-700 hover:underline"
        >
          Abrir Plan de cuentas SII →
        </Link>
      </Section>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </article>
  );
}

function Distribution({
  title,
  values,
}: {
  title: string;
  values: AdminLearningDistribution;
}) {
  const total = values.high + values.medium + values.low;
  return (
    <div className="mt-4 first:mt-0">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Band
          label="Alta"
          value={values.high}
          total={total}
          tone="text-emerald-700"
        />
        <Band
          label="Media"
          value={values.medium}
          total={total}
          tone="text-amber-700"
        />
        <Band
          label="Baja"
          value={values.low}
          total={total}
          tone="text-rose-700"
        />
      </div>
    </div>
  );
}

function Band({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>
        {integer.format(value)}
      </p>
      <p className="text-xs text-slate-500">
        {percentage.format(total ? value / total : 0)}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="font-semibold text-slate-950">{integer.format(value)}</dd>
    </div>
  );
}

function EmptyState({
  message,
  compact = false,
}: {
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500 ${compact ? "p-6" : "mt-6 p-12"}`}
    >
      {message}
    </div>
  );
}
