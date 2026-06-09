import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { Payment, Raffle, Draw } from "@/types";
import { Trophy, ArrowLeft, Download, AlertTriangle, Search } from "lucide-react";

function SlotMachine({ finalNumber, isRunning }: { finalNumber?: number; isRunning: boolean }) {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="overflow-hidden rounded-2xl bg-slate-900 px-12 py-10 text-center shadow-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Boleto ganador
        </p>
        <AnimatePresence mode="wait">
          {isRunning ? (
            <motion.div
              key="running"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.12, repeat: Infinity }}
              className="font-mono text-6xl font-black text-indigo-400"
            >
              ????
            </motion.div>
          ) : finalNumber !== undefined ? (
            <motion.div
              key="result"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 18 }}
              className="font-mono text-6xl font-black text-green-400"
            >
              #{finalNumber.toString().padStart(4, "0")}
            </motion.div>
          ) : (
            <div className="font-mono text-6xl font-black text-slate-600">- - - -</div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface LotteryPreview {
  date: string;
  lottery_slug: string;
  result_raw: string;
  digits_used: number;
  winning_number: number;
  ticket_exists: boolean;
  ticket_status: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  has_winner: boolean;
}

export default function DrawPage() {
  const { id } = useParams<{ id: string }>();
  const [isAnimating, setIsAnimating] = useState(false);
  const [draw, setDraw] = useState<Draw | null>(null);

  // Lottery mode state
  const [lotteryDate, setLotteryDate] = useState("");
  const [lotteryPreview, setLotteryPreview] = useState<LotteryPreview | null>(null);
  const [lotteryLoading, setLotteryLoading] = useState(false);
  const [lotteryError, setLotteryError] = useState<string | null>(null);

  const { data: raffle } = useQuery<Raffle>({
    queryKey: ["raffle", id],
    queryFn: () => api.get(`/raffles/${id}`).then((r) => r.data),
  });

  useEffect(() => {
    if (raffle?.draw_date && !lotteryDate) {
      setLotteryDate(raffle.draw_date.slice(0, 10));
    }
  }, [raffle?.draw_date]);

  const { data: pendingPayments = [] } = useQuery<Payment[]>({
    queryKey: ["payments", "pending", id],
    queryFn: () => api.get(`/payments?status=pending&raffle_id=${id}`).then((r) => r.data),
    enabled: !!id && (raffle?.status === "closed" || raffle?.status === "active"),
  });

  const existingDraw = useQuery<Draw>({
    queryKey: ["draw", id],
    queryFn: () => api.get(`/raffles/${id}/draw`).then((r) => r.data),
    enabled: raffle?.status === "drawn",
    retry: false,
  });

  const conductDraw = useMutation({
    mutationFn: (body: { lottery_date?: string } | void) =>
      api.post(`/raffles/${id}/draw`, body ?? {}),
    onMutate: () => {
      setDraw(null);
      setIsAnimating(true);
    },
    onSuccess: (res) => {
      setTimeout(() => {
        setIsAnimating(false);
        setDraw(res.data);
        setLotteryPreview(null);
      }, 3200);
    },
    onError: () => setIsAnimating(false),
  });

  async function consultLotteryResult() {
    if (!lotteryDate || !raffle?.lottery_slug) return;
    setLotteryLoading(true);
    setLotteryError(null);
    setLotteryPreview(null);
    try {
      const res = await api.get(`/raffles/${id}/draw/lottery-preview`, {
        params: { date: lotteryDate },
      });
      setLotteryPreview(res.data);
    } catch (err: any) {
      setLotteryError(err.response?.data?.detail ?? "No se pudo consultar el resultado");
    } finally {
      setLotteryLoading(false);
    }
  }

  const displayDraw = draw ?? existingDraw.data;
  const isLotteryRaffle = !!raffle?.lottery_slug;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={`/admin/rifas/${id}`}
          className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-foreground">Sorteo</h1>
          <p className="text-sm text-muted-foreground">{raffle?.title}</p>
        </div>
      </div>

      {/* Raffle info card */}
      {raffle && (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />
          <div className="p-5 text-center">
            <Trophy className="mx-auto mb-2 h-8 w-8 text-amber-500" />
            <h2 className="text-lg font-bold text-foreground">{raffle.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{raffle.prize_description}</p>
            {isLotteryRaffle && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                🎰 Lotería: {raffle.lottery_slug?.replace(/-/g, " ").toUpperCase()} · {raffle.lottery_digits} dígitos
              </p>
            )}
          </div>
        </div>
      )}

      {/* Slot machine */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />
        <SlotMachine finalNumber={displayDraw?.result?.winning_number} isRunning={isAnimating} />
      </div>

      {/* Winner result */}
      {displayDraw?.result && !isAnimating && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`overflow-hidden rounded-2xl shadow-sm ${
            displayDraw.result.has_winner
              ? "border border-green-200 bg-green-50"
              : "border border-orange-200 bg-orange-50"
          }`}
        >
          <div className={`h-1 bg-gradient-to-r ${
            displayDraw.result.has_winner
              ? "from-green-400 to-emerald-500"
              : "from-orange-400 to-amber-500"
          }`} />
          <div className="p-6 text-center">
            {displayDraw.result.has_winner ? (
              <>
                <div className="mb-3 text-4xl">🏆</div>
                <h3 className="text-xl font-black text-green-900">¡Tenemos ganador!</h3>
                <div className="mt-4 space-y-1 text-sm text-green-800">
                  <p className="text-lg font-bold">{displayDraw.result.buyer_name}</p>
                  {displayDraw.result.buyer_phone && (
                    <p className="text-green-700">{displayDraw.result.buyer_phone}</p>
                  )}
                  {displayDraw.result.buyer_email && (
                    <p className="text-green-700">{displayDraw.result.buyer_email}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 text-4xl">🎲</div>
                <h3 className="text-xl font-black text-orange-900">Boleto no vendido</h3>
                <p className="mt-2 text-sm text-orange-700">
                  El número{" "}
                  <span className="font-mono font-bold">
                    #{displayDraw.result.winning_number.toString().padStart(4, "0")}
                  </span>{" "}
                  no fue vendido.{" "}
                  {!isLotteryRaffle && "Puedes realizar un nuevo sorteo."}
                </p>
              </>
            )}

            {displayDraw.conducted_by_name && (
              <p className="mt-4 text-xs text-center opacity-60">
                Sorteo realizado por {displayDraw.conducted_by_name}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {/* Re-draw only available for random raffles */}
              {!displayDraw.result.has_winner && !isLotteryRaffle && (
                <button
                  onClick={() => {
                    if (confirm("¿Realizar un nuevo sorteo? El resultado anterior será reemplazado.")) {
                      conductDraw.mutate();
                    }
                  }}
                  disabled={isAnimating || conductDraw.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  🎰 Sortear de nuevo
                </button>
              )}
              <a
                href={`/api/v1/raffles/${id}/draw/certificate`}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${
                  displayDraw.result.has_winner
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                <Download className="h-4 w-4" />
                Descargar acta del sorteo
              </a>
            </div>
          </div>
        </motion.div>
      )}

      {/* Pending payments warning */}
      {pendingPayments.length > 0 && !displayDraw && (
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <div className="flex items-start gap-3 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold text-amber-900">
                {pendingPayments.length} pago{pendingPayments.length !== 1 ? "s" : ""} pendiente{pendingPayments.length !== 1 ? "s" : ""} de confirmar
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Confirma o rechaza todos los pagos antes de realizar el sorteo.
              </p>
              <Link
                to="/admin/pagos"
                className="mt-2 inline-block text-sm font-semibold text-amber-700 hover:underline"
              >
                Ir a pagos →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Lottery draw panel ─────────────────────────────────────────────────── */}
      {isLotteryRaffle && (raffle?.status === "closed" || raffle?.status === "active") && !displayDraw && (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />
          <div className="space-y-4 p-6">
            <h3 className="font-bold text-foreground">Consultar resultado de la lotería</h3>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Fecha del sorteo
              </label>
              <input
                type="date"
                value={lotteryDate}
                onChange={(e) => {
                  setLotteryDate(e.target.value);
                  setLotteryPreview(null);
                  setLotteryError(null);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              type="button"
              onClick={consultLotteryResult}
              disabled={!lotteryDate || lotteryLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              {lotteryLoading ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /> Consultando...</>
              ) : (
                <><Search className="h-4 w-4" /> Consultar resultado</>
              )}
            </button>

            {lotteryError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {lotteryError}
              </div>
            )}

            {lotteryPreview && (
              <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-indigo-600">Resultado de la lotería</span>
                  <span className="font-mono text-2xl font-black text-indigo-900 tracking-widest">
                    {lotteryPreview.result_raw}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-indigo-600">
                    Últimos {lotteryPreview.digits_used} dígitos → boleto ganador
                  </span>
                  <span className="font-mono text-xl font-black text-indigo-900">
                    #{lotteryPreview.winning_number.toString().padStart(lotteryPreview.digits_used, "0")}
                  </span>
                </div>

                {lotteryPreview.has_winner ? (
                  <div className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-800">
                    ✅ El boleto fue vendido a{" "}
                    <strong>{lotteryPreview.buyer_name}</strong>
                    {lotteryPreview.buyer_phone && ` · ${lotteryPreview.buyer_phone}`}
                  </div>
                ) : lotteryPreview.ticket_exists ? (
                  <div className="rounded-lg bg-orange-100 px-3 py-2 text-sm text-orange-800">
                    ⚠️ El boleto existe pero no fue vendido (estado: {lotteryPreview.ticket_status})
                  </div>
                ) : (
                  <div className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
                    ❌ El número ganador no existe en esta rifa
                  </div>
                )}

                {lotteryPreview.ticket_exists && (
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `¿Confirmar el sorteo con el número #${lotteryPreview.winning_number
                            .toString()
                            .padStart(lotteryPreview.digits_used, "0")} de la lotería del ${lotteryDate}?`
                        )
                      ) {
                        conductDraw.mutate({ lottery_date: lotteryDate });
                      }
                    }}
                    disabled={isAnimating || conductDraw.isPending}
                    className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 disabled:opacity-50"
                  >
                    🎰 Confirmar sorteo con este número
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Random draw button (non-lottery raffles) ───────────────────────────── */}
      {!isLotteryRaffle && raffle?.status === "closed" && !displayDraw && (
        <div className="rounded-2xl border border-border bg-white p-6 text-center shadow-sm">
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">
                Esta acción es <strong>irreversible</strong>. Se seleccionará un ganador de forma aleatoria entre los boletos pagados.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm("¿Estás seguro de realizar el sorteo ahora? Esta acción no se puede deshacer.")) {
                conductDraw.mutate();
              }
            }}
            disabled={isAnimating || conductDraw.isPending || pendingPayments.length > 0}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-base font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isAnimating ? "🎰 Sorteando..." : "🎰 Realizar sorteo ahora"}
          </button>
        </div>
      )}

      {/* Loading state for already-drawn raffle */}
      {raffle?.status === "drawn" && !displayDraw && existingDraw.isLoading && (
        <div className="flex h-20 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
