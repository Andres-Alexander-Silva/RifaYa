import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Payment, Raffle } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Ticket, DollarSign, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
}

export default function Dashboard() {
  const { data: raffles = [] } = useQuery<Raffle[]>({
    queryKey: ["raffles"],
    queryFn: () => api.get("/raffles").then((r) => r.data),
  });

  const { data: pendingPayments = [] } = useQuery<Payment[]>({
    queryKey: ["payments", "pending"],
    queryFn: () => api.get("/payments?status=pending&limit=5").then((r) => r.data),
    refetchInterval: 30_000,
  });

  const totals = raffles.reduce(
    (acc, r) => {
      if (r.stats) {
        acc.revenue += r.stats.revenue;
        acc.paid += r.stats.paid;
        acc.reserved += r.stats.reserved;
        acc.available += r.stats.available;
      }
      return acc;
    },
    { revenue: 0, paid: 0, reserved: 0, available: 0 }
  );

  const chartData = raffles.slice(0, 8).map((r) => ({
    name: r.title.length > 14 ? r.title.slice(0, 14) + "…" : r.title,
    vendidos: r.stats?.paid ?? 0,
    meta: r.total_tickets,
  }));

  const stats: StatCard[] = [
    {
      label: "Ingresos totales",
      value: formatCurrency(totals.revenue),
      icon: DollarSign,
      gradient: "from-emerald-500 to-teal-600",
      iconBg: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Boletos vendidos",
      value: totals.paid,
      icon: CheckCircle,
      gradient: "from-blue-500 to-indigo-600",
      iconBg: "bg-blue-100 text-blue-700",
    },
    {
      label: "Boletos reservados",
      value: totals.reserved,
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-100 text-amber-700",
    },
    {
      label: "Rifas activas",
      value: raffles.filter((r) => r.status === "active").length,
      icon: Ticket,
      gradient: "from-violet-500 to-purple-600",
      iconBg: "bg-violet-100 text-violet-700",
    },
    {
      label: "Pagos pendientes",
      value: pendingPayments.length,
      icon: AlertCircle,
      gradient: pendingPayments.length > 0 ? "from-amber-400 to-orange-500" : "from-slate-300 to-slate-400",
      iconBg: pendingPayments.length > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Resumen general de tus rifas
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-2xl bg-white border border-border shadow-sm"
          >
            {/* Top gradient bar */}
            <div className={`h-1 bg-gradient-to-r ${s.gradient}`} />
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                <div className={`rounded-xl p-2 ${s.iconBg}`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-bold text-foreground">
            Boletos vendidos por rifa
          </h2>
          <p className="mb-5 text-xs text-muted-foreground">
            Últimas {chartData.length} rifas
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barGap={4}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "0.75rem",
                  border: "1px solid var(--color-border)",
                  fontSize: 12,
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
              />
              <Bar
                dataKey="vendidos"
                name="Vendidos"
                fill="var(--color-primary)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pending payments alert */}
      {pendingPayments.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <div className="flex items-center justify-between border-b border-amber-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <h2 className="font-bold text-amber-900">
                Pagos por confirmar
                <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {pendingPayments.length}
                </span>
              </h2>
            </div>
            <Link
              to="/admin/pagos"
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    {formatCurrency(Number(p.amount))}
                    <span className="ml-2 text-xs font-normal text-amber-700">
                      · {p.ticket_ids.length} boleto{p.ticket_ids.length !== 1 ? "s" : ""}
                    </span>
                  </p>
                </div>
                <Link
                  to="/admin/pagos"
                  className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                >
                  Confirmar
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent raffles list */}
      {raffles.length > 0 && (
        <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-foreground">Rifas recientes</h2>
          </div>
          <div className="divide-y divide-border">
            {raffles.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.stats ? `${r.stats.paid} / ${r.total_tickets} boletos vendidos` : "Sin datos"}
                  </p>
                </div>
                {r.stats && (
                  <div className="w-24 shrink-0">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(r.stats.progress_pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-right text-xs text-muted-foreground mt-1">
                      {r.stats.progress_pct.toFixed(0)}%
                    </p>
                  </div>
                )}
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    r.status === "active"
                      ? "bg-green-100 text-green-700"
                      : r.status === "draft"
                      ? "bg-slate-100 text-slate-600"
                      : r.status === "drawn"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {r.status === "active"
                    ? "Activa"
                    : r.status === "draft"
                    ? "Borrador"
                    : r.status === "drawn"
                    ? "Sorteada"
                    : "Cerrada"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
