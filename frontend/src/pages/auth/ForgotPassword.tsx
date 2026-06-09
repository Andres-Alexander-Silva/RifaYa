import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useTenantStore } from "@/store/tenantStore";

const schema = z.object({
  email: z.string().email("Ingresa un email válido"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPassword() {
  const config = useTenantStore((s) => s.config);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post("/auth/forgot-password", data),
    onSuccess: () => setSent(true),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {config?.logoUrl && (
            <img
              src={config.logoUrl}
              alt={config.name}
              className="mx-auto mb-4 h-16 drop-shadow"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <h1 className="text-3xl font-black text-foreground">{config?.name ?? "RifaYa"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Panel de administración</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />
          <div className="p-8">
            {sent ? (
              <div className="text-center">
                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
                <h2 className="text-lg font-bold text-foreground">Revisa tu correo</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Si el email está registrado, recibirás un enlace para restablecer tu contraseña. Expira en 15 minutos.
                </p>
                <Link
                  to="/login"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" /> Volver al inicio de sesión
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-foreground">Recuperar contraseña</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
                  </p>
                </div>

                <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        {...register("email")}
                        type="email"
                        autoComplete="email"
                        placeholder="admin@ejemplo.com"
                        className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="mt-2 w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {mutation.isPending ? "Enviando..." : "Enviar enlace de recuperación"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" /> Volver al inicio de sesión
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
