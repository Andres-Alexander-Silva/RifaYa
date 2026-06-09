export type UserRole = "admin" | "seller" | "buyer";
export type RaffleStatus = "draft" | "active" | "closed" | "drawn";
export type TicketStatus = "available" | "reserved" | "paid" | "cancelled";
export type PaymentMethod = "wompi" | "mercadopago" | "cash" | "transfer";
export type PaymentStatus = "pending" | "confirmed" | "failed" | "refunded";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface RaffleStats {
  total: number;
  available: number;
  reserved: number;
  paid: number;
  revenue: number;
  target: number;
  progress_pct: number;
}

export interface Raffle {
  id: string;
  title: string;
  slug: string;
  description?: string;
  prize_description: string;
  prize_images: string[];
  ticket_price: number;
  total_tickets: number;
  draw_date: string;
  status: RaffleStatus;
  is_visible: boolean;
  numbering_type: "auto" | "manual";
  lottery_slug?: string;
  lottery_digits?: number;
  created_by_id: string;
  winner_ticket_id?: string;
  created_at: string;
  updated_at: string;
  stats?: RaffleStats;
}

export interface Ticket {
  id: string;
  raffle_id: string;
  number: number;
  status: TicketStatus;
  buyer_name?: string;
  buyer_phone?: string;
  buyer_email?: string;
  reserved_at?: string;
  reservation_expires_at?: string;
  paid_at?: string;
  payment_id?: string;
}

export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  gateway_reference?: string;
  notes?: string;
  receipt_url?: string;
  confirmed_by_id?: string;
  confirmed_by_name?: string;
  confirmed_at?: string;
  created_at: string;
  ticket_ids: string[];
}

export interface TenantPaymentConfig {
  nequiPhone?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountHolder?: string;
  bankQRUrl?: string;
  cashInstructions?: string;
  proofInstructions?: string;
}

export interface DrawResult {
  winning_number: number;
  winning_ticket_id: string;
  buyer_name: string;
  buyer_phone?: string;
  buyer_email?: string;
  has_winner: boolean;
}

export interface Draw {
  id: string;
  raffle_id: string;
  winning_ticket_id: string;
  drawn_at: string;
  conducted_by_id: string;
  conducted_by_name?: string;
  certificate_url?: string;
  algorithm: string;
  result?: DrawResult;
}

export interface TenantConfig {
  name: string;
  tagline: string;
  slug: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  primaryForeground: string;
  secondaryColor: string;
  secondaryForeground: string;
  backgroundColor: string;
  foregroundColor: string;
  mutedColor: string;
  mutedForegroundColor: string;
  borderColor: string;
  ringColor: string;
  borderRadius: string;
  supportPhone: string;
  supportEmail: string;
  whatsappUrl: string;
  socialLinks?: { instagram?: string; facebook?: string; tiktok?: string };
  currency: string;
  currencySymbol: string;
  locale: string;
  timezone: string;
  reservationMinutes: number;
  paymentMethods: PaymentMethod[];
  payment?: TenantPaymentConfig;
  features: {
    publicLanding: boolean;
    whatsappNotifications: boolean;
    emailNotifications: boolean;
    drawAnimation: boolean;
  };
}
