import { useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ChevronDown, ImageIcon, Upload, X } from "lucide-react";

const schema = z.object({
  title: z.string().min(3, "Mínimo 3 caracteres"),
  description: z.string().optional(),
  prize_description: z.string().min(5, "Describe el premio"),
  ticket_price: z.coerce.number().positive("Precio inválido"),
  total_tickets: z.coerce.number().int().min(1).max(100_000),
  draw_date: z.string().min(1, "Selecciona la fecha"),
  numbering_type: z.enum(["auto", "manual"]),
  lottery_slug: z.string().optional(),
  lottery_digits: z.coerce.number().int().min(2).max(3).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function RaffleForm({ onSuccess, onCancel }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [useLottery, setUseLottery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { numbering_type: "auto", lottery_digits: 3 },
  });

  const [priceDisplay, setPriceDisplay] = useState("");

  const { data: lotteries = [] } = useQuery<{ name: string; slug: string }[]>({
    queryKey: ["lotteries"],
    queryFn: () => api.get("/lotteries").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!useLottery) {
      setValue("lottery_slug", undefined);
      setValue("lottery_digits", undefined);
    } else {
      setValue("lottery_digits", 3);
    }
  }, [useLottery, setValue]);

  function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const num = parseInt(digits || "0", 10);
    setPriceDisplay(digits ? num.toLocaleString("es-CO") : "");
    setValue("ticket_price", num, { shouldValidate: true });
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/uploads/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImageUrl(res.data.url);
    } catch {
      alert("Error al subir la imagen.");
    } finally {
      setUploading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post("/raffles", {
        ...data,
        prize_images: imageUrl ? [imageUrl] : [],
      }),
    onSuccess,
  });

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "block text-sm font-medium text-foreground mb-1.5";
  const errorClass = "text-red-500 text-xs mt-1";

  return (
    <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Title */}
        <div className="sm:col-span-2">
          <label className={labelClass}>Nombre de la rifa <span className="text-red-500">*</span></label>
          <input {...register("title")} className={inputClass} placeholder="Gran Rifa Navideña" />
          {errors.title && <p className={errorClass}>{errors.title.message}</p>}
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className={labelClass}>Descripción</label>
          <textarea {...register("description")} rows={2} className={inputClass} placeholder="Descripción opcional..." />
        </div>

        {/* Prize description */}
        <div className="sm:col-span-2">
          <label className={labelClass}>Premio <span className="text-red-500">*</span></label>
          <textarea {...register("prize_description")} rows={2} className={inputClass} placeholder="Describe el premio en detalle" />
          {errors.prize_description && <p className={errorClass}>{errors.prize_description.message}</p>}
        </div>

        {/* Prize image */}
        <div className="sm:col-span-2">
          <label className={labelClass}>
            <ImageIcon className="inline h-4 w-4 mr-1 text-muted-foreground" />
            Imagen del premio
          </label>

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

          {imageUrl ? (
            <div className="flex items-start gap-3">
              <img src={imageUrl} alt="Premio"
                className="h-24 w-32 rounded-xl border border-border object-cover shadow-sm" />
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => { setImageUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100">
                  <X className="h-3.5 w-3.5" /> Quitar imagen
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" /> Cambiar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50 transition-colors">
              {uploading ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Subiendo...</>
              ) : (
                <><Upload className="h-5 w-5" /> Subir imagen del premio</>
              )}
            </button>
          )}
        </div>

        {/* Price */}
        <div>
          <label className={labelClass}>Precio del boleto <span className="text-red-500">*</span></label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-border bg-muted px-3 text-sm font-medium text-muted-foreground">
              $
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={priceDisplay}
              onChange={handlePriceChange}
              placeholder="10.000"
              className={`${inputClass} rounded-l-none`}
            />
          </div>
          {errors.ticket_price && <p className={errorClass}>{errors.ticket_price.message}</p>}
        </div>

        {/* Total tickets */}
        <div>
          <label className={labelClass}>Total de boletos <span className="text-red-500">*</span></label>
          <input {...register("total_tickets")} type="number" className={inputClass} placeholder="100" />
          {errors.total_tickets && <p className={errorClass}>{errors.total_tickets.message}</p>}
        </div>

        {/* Draw date */}
        <div>
          <label className={labelClass}>Fecha del sorteo <span className="text-red-500">*</span></label>
          <input {...register("draw_date")} type="datetime-local" className={inputClass} />
          {errors.draw_date && <p className={errorClass}>{errors.draw_date.message}</p>}
        </div>

        {/* Numbering type */}
        <div>
          <label className={labelClass}>Numeración</label>
          <div className="relative">
            <select
              {...register("numbering_type")}
              className={`${inputClass} appearance-none cursor-pointer pr-9`}
            >
              <option value="auto">Automática (1, 2, 3...)</option>
              <option value="manual">Manual</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {/* Lottery toggle */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between rounded-xl border border-border bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Sorteo por lotería</p>
              <p className="text-xs text-muted-foreground">El ganador se determina por el resultado de una lotería oficial</p>
            </div>
            <button
              type="button"
              onClick={() => setUseLottery((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                useLottery ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                  useLottery ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {useLottery && (
          <>
            <div className="sm:col-span-2">
              <label className={labelClass}>Lotería <span className="text-red-500">*</span></label>
              <div className="relative">
                <select
                  {...register("lottery_slug")}
                  className={`${inputClass} appearance-none cursor-pointer pr-9`}
                >
                  <option value="">Selecciona una lotería...</option>
                  {lotteries.map((l) => (
                    <option key={l.slug} value={l.slug}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Dígitos a usar</label>
              <div className="relative">
                <select
                  {...register("lottery_digits")}
                  className={`${inputClass} appearance-none cursor-pointer pr-9`}
                >
                  <option value={3}>Últimos 3 dígitos (000–999)</option>
                  <option value={2}>Últimos 2 dígitos (00–99)</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                El boleto ganador será el que coincida con los últimos N dígitos del resultado
              </p>
            </div>
          </>
        )}
      </div>

      {createMutation.isError && (
        <p className="text-center text-sm text-red-500">Error al crear la rifa. Intenta de nuevo.</p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
          Cancelar
        </button>
        <button type="submit" disabled={uploading || createMutation.isPending}
          className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {createMutation.isPending ? "Creando..." : "Crear rifa"}
        </button>
      </div>
    </form>
  );
}
