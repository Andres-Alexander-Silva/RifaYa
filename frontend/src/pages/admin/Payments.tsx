import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, paymentMethodLabel } from "@/lib/utils";
import type { Payment } from "@/types";
import { CheckCircle, Clock, XCircle, RotateCcw, DollarSign, ImageIcon, X } from "lucide-react";

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending:   { label: "Pendiente",   cls: "bg-amber-100 text-amber-700",  icon: Clock },
  confirmed: { label: "Confirmado",  cls: "bg-green-100 text-green-700",  icon: CheckCircle },
  failed:    { label: "Fallido",     cls: "bg-red-100 text-red-700",      icon: XCircle },
  refunded:  { label: "Devuelto",    cls: "bg-slate-100 text-slate-600",  icon: RotateCcw },
};

const METHOD_ICON: Record<string, string> = {
  cash:         "💵",
  transfer:     "🏦",
  wompi:        "💳",
  mercadopago:  "🔵",
};

export default function Payments() {
  const qc = useQueryClient();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: () => api.get("/payments").then((r) => r.data),
    refetchInterval: 30_000,
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/payments/${id}/confirm`, { notes: notes || undefined }),
    onSuccess: (_data, { id }) => {
      setNotesMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });

  const pending = payments.filter((p) => p.status === "pending");
  const confirmed = payments.filter((p) => p.status === "confirmed");
  const totalConfirmed = confirmed.reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-foreground">Pagos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestión y confirmación de pagos recibidos
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Por confirmar",
            value: pending.length,
            sub: `${pending.length} pendiente${pending.length !== 1 ? "s" : ""}`,
            bar: "from-amber-400 to-orange-400",
            icon: Clock,
            iconBg: "bg-amber-100 text-amber-700",
          },
          {
            label: "Confirmados",
            value: confirmed.length,
            sub: `${confirmed.length} pago${confirmed.length !== 1 ? "s" : ""}`,
            bar: "from-green-400 to-emerald-500",
            icon: CheckCircle,
            iconBg: "bg-green-100 text-green-700",
          },
          {
            label: "Total recaudado",
            value: formatCurrency(totalConfirmed),
            sub: "en pagos confirmados",
            bar: "from-indigo-500 to-violet-500",
            icon: DollarSign,
            iconBg: "bg-indigo-100 text-indigo-700",
          },
        ].map((s) => (
          <div key={s.label} className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className={`h-1 bg-gradient-to-r ${s.bar}`} />
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                <div className={`rounded-xl p-2 ${s.iconBg}`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-foreground">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending payments — confirm section */}
      {pending.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <div className="border-b border-amber-200 px-5 py-4">
            <h2 className="font-bold text-amber-900">
              Pagos por confirmar{" "}
              <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {pending.length}
              </span>
            </h2>
          </div>
          <div className="divide-y divide-amber-100">
            {pending.map((payment) => (
              <div key={payment.id} className="px-5 py-3.5 space-y-2">
                <div className="flex items-center gap-4">
                  <span className="text-lg">{METHOD_ICON[payment.method] ?? "💳"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-amber-900">
                      {formatCurrency(Number(payment.amount))}
                      <span className="ml-2 text-xs font-normal text-amber-700">
                        · {payment.ticket_ids.length} boleto{payment.ticket_ids.length !== 1 ? "s" : ""}
                        · {paymentMethodLabel(payment.method)}
                      </span>
                    </p>
                    <p className="text-xs text-amber-700">{formatDate(payment.created_at)}</p>
                  </div>
                  {payment.receipt_url && (
                    <button
                      onClick={() => setLightbox(payment.receipt_url!)}
                      className="group shrink-0"
                      title="Ver comprobante"
                    >
                      <img
                        src={payment.receipt_url}
                        alt="Comprobante"
                        className="h-10 w-10 rounded-lg border border-amber-300 object-cover shadow-sm transition-transform group-hover:scale-105"
                      />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nota interna (opcional)"
                    value={notesMap[payment.id] ?? ""}
                    onChange={(e) =>
                      setNotesMap((prev) => ({ ...prev, [payment.id]: e.target.value }))
                    }
                    className="flex-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <button
                    onClick={() =>
                      confirmMutation.mutate({ id: payment.id, notes: notesMap[payment.id] })
                    }
                    disabled={confirmMutation.isPending}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Confirmar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments history table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-bold text-foreground">Historial de pagos</h2>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mb-3 text-5xl">💳</div>
            <h3 className="font-semibold text-foreground">Sin pagos registrados</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Los pagos aparecerán aquí cuando los compradores reserven boletos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  {[
                    { h: "Fecha",       cls: "text-left" },
                    { h: "Método",      cls: "text-left" },
                    { h: "Monto",       cls: "text-right" },
                    { h: "Boletos",     cls: "text-right" },
                    { h: "Comprobante", cls: "text-center" },
                    { h: "Estado",      cls: "text-center" },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((payment) => {
                  const st = STATUS_META[payment.status];
                  const Icon = st.icon;
                  return (
                    <tr key={payment.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-4 text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <span>{METHOD_ICON[payment.method] ?? "💳"}</span>
                          {paymentMethodLabel(payment.method)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-foreground">
                        {formatCurrency(Number(payment.amount))}
                      </td>
                      <td className="px-5 py-4 text-right text-muted-foreground">
                        {payment.ticket_ids.length} boleto{payment.ticket_ids.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {payment.receipt_url ? (
                          <button
                            onClick={() => setLightbox(payment.receipt_url!)}
                            className="group relative inline-block"
                            title="Ver comprobante"
                          >
                            <img
                              src={payment.receipt_url}
                              alt="Comprobante"
                              className="h-10 w-10 rounded-lg border border-border object-cover shadow-sm transition-transform group-hover:scale-105"
                            />
                          </button>
                        ) : (
                          <span className="text-slate-300">
                            <ImageIcon className="mx-auto h-4 w-4" />
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
                          <Icon className="h-3 w-3" />
                          {st.label}
                        </span>
                        {payment.status === "confirmed" && payment.confirmed_by_name && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            por {payment.confirmed_by_name}
                          </p>
                        )}
                        {payment.notes && (
                          <p className="mt-0.5 text-xs text-muted-foreground italic">
                            {payment.notes}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-[90vh] max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox}
              alt="Comprobante de pago"
              className="max-h-[85vh] w-auto rounded-2xl shadow-2xl object-contain"
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute -right-3 -top-3 rounded-full bg-white p-1.5 shadow-lg hover:bg-slate-100"
            >
              <X className="h-4 w-4 text-slate-700" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
