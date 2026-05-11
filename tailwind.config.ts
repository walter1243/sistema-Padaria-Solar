import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        trigo: "#f9e8c8",
        cafe: "#2f1d14",
        tomate: "#d84727",
        mostarda: "#f0b229",
        oliva: "#6b7e2e"
      },
      boxShadow: {
        card: "0 10px 30px rgba(47, 29, 20, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
