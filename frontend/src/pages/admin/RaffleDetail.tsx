import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, downloadFile } from "@/lib/api";
import { formatCurrency, formatDate, ticketStatusLabel } from "@/lib/utils";
import type { Raffle, Ticket, Draw } from "@/types";
import { Trophy, Download, ArrowLeft, Lock, Loader2, Phone, Mail } from "lucide-react";

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

const TICKET_COLORS: Record<string, string> = {
  available: "bg-slate-100 text-slate-500 border border-slate-200",
  reserved:  "bg-amber-50 text-amber-700 border border-amber-300",
  paid:      "bg-green-50 text-green-700 border border-green-300",
  cancelled: "bg-red-50 text-red-400 border border-red-200",
};

export default function RaffleDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [downloading, setDownloading] = useState(false);

  const { data: raffle } = useQuery<Raffle>({
    queryKey: ["raffle", id],
    queryFn: () => api.get(`/raffles/${id}`).then((r) => r.data),
  });

  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["tickets-admin", id],
    queryFn: () => api.get(`/raffles/${id}/tickets/admin`).then((r) => r.data),
    enabled: !!id,
    refetchInterval: 20_000,
  });

  const { data: drawData } = useQuery<Draw>({
    queryKey: ["draw-admin", id],
    queryFn: () => api.get(`/raffles/${id}/draw`).then((r) => r.data),
    enabled: raffle?.status === "drawn",
    retry: false,
  });

  const closeRaffle = useMutation({
    mutationFn: () => api.patch(`/raffles/${id}`, { status: "closed" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raffle", id] });
      qc.invalidateQueries({ queryKey: ["raffles"] });
    },
  });

  if (!raffle)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );

  const stats = raffle.stats;
  const reservedCount = tickets.filter((t) => t.status === "reserved").length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + title */}
      <div className="flex items-center gap-3">
        <Link
          to="/admin/rifas"
          className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-2xl font-black text-foreground">{raffle.title}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">{formatDate(raffle.draw_date)}</p>
            {raffle.lottery_slug && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                🎰 {raffle.lottery_slug.replace(/-/g, " ").toUpperCase()}
                {raffle.lottery_digits && (
                  <span className="rounded-full bg-indigo-100 px-1.5 text-[10px] text-indigo-500">
                    {raffle.lottery_digits} dígitos
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            raffle.status === "active" ? "bg-green-100 text-green-700"
            : raffle.status === "draft" ? "bg-slate-100 text-slate-600"
            : raffle.status === "closed" ? "bg-orange-100 text-orange-700"
            : "bg-purple-100 text-purple-700"
          }`}
        >
          {raffle.status === "active" ? "Activa" : raffle.status === "draft" ? "Borrador" : raffle.status === "closed" ? "Cerrada" : "Sorteada"}
        </span>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Disponibles", value: stats.available, bar: "from-slate-400 to-slate-500", color: "text-slate-600" },
            { label: "Reservados",  value: stats.reserved,  bar: "from-amber-400 to-orange-400", color: "text-amber-700" },
            { label: "Vendidos",    value: stats.paid,      bar: "from-green-400 to-emerald-500", color: "text-green-700" },
            { label: "Recaudado",   value: formatCurrency(stats.revenue), bar: "from-indigo-500 to-violet-500", color: "text-indigo-700" },
          ].map((s) => (
            <div key={s.label} className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div className={`h-1 bg-gradient-to-r ${s.bar}`} />
              <div className="p-4">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className={`mt-1 text-xl font-black ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {stats && (
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Progreso de ventas</span>
            <span className="font-bold text-foreground">{stats.progress_pct.toFixed(1)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
              style={{ width: `${Math.min(stats.progress_pct, 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(stats.revenue)}</span>
            <span>Meta: {formatCurrency(stats.target)}</span>
          </div>
        </div>
      )}

      {/* Winner card */}
      {raffle.status === "drawn" && drawData?.result && (
        <div className="overflow-hidden rounded-2xl border border-purple-200 bg-purple-50 shadow-sm">
          <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-600" />
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-3xl">
                🏆
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-purple-400">Número ganador</p>
                <p className="font-mono text-4xl font-black text-purple-900">
                  #{drawData.result.winning_number.toString().padStart(4, "0")}
                </p>
              </div>
            </div>

            {drawData.result.has_winner ? (
              <div className="mt-4 space-y-2 rounded-xl bg-white p-4">
                <p className="text-base font-bold text-foreground">{drawData.result.buyer_name}</p>
                {drawData.result.buyer_phone && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {drawData.result.buyer_phone}
                  </p>
                )}
                {drawData.result.buyer_email && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {drawData.result.buyer_email}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-700">
                El boleto ganador no fue vendido.
              </div>
            )}

            <div className="mt-4">
              <a
                href={`/api/v1/raffles/${id}/draw/certificate`}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
              >
                <Download className="h-4 w-4" /> Descargar acta del sorteo
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Tip text="Descargar lista de compradores en Excel">
          <button
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadFile(`/reports/raffles/${id}/buyers/csv`, `compradores-${id}.xlsx`);
              } finally {
                setDownloading(false);
              }
            }}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar compradores
          </button>
        </Tip>

        {raffle.status === "active" && (
          <Tip text="Detener la venta — ya no se podrán comprar boletos">
            <button
              onClick={() => {
                if (confirm(`¿Cerrar la rifa "${raffle.title}"?\nYa no se podrán vender más boletos.`)) {
                  closeRaffle.mutate();
                }
              }}
              disabled={closeRaffle.isPending}
              className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 shadow-sm hover:bg-orange-100 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" /> Cerrar rifa
            </button>
          </Tip>
        )}

        {(raffle.status === "closed" || raffle.status === "active") && (
          <Tip text="Ir a la página de sorteo para elegir el ganador">
            <Link
              to={`/admin/rifas/${id}/sorteo`}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              <Trophy className="h-4 w-4" /> Realizar sorteo
            </Link>
          </Tip>
        )}

        {reservedCount > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700">
            <span className="font-semibold">{reservedCount}</span> boleto{reservedCount !== 1 ? "s" : ""} reservado{reservedCount !== 1 ? "s" : ""} — confirma el pago en{" "}
            <Link to="/admin/pagos" className="font-semibold underline underline-offset-2 hover:text-amber-900">
              Pagos
            </Link>
          </div>
        )}
      </div>

      {/* Ticket grid */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-bold text-foreground">
            Boletos{" "}
            <span className="font-normal text-sm text-muted-foreground">({tickets.length})</span>
          </h2>
        </div>

        {/* Legend */}
        <div className="mb-4 flex flex-wrap gap-3 text-xs">
          {[
            { label: "Disponible", cls: "bg-slate-100 border border-slate-200" },
            { label: "Reservado",  cls: "bg-amber-50 border border-amber-300" },
            { label: "Pagado",     cls: "bg-green-50 border border-green-300" },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`h-4 w-4 rounded ${cls}`} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        <div className="ticket-grid">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              title={`${ticketStatusLabel(ticket.status)}${ticket.buyer_name ? ` — ${ticket.buyer_name}` : ""}${ticket.buyer_phone ? ` · ${ticket.buyer_phone}` : ""}`}
              className={`flex min-h-[40px] items-center justify-center rounded-lg text-xs font-mono font-semibold ${TICKET_COLORS[ticket.status]}`}
            >
              {ticket.number.toString().padStart(4, "0")}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
