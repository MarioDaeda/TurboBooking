import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        tw: {
          blue: "#3584F6",
          "blue-hover": "#256FD6",
          "blue-light": "#EFF6FF",
          "blue-pill": "#DCEBFE",
          "blue-card": "#2D7CF3",
          rail: "#636B83",
          "rail-dark": "#50576D",
          canvas: "#F4F6F8",
          card: "#FFFFFF",
          border: "#ECEEF1",
          "border-subtle": "#E2E8F0",
          "text-main": "#1F2430",
          "text-muted": "#8A94A6",
          appointment: "#8DA4B4",
          hatch: "#E2E8F0",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
