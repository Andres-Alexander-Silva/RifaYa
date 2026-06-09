import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useTenantStore } from "@/store/tenantStore";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
type FormData = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  const config = useTenantStore((s) => s.config);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const loginMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: tokens } = await api.post("/auth/login", data);
      return tokens;
    },
    onSuccess: async (tokens) => {
      setTokens(tokens.access_token, tokens.refresh_token);
      const { data: user } = await api.get("/users/me");
      setUser(user);
      navigate("/admin");
    },
    onError: () => {
      setError("password", { message: "Email o contraseña incorrectos" });
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          {config?.logoUrl && (
            <img
              src={config.logoUrl}
              alt={config.name}
              className="mx-auto mb-4 h-16 drop-shadow"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <h1 className="text-3xl font-black text-foreground">
            {config?.name ?? "RifaYa"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Panel de administración</p>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
          {/* Gradient top accent */}
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />

          <div className="p-8">
            <h2 className="mb-6 text-lg font-bold text-foreground">Iniciar sesión</h2>

            <form
              onSubmit={handleSubmit((d) => loginMutation.mutate(d))}
              className="space-y-4"
            >
              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Email
                </label>
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

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-end">
                <Link
                  to="/forgot-password"
                  className="text-xs text-indigo-600 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || loginMutation.isPending}
                className="mt-2 w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loginMutation.isPending ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Problemas para ingresar? Contacta al administrador del sistema.
        </p>
      </div>
    </div>
  );
}
