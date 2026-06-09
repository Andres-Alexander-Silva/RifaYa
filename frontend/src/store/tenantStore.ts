import { create } from "zustand";
import type { TenantConfig } from "@/types";

interface TenantState {
  config: TenantConfig | null;
  setConfig: (config: TenantConfig) => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  config: null,
  setConfig: (config) => set({ config }),
}));
