import type { TenantConfig } from "@/types";

let _config: TenantConfig | null = null;

export async function loadTenantConfig(): Promise<TenantConfig> {
  if (_config) return _config;
  const res = await fetch("/tenant.config.json");
  const data: TenantConfig = await res.json();
  _config = data;
  applyTheme(data);
  applyMeta(data);
  return data;
}

export function getTenantConfig(): TenantConfig {
  if (!_config) throw new Error("Tenant config not loaded");
  return _config;
}

function applyTheme(config: TenantConfig) {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", config.primaryColor);
  root.style.setProperty("--color-primary-foreground", config.primaryForeground);
  root.style.setProperty("--color-secondary", config.secondaryColor);
  root.style.setProperty("--color-secondary-foreground", config.secondaryForeground);
  root.style.setProperty("--color-background", config.backgroundColor);
  root.style.setProperty("--color-foreground", config.foregroundColor);
  root.style.setProperty("--color-muted", config.mutedColor);
  root.style.setProperty("--color-muted-foreground", config.mutedForegroundColor);
  root.style.setProperty("--color-border", config.borderColor);
  root.style.setProperty("--color-ring", config.ringColor);
  root.style.setProperty("--radius", config.borderRadius);
}

function applyMeta(config: TenantConfig) {
  document.title = config.name;
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = config.faviconUrl;
}
