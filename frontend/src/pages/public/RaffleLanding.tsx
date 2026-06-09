import { useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { differenceInDays, parseISO } from "date-fns";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useTenantStore } from "@/store/tenantStore";
import type { Raffle, Ticket, Draw } from "@/types";
import {
  ArrowLeft, Search, ShoppingCart, Clock, CheckCircle,
  MessageCircle, Upload, X, Banknote, Smartphone, Building2, ImageIcon, Trophy, Lock
} from "lucide-react";
import { useRaffleSocket } from "@/hooks/useRaffleSocket";
import type { TicketPatch } from "@/hooks/useRaffleSocket";

// ── Schemas ───────────────────────────────────────────────────────────────────

const buyerSchema = z.object({
  buyer_name: z.string().min(2, "Ingresa tu nombre completo"),
  buyer_phone: z.string().min(7, "Teléfono inválido (mín. 7 dígitos)"),
  buyer_email: z.string().email("Email inválido").optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).max(20),
});
type BuyerForm = z.infer<typeof buyerSchema>;

// ── Ticket styles ──────────────────────────────────────────────────────────────

const TICKET_STYLES: Record<string, string> = {
  available: "bg-white border border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary cursor-pointer transition-all",
  reserved: "bg-amber-50 border border-amber-200 text-amber-700 cursor-not-allowed",
  paid: "bg-green-50 border border-green-200 text-green-700 cursor-not-allowed",
  cancelled: "bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed",
};

type Step = "browse" | "form" | "payment" | "confirmed";

// ── Component ─────────────────────────────────────────────────────────────────

export default function RaffleLanding() {
  const { slug } = useParams<{ slug: string }>();
  const config = useTenantStore((s) => s.config);

  const [step, setStep] = useState<Step>("browse");
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [reserved, setReserved] = useState<Ticket[]>([]);
  const [payMethod, setPayMethod] = useState<"transfer" | "cash">("transfer");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();

  const { data: raffle } = useQuery<Raffle>({
    queryKey: ["public-raffle", slug],
    queryFn: () => api.get(`/raffles/public/${slug}`).then((r) => r.data),
  });

  const { data: drawData } = useQuery<Draw>({
    queryKey: ["draw-public", raffle?.id],
    queryFn: () => api.get(`/raffles/${raffle!.id}/draw`).then((r) => r.data),
    enabled: raffle?.status === "drawn",
    retry: false,
  });

  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["tickets-public", raffle?.id],
    queryFn: () => api.get(`/raffles/${raffle!.id}/tickets`).then((r) => r.data),
    enabled: !!raffle?.id,
    refetchInterval: 15_000,
  });

  // Real-time updates via WebSocket
  useRaffleSocket(raffle?.id, (patches: TicketPatch[]) => {
    qc.setQueryData<Ticket[]>(["tickets-public", raffle?.id], (old = []) => {
      const map = new Map(patches.map((p) => [p.id, p.status]));
      return old.map((t) => (map.has(t.id) ? { ...t, status: map.get(t.id) as Ticket["status"] } : t));
    });
  });

  const { register, handleSubmit, formState: { errors } } = useForm<BuyerForm>({
    resolver: zodResolver(buyerSchema),
    defaultValues: { quantity: 1 },
  });

  // Step 2 → 3: reserve tickets
  const reserveMutation = useMutation({
    mutationFn: (data: BuyerForm) =>
      api.post(`/raffles/${raffle!.id}/tickets/reserve-bulk`, {
        buyer_name: data.buyer_name,
        buyer_phone: data.buyer_phone,
        buyer_email: data.buyer_email || undefined,
        quantity: data.quantity,
        specific_numbers: selectedNumbers.length > 0 ? selectedNumbers : undefined,
      }).then((r) => r.data),
    onSuccess: (data: Ticket[]) => {
      setReserved(data);
      setStep("payment");
    },
  });

  // Step 3 → 4: submit payment proof
  const submitPayment = useMutation({
    mutationFn: () => {
      const amount = reserved.length * (raffle?.ticket_price ?? 0);
      return api.post("/payments/public-submit", {
        ticket_ids: reserved.map((t) => t.id),
        method: payMethod,
        amount,
        receipt_url: proofUrl ?? undefined,
        notes: payMethod === "cash" ? "Pago en efectivo" : undefined,
      });
    },
    onSuccess: () => setStep("confirmed"),
  });

  // Upload proof image
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/uploads/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProofUrl(res.data.url);
    } catch {
      alert("Error al subir la imagen. Verifica que sea JPG, PNG o WebP.");
    } finally {
      setUploadingProof(false);
    }
  };

  const toggleNumber = (num: number) => {
    setSelectedNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  const daysLeft = raffle ? differenceInDays(parseISO(raffle.draw_date), new Date()) : null;
  const payConfig = config?.payment;

  if (!raffle)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white shadow-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link to="/" className="rounded-lg p-1.5 transition-colors hover:bg-white/20">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="flex-1 truncate font-bold leading-tight">{raffle.title}</span>
          <span className="rounded-full bg-white/20 px-3 py-0.5 text-sm font-semibold">
            {formatCurrency(raffle.ticket_price)}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {/* Prize card */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          {raffle.prize_images?.[0] && (
            <div className="relative h-56 overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100">
              <img src={raffle.prize_images[0]} alt={raffle.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          )}
          <div className="p-5">
            <h1 className="text-2xl font-black text-foreground">{raffle.title}</h1>
            <p className="mt-1 text-muted-foreground">{raffle.prize_description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{formatDate(raffle.draw_date)}</span>
              </div>
              {daysLeft !== null && daysLeft >= 0 && (
                <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  daysLeft === 0 ? "bg-red-100 text-red-600 animate-pulse"
                  : daysLeft <= 3 ? "bg-amber-100 text-amber-700"
                  : "bg-green-100 text-green-700"
                }`}>
                  {daysLeft === 0 ? "¡Hoy es el sorteo!" : daysLeft === 1 ? "Mañana es el sorteo" : `${daysLeft} días para el sorteo`}
                </span>
              )}
              {raffle.lottery_slug && (
                <span className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                  🎰 Lotería:{" "}
                  {raffle.lottery_slug.replace(/-/g, " ").toUpperCase()}
                  {raffle.lottery_digits && (
                    <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-500">
                      {raffle.lottery_digits} dígitos
                    </span>
                  )}
                </span>
              )}
            </div>
            {raffle.stats && (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                  <span>{raffle.stats.progress_pct.toFixed(0)}% vendido</span>
                  <span>{raffle.stats.paid} vendidos · {raffle.stats.available} disponibles</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                    style={{ width: `${Math.min(raffle.stats.progress_pct, 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CLOSED / DRAWN banner + read-only grid ──────────────────── */}
        {raffle.status !== "active" && step === "browse" && (
          <>
            <div className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${
              raffle.status === "drawn"
                ? "border-purple-200 bg-purple-50"
                : "border-orange-200 bg-orange-50"
            }`}>
              {raffle.status === "drawn"
                ? <Trophy className="h-5 w-5 shrink-0 text-purple-600" />
                : <Lock className="h-5 w-5 shrink-0 text-orange-500" />
              }
              <div>
                <p className={`font-bold ${raffle.status === "drawn" ? "text-purple-800" : "text-orange-800"}`}>
                  {raffle.status === "drawn" ? "Sorteo realizado" : "Rifa cerrada — no se venden más boletos"}
                </p>
                <p className={`text-sm ${raffle.status === "drawn" ? "text-purple-600" : "text-orange-600"}`}>
                  {raffle.status === "drawn"
                    ? "Ya se realizó el sorteo. Puedes consultar los números aquí abajo."
                    : "La venta de boletos ha cerrado. Los resultados se publicarán pronto."}
                </p>
              </div>
            </div>

            {raffle.status === "drawn" && drawData?.result && (
              <div className="overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-sm">
                <div className="h-1.5 bg-gradient-to-r from-purple-500 to-indigo-600" />
                <div className="p-5 text-center">
                  <div className="mb-2 text-4xl">🏆</div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-purple-400">Número ganador</p>
                  <p className="mt-1 font-mono text-5xl font-black text-purple-900">
                    #{drawData.result.winning_number.toString().padStart(4, "0")}
                  </p>
                  {drawData.result.has_winner && (
                    <p className="mt-3 text-lg font-bold text-purple-800">{drawData.result.buyer_name}</p>
                  )}
                  {!drawData.result.has_winner && (
                    <p className="mt-3 text-sm text-orange-600">El boleto ganador no fue vendido.</p>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold text-foreground">
                Boletos{" "}
                <span className="text-sm font-normal text-muted-foreground">({tickets.length})</span>
              </h2>
              <div className="ticket-grid">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    title={`#${t.number.toString().padStart(4, "0")} — ${t.status}`}
                    className={`flex min-h-[40px] items-center justify-center rounded-lg text-xs font-mono font-semibold ${TICKET_STYLES[t.status]}`}
                    style={{ cursor: "default" }}
                  >
                    {t.number.toString().padStart(4, "0")}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── STEP: browse ────────────────────────────────────────────────── */}
        {raffle.status === "active" && step === "browse" && (
          <>
            <div className="flex flex-wrap gap-3">
              <Link to={`/rifa/${slug}/buscar`}
                className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted">
                <Search className="h-4 w-4" /> Buscar mi número
              </Link>
              <button onClick={() => setStep("form")}
                className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                Asignar automático
              </button>
              {selectedNumbers.length > 0 && (
                <button onClick={() => setStep("form")}
                  className="ml-auto flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:opacity-90">
                  <ShoppingCart className="h-4 w-4" />
                  Comprar {selectedNumbers.length} boleto{selectedNumbers.length !== 1 ? "s" : ""}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              {[
                { label: "Disponible", cls: "bg-white border border-border" },
                { label: "Seleccionado", cls: "bg-primary border-primary" },
                { label: "Reservado", cls: "bg-amber-50 border border-amber-200 text-amber-700" },
                { label: "Pagado", cls: "bg-green-50 border border-green-200 text-green-700" },
              ].map(({ label, cls }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`h-4 w-4 rounded ${cls}`} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold text-foreground">
                Elige tus boletos{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({raffle.stats?.available ?? "..."} disponibles)
                </span>
              </h2>
              <div className="ticket-grid">
                {tickets.map((t) => {
                  const isSelected = selectedNumbers.includes(t.number);
                  return (
                    <button key={t.id} disabled={t.status !== "available"}
                      onClick={() => t.status === "available" && toggleNumber(t.number)}
                      className={`flex min-h-[40px] items-center justify-center rounded-lg text-xs font-mono font-semibold ${
                        isSelected ? "bg-primary text-primary-foreground border border-primary scale-105 shadow-sm" : TICKET_STYLES[t.status]
                      }`}>
                      {t.number.toString().padStart(4, "0")}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── STEP: form ──────────────────────────────────────────────────── */}
        {step === "form" && (
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            {selectedNumbers.length > 0 && (
              <div className="mb-5 rounded-xl bg-primary/10 px-4 py-3">
                <p className="text-sm font-medium text-primary">
                  Boletos:{" "}
                  {selectedNumbers.sort((a, b) => a - b).map((n) => `#${n.toString().padStart(4, "0")}`).join(", ")}
                </p>
              </div>
            )}

            <h2 className="mb-5 text-lg font-bold text-foreground">Tus datos</h2>
            <form onSubmit={handleSubmit((d) => reserveMutation.mutate(d))} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <input {...register("buyer_name")} type="text" placeholder="Juan Pérez"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                {errors.buyer_name && <p className="mt-1 text-xs text-red-500">{errors.buyer_name.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Celular / WhatsApp <span className="text-red-500">*</span>
                </label>
                <input {...register("buyer_phone")} type="tel" placeholder="+57 300 000 0000"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                {errors.buyer_phone && <p className="mt-1 text-xs text-red-500">{errors.buyer_phone.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Email <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </label>
                <input {...register("buyer_email")} type="email" placeholder="juan@ejemplo.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                {errors.buyer_email && <p className="mt-1 text-xs text-red-500">{errors.buyer_email.message}</p>}
              </div>

              {selectedNumbers.length === 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Cantidad de boletos</label>
                  <input {...register("quantity")} type="number" min={1} max={20}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              )}

              {reserveMutation.isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Error al reservar. Los boletos pueden haberse tomado. Intenta de nuevo.
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setStep("browse")}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted">
                  Volver
                </button>
                <button type="submit" disabled={reserveMutation.isPending}
                  className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
                  {reserveMutation.isPending ? "Reservando..." : "Continuar al pago"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP: payment ───────────────────────────────────────────────── */}
        {step === "payment" && reserved.length > 0 && (
          <div className="space-y-4">
            {/* Reserved tickets summary */}
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-indigo-800">
                Boletos reservados ({reserved.length}):
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {reserved.map((t) => (
                  <span key={t.id} className="rounded-full bg-indigo-100 px-3 py-0.5 font-mono text-sm font-bold text-indigo-700">
                    #{t.number.toString().padStart(4, "0")}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-indigo-600">
                Tienes <strong>{config?.reservationMinutes ?? 15} minutos</strong> para completar el pago antes de que expiren.
              </p>
            </div>

            {/* Payment method selector */}
            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />
              <div className="p-5">
                <h2 className="mb-4 text-lg font-bold text-foreground">¿Cómo quieres pagar?</h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button onClick={() => setPayMethod("transfer")}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-semibold transition-all ${
                      payMethod === "transfer"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-border bg-muted/50 text-foreground hover:border-indigo-200"
                    }`}>
                    <Smartphone className="h-6 w-6" />
                    Nequi / Transferencia
                  </button>
                  <button onClick={() => setPayMethod("cash")}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-semibold transition-all ${
                      payMethod === "cash"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-border bg-muted/50 text-foreground hover:border-green-200"
                    }`}>
                    <Banknote className="h-6 w-6" />
                    Efectivo
                  </button>
                </div>
              </div>
            </div>

            {/* Transfer / Nequi info */}
            {payMethod === "transfer" && (
              <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
                <div className="p-5 space-y-4">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-indigo-500" />
                    Datos de pago
                  </h3>

                  {/* Nequi */}
                  {payConfig?.nequiPhone && (
                    <div className="rounded-xl bg-indigo-50 p-4">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-400">Nequi</p>
                      <p className="text-xl font-black text-indigo-700">{payConfig.nequiPhone}</p>
                    </div>
                  )}

                  {/* Bancolombia */}
                  {(payConfig?.bankName || payConfig?.bankAccount) && (
                    <div className="rounded-xl bg-amber-50 p-4">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-500">
                        <Building2 className="inline h-3 w-3 mr-1" />
                        {payConfig.bankName ?? "Banco"}
                      </p>
                      {payConfig.bankAccountHolder && (
                        <p className="text-sm text-amber-800 font-medium">{payConfig.bankAccountHolder}</p>
                      )}
                      {payConfig.bankAccount && (
                        <p className="text-lg font-black text-amber-700">{payConfig.bankAccount}</p>
                      )}
                    </div>
                  )}

                  {/* QR Image */}
                  {payConfig?.bankQRUrl && (
                    <div className="text-center">
                      <p className="mb-2 text-sm font-medium text-muted-foreground">Escanea el QR de Bancolombia</p>
                      <img src={payConfig.bankQRUrl} alt="QR Bancolombia"
                        className="mx-auto max-w-[180px] rounded-xl border border-border shadow-sm" />
                    </div>
                  )}

                  {/* Total */}
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total a pagar</p>
                    <p className="text-2xl font-black text-indigo-700">
                      {formatCurrency(reserved.length * (raffle.ticket_price ?? 0))}
                    </p>
                  </div>

                  {/* Proof upload */}
                  <div>
                    <p className="mb-2 text-sm font-medium text-foreground">
                      {payConfig?.proofInstructions ?? "Sube tu comprobante de pago"}
                    </p>

                    <input ref={proofInputRef} type="file" accept="image/*"
                      onChange={handleProofUpload} className="hidden" />

                    {proofUrl ? (
                      <div className="relative inline-block">
                        <img src={proofUrl} alt="Comprobante"
                          className="h-32 w-auto rounded-xl border border-border object-cover shadow-sm" />
                        <button onClick={() => { setProofUrl(null); if (proofInputRef.current) proofInputRef.current.value = ""; }}
                          className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600">
                          <X className="h-3 w-3" />
                        </button>
                        <p className="mt-1.5 text-xs text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Comprobante cargado
                        </p>
                      </div>
                    ) : (
                      <button onClick={() => proofInputRef.current?.click()} disabled={uploadingProof}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-6 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                        {uploadingProof ? (
                          <><div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /> Subiendo...</>
                        ) : (
                          <><Upload className="h-5 w-5" /> Subir comprobante (foto o captura)</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Cash info */}
            {payMethod === "cash" && (
              <div className="overflow-hidden rounded-2xl border border-green-200 bg-green-50 shadow-sm">
                <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
                <div className="p-5">
                  <h3 className="mb-2 font-bold text-green-900 flex items-center gap-2">
                    <Banknote className="h-4 w-4" /> Pago en efectivo
                  </h3>
                  <p className="text-sm text-green-800">
                    {payConfig?.cashInstructions ?? "Comunícate con el organizador para coordinar el pago en efectivo."}
                  </p>
                  {config?.whatsappUrl && (
                    <a href={`${config.whatsappUrl}?text=${encodeURIComponent(
                      `Hola! Reservé ${reserved.map((t) => `#${t.number}`).join(", ")} en la rifa "${raffle.title}". Quiero pagar en efectivo.`
                    )}`} target="_blank" rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
                      <MessageCircle className="h-4 w-4" /> Coordinar por WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Submit / error */}
            {submitPayment.isError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Error al enviar el pago. Intenta de nuevo.
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep("form")}
                className="flex-1 rounded-xl border border-border bg-white py-3 text-sm font-medium text-foreground hover:bg-muted">
                Volver
              </button>
              <button
                onClick={() => submitPayment.mutate()}
                disabled={
                  submitPayment.isPending ||
                  (payMethod === "transfer" && !proofUrl)
                }
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitPayment.isPending
                  ? "Enviando..."
                  : payMethod === "cash"
                  ? "Registrar reserva"
                  : "Enviar comprobante"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: confirmed ─────────────────────────────────────────────── */}
        {step === "confirmed" && (
          <div className="overflow-hidden rounded-2xl border border-green-200 bg-green-50 shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-green-400 to-emerald-500" />
            <div className="p-6 text-center">
              <div className="mb-3 text-5xl">🎉</div>
              <h2 className="mb-2 text-xl font-black text-green-900">
                {payMethod === "cash" ? "¡Reserva registrada!" : "¡Comprobante enviado!"}
              </h2>
              <p className="mb-5 text-sm text-green-700">
                {payMethod === "cash"
                  ? "El admin confirmará tu pago al recibirlo en efectivo."
                  : "El administrador revisará tu comprobante y confirmará el pago pronto."}
              </p>

              <div className="mb-5 flex flex-wrap justify-center gap-2">
                {reserved.map((t) => (
                  <span key={t.id}
                    className="rounded-full bg-green-100 px-3 py-1 font-mono text-sm font-bold text-green-800">
                    #{t.number.toString().padStart(4, "0")}
                  </span>
                ))}
              </div>

              {config?.whatsappUrl && (
                <a href={`${config.whatsappUrl}?text=${encodeURIComponent(
                  `Hola! Ya envié el comprobante de pago para los boletos ${reserved.map((t) => `#${t.number}`).join(", ")} de la rifa "${raffle.title}".`
                )}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 font-semibold text-white shadow hover:bg-green-700">
                  <MessageCircle className="h-5 w-5" /> Notificar por WhatsApp
                </a>
              )}

              <div className="mt-4">
                <button onClick={() => { setStep("browse"); setSelectedNumbers([]); setReserved([]); setProofUrl(null); }}
                  className="text-sm text-green-700 hover:underline flex items-center gap-1.5 mx-auto">
                  <ImageIcon className="h-4 w-4" /> Ver más boletos
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
