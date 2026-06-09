import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useTenantStore } from "@/store/tenantStore";

const schema = z
  .object({
    new_password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  });
type FormData = z.infer<typeof schema>;

export default function ResetPassword() {
  const config = useTenantStore((s) => s.config);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post("/auth/reset-password", { token, new_password: data.new_password }),
    onSuccess: () => {
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    },
    onError: (err: any) => {
      setError("new_password", {
        message: err.response?.data?.detail ?? "El enlace es inválido o ya expiró",
      });
    },
  });

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-red-200 bg-white p-8 shadow-xl text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="text-lg font-bold text-foreground">Enlace inválido</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Este enlace de recuperación no es válido. Solicita uno nuevo.
          </p>
          <Link
            to="/forgot-password"
            className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline"
          >
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

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
            {done ? (
              <div className="text-center">
                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
                <h2 className="text-lg font-bold text-foreground">¡Contraseña actualizada!</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Redirigiendo al inicio de sesión...
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-foreground">Nueva contraseña</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Elige una contraseña segura de al menos 8 caracteres.
                  </p>
                </div>

                <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Nueva contraseña
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        {...register("new_password")}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.new_password && (
                      <p className="mt-1 text-xs text-red-500">{errors.new_password.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Confirmar contraseña
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        {...register("confirm_password")}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    {errors.confirm_password && (
                      <p className="mt-1 text-xs text-red-500">{errors.confirm_password.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="mt-2 w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {mutation.isPending ? "Guardando..." : "Restablecer contraseña"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
