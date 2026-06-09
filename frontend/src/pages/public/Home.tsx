import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { differenceInDays, parseISO } from "date-fns";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useTenantStore } from "@/store/tenantStore";
import type { Raffle } from "@/types";
import { Ticket, MessageCircle, Trophy, Star, Shield, Clock } from "lucide-react";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:  { label: "Activa",   cls: "bg-green-500 text-white" },
  closed:  { label: "Cerrada",  cls: "bg-orange-500 text-white" },
  drawn:   { label: "Sorteada", cls: "bg-purple-500 text-white" },
  draft:   { label: "Borrador", cls: "bg-slate-400 text-white" },
};

function DaysBadge({ drawDate }: { drawDate: string }) {
  const days = differenceInDays(parseISO(drawDate), new Date());
  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
        <Clock className="h-3 w-3" /> Sorteo realizado
      </span>
    );
  if (days === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 animate-pulse">
        <Clock className="h-3 w-3" /> ¡Hoy es el sorteo!
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
      <Clock className="h-3 w-3" />
      {days === 1 ? "Mañana" : `${days} días`} para el sorteo
    </span>
  );
}

export default function Home() {
  const config = useTenantStore((s) => s.config);

  const { data: raffles = [] } = useQuery<Raffle[]>({
    queryKey: ["public-raffles"],
    queryFn: () => api.get("/raffles/public").then((r) => r.data),
  });

  const activeCount = raffles.length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* ── Hero ── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white">
        {/* Decorative lottery balls */}
        <div className="pointer-events-none absolute inset-0 select-none" aria-hidden>
          {(
            ["🎰", "🎲", "🎟️", "⭐", "🏆", "💰", "🎊", "🍀"] as const
          ).map((emoji, i) => (
            <span
              key={i}
              className="absolute text-3xl opacity-[0.12]"
              style={{
                top: `${[8, 28, 58, 78, 18, 48, 68, 38][i]}%`,
                left: `${[4, 14, 24, 38, 58, 68, 80, 91][i]}%`,
                transform: `rotate(${[12, -20, 8, -15, 25, -8, 18, -12][i]}deg)`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>

        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center">
          {/* Trust badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <Shield className="h-3.5 w-3.5 text-yellow-300" />
            Rifas 100 % seguras y transparentes
          </div>

          {/* Logo / name */}
          {config?.logoUrl && (
            <img
              src={config.logoUrl}
              alt={config.name}
              className="mx-auto mb-5 h-16 drop-shadow-lg"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <h1 className="mb-3 text-5xl font-black drop-shadow-lg sm:text-6xl">
            {config?.name ?? "RifaYa"}
          </h1>
          <p className="mb-8 text-xl font-medium opacity-90">
            {config?.tagline ?? "¡Tu suerte empieza aquí!"}
          </p>

          {/* Stats pills */}
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            {[
              { icon: Trophy, label: `${activeCount} rifa${activeCount !== 1 ? "s" : ""} activa${activeCount !== 1 ? "s" : ""}`, color: "text-yellow-300" },
              { icon: Star, label: "Sorteos verificados", color: "text-yellow-300" },
              { icon: Ticket, label: "Boletos digitales", color: "text-yellow-300" },
            ].map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm"
              >
                <Icon className={`h-4 w-4 ${color}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Raffle list ── */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Rifas disponibles</h2>
          <span className="text-sm text-muted-foreground">
            {activeCount} activa{activeCount !== 1 ? "s" : ""}
          </span>
        </div>

        {raffles.length === 0 ? (
          <div className="py-24 text-center">
            <div className="mb-4 text-6xl">🎟️</div>
            <h3 className="mb-1 text-lg font-semibold text-foreground">Sin rifas por ahora</h3>
            <p className="text-muted-foreground">Vuelve pronto, ¡se vienen grandes premios!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {raffles.map((raffle) => (
              <Link
                key={raffle.id}
                to={`/rifa/${raffle.slug}`}
                className="group overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                {/* Image area */}
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100">
                  {raffle.prize_images?.[0] ? (
                    <img
                      src={raffle.prize_images[0]}
                      alt={raffle.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-7xl opacity-20">
                      🏆
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute right-3 top-3">
                    {(() => {
                      const m = STATUS_META[raffle.status];
                      return (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold shadow ${m?.cls ?? "bg-slate-400 text-white"}`}>
                          {m?.label ?? raffle.status}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="absolute bottom-3 left-3 text-white">
                    <DaysBadge drawDate={raffle.draw_date} />
                  </div>
                </div>

                {/* Card body */}
                <div className="p-5">
                  <h3 className="mb-1 line-clamp-1 text-lg font-bold text-foreground">
                    {raffle.title}
                  </h3>
                  <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                    {raffle.prize_description}
                  </p>

                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Ticket className="h-4 w-4 text-primary" />
                      <span className="text-base font-bold text-primary">
                        {formatCurrency(raffle.ticket_price)}
                      </span>
                      <span className="text-sm text-muted-foreground">/ boleto</span>
                    </div>
                    {raffle.stats && (
                      <span className="text-xs text-muted-foreground">
                        {raffle.stats.available} disponibles
                      </span>
                    )}
                  </div>

                  {raffle.stats && (
                    <>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                          style={{ width: `${Math.min(raffle.stats.progress_pct, 100)}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                        <span>{raffle.stats.progress_pct.toFixed(0)}% vendido</span>
                        <span>
                          {raffle.stats.paid} / {raffle.total_tickets}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="mt-auto bg-slate-900 text-slate-300">
        {/* Gradient top accent */}
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />

        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {/* Brand */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <img src={config?.logoUrl} alt="RifaYa" className="h-28 w-28 object-contain" />
                <span className="text-lg font-bold text-white">
                  {config?.name ?? "RifaYa"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-400">
                {config?.tagline ?? "Rifas digitales seguras y transparentes. Tu suerte empieza aquí."}
              </p>
            </div>

            {/* Info */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Información
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <span className="text-slate-400">Boletos 100% digitales</span>
                </li>
                <li>
                  <span className="text-slate-400">Sorteos en vivo verificados</span>
                </li>
                <li>
                  <span className="text-slate-400">Resultados públicos</span>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Contacto
              </h3>
              <div className="space-y-2 text-sm">
                {config?.whatsappUrl ? (
                  <a
                    href={config.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-green-400 transition-colors hover:text-green-300"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                ) : (
                  <span className="text-slate-500">Contáctanos por WhatsApp</span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 border-t border-white/10 pt-6 text-center">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} {config?.name ?? "RifaYa"}. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp floating button ── */}
      {config?.whatsappUrl && (
        <a
          href={config.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Contactar por WhatsApp"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-xl transition-all hover:scale-110 hover:bg-green-600"
        >
          <MessageCircle className="h-7 w-7" />
        </a>
      )}
    </div>
  );
}
