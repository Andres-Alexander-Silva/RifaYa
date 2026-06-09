import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
          50: "color-mix(in srgb, var(--color-primary) 10%, white)",
          100: "color-mix(in srgb, var(--color-primary) 20%, white)",
          200: "color-mix(in srgb, var(--color-primary) 35%, white)",
          500: "var(--color-primary)",
          600: "color-mix(in srgb, var(--color-primary) 90%, black)",
          700: "color-mix(in srgb, var(--color-primary) 75%, black)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-foreground)",
        },
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        border: "var(--color-border)",
        ring: "var(--color-ring)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
