import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ticketStatusLabel } from "@/lib/utils";
import type { Ticket } from "@/types";
import { Search, ArrowLeft } from "lucide-react";

export default function TicketSearch() {
  const { slug } = useParams<{ slug: string }>();
  const [searchNumber, setSearchNumber] = useState("");
  const [queriedNumber, setQueriedNumber] = useState<number | null>(null);

  const { data: raffle } = useQuery<{ id: string; title: string }>({
    queryKey: ["public-raffle-id", slug],
    queryFn: () => api.get(`/raffles/public/${slug}`).then((r) => r.data),
  });

  const { data: ticket, isLoading, isError } = useQuery<Ticket>({
    queryKey: ["ticket-search", raffle?.id, queriedNumber],
    queryFn: () =>
      api
        .get(`/raffles/${raffle!.id}/tickets/search/${queriedNumber}`)
        .then((r) => r.data),
    enabled: !!raffle?.id && queriedNumber !== null,
    retry: false,
  });

  const handleSearch = () => {
    const n = parseInt(searchNumber, 10);
    if (!isNaN(n)) setQueriedNumber(n);
  };

  const STATUS_BG: Record<string, string> = {
    available: "bg-green-50 border-green-200 text-green-800",
    reserved: "bg-amber-50 border-amber-200 text-amber-800",
    paid: "bg-blue-50 border-blue-200 text-blue-800",
    cancelled: "bg-slate-50 border-slate-200 text-slate-600",
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-md space-y-5">
        <Link
          to={`/rifa/${slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la rifa
        </Link>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-bold text-foreground">Buscar mi boleto</h1>
          {raffle?.title && (
            <p className="mb-5 text-sm text-muted-foreground">{raffle.title}</p>
          )}

          <div className="flex gap-2">
            <input
              type="number"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Número de boleto"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={handleSearch}
              disabled={!searchNumber || isLoading}
              className="rounded-lg bg-primary px-4 py-2.5 text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="py-4 text-center text-sm text-muted-foreground">Buscando...</div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            Boleto no encontrado. Verifica el número.
          </div>
        )}

        {ticket && (
          <div className={`rounded-2xl border p-5 ${STATUS_BG[ticket.status] ?? ""}`}>
            <div className="mb-3 text-center">
              <span className="font-mono text-4xl font-black">
                #{ticket.number.toString().padStart(4, "0")}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Estado:</span>{" "}
                {ticketStatusLabel(ticket.status)}
              </p>
              {ticket.buyer_name && (
                <p>
                  <span className="font-medium">Comprador:</span> {ticket.buyer_name}
                </p>
              )}
              {ticket.paid_at && (
                <p>
                  <span className="font-medium">Pagado el:</span>{" "}
                  {new Date(ticket.paid_at).toLocaleDateString("es-CO")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
