import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Raffle } from "@/types";
import { Plus, Eye, EyeOff, Lock, Zap, ChevronRight } from "lucide-react";
import RaffleForm from "@/components/raffle/RaffleForm";

function Tip({ text, children }: { text: string; children: JSX.Element }) {
  return (
    <div className="group/tip relative inline-flex">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-hover/tip:opacity-100">
        {text}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </div>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:   { label: "Borrador", cls: "bg-slate-100 text-slate-600" },
  active:  { label: "Activa",   cls: "bg-green-100 text-green-700" },
  closed:  { label: "Cerrada",  cls: "bg-orange-100 text-orange-700" },
  drawn:   { label: "Sorteada", cls: "bg-purple-100 text-purple-700" },
};

export default function Raffles() {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: raffles = [], isLoading } = useQuery<Raffle[]>({
    queryKey: ["raffles"],
    queryFn: () => api.get("/raffles").then((r) => r.data),
  });

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/raffles/${id}`, { status }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["raffles"] });
      qc.invalidateQueries({ queryKey: ["raffle", variables.id] });
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: (id: string) => api.patch(`/raffles/${id}/visibility`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["raffles"] });
      qc.invalidateQueries({ queryKey: ["raffle", id] });
    },
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Rifas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {raffles.length} rifa{raffles.length !== 1 ? "s" : ""} en total
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nueva rifa
        </button>
      </div>

      {/* New raffle modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />
            <div className="max-h-[85vh] overflow-y-auto p-6">
              <h2 className="mb-5 text-lg font-bold text-foreground">Crear nueva rifa</h2>
              <RaffleForm
                onSuccess={() => {
                  setShowForm(false);
                  qc.invalidateQueries({ queryKey: ["raffles"] });
                }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : raffles.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mb-3 text-5xl">🎟️</div>
            <h3 className="font-semibold text-foreground">Sin rifas todavía</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea tu primera rifa para empezar a vender boletos.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Nueva rifa
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nombre
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Fecha sorteo
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Precio
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Progreso
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {raffles.map((r) => {
                  const st = STATUS_META[r.status];
                  return (
                    <tr key={r.id} className="group transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-foreground leading-tight">{r.title}</p>
                        {r.stats && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.stats.paid} / {r.total_tickets} vendidos
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {formatDate(r.draw_date)}
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-foreground">
                        {formatCurrency(r.ticket_price)}
                      </td>
                      <td className="px-4 py-4">
                        {r.stats && (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                                style={{ width: `${Math.min(r.stats.progress_pct, 100)}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs text-muted-foreground">
                              {r.stats.progress_pct.toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === "draft" && (
                            <Tip text="Activar rifa — los usuarios podrán comprar boletos">
                              <button
                                onClick={() => patchStatus.mutate({ id: r.id, status: "active" })}
                                disabled={patchStatus.isPending}
                                className="flex items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-50"
                              >
                                <Zap className="h-3 w-3" /> Activar
                              </button>
                            </Tip>
                          )}
                          {r.status === "active" && (
                            <Tip text="Cerrar rifa — detiene la venta de boletos">
                              <button
                                onClick={() => {
                                  if (confirm(`¿Cerrar la rifa "${r.title}"? Ya no se podrán vender boletos.`)) {
                                    patchStatus.mutate({ id: r.id, status: "closed" });
                                  }
                                }}
                                disabled={patchStatus.isPending}
                                className="flex items-center gap-1 rounded-lg bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                              >
                                <Lock className="h-3 w-3" /> Cerrar
                              </button>
                            </Tip>
                          )}
                          <Tip text={r.is_visible ? "Ocultar del público" : "Mostrar al público"}>
                            <button
                              onClick={() => toggleVisibility.mutate(r.id)}
                              disabled={toggleVisibility.isPending}
                              className={`rounded-lg p-1.5 transition-colors hover:bg-muted disabled:opacity-50 ${
                                r.is_visible ? "text-green-600 hover:text-green-800" : "text-slate-400 hover:text-slate-600"
                              }`}
                            >
                              {r.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </button>
                          </Tip>
                          <Tip text="Ver detalle de la rifa">
                            <Link
                              to={`/admin/rifas/${r.id}`}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Tip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
