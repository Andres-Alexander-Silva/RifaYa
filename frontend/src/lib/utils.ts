import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getTenantConfig } from "@/config/tenant";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  const config = getTenantConfig();
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const config = getTenantConfig();
  return new Intl.DateTimeFormat(config.locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: config.timezone,
  }).format(new Date(dateStr));
}

export function ticketStatusLabel(status: string): string {
  const map: Record<string, string> = {
    available: "Disponible",
    reserved: "Reservado",
    paid: "Pagado",
    cancelled: "Cancelado",
  };
  return map[status] ?? status;
}

export function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    wompi: "Wompi",
    mercadopago: "MercadoPago",
    cash: "Efectivo",
    transfer: "Transferencia",
  };
  return map[method] ?? method;
}
