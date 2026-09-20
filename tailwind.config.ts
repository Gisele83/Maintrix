import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      /**
       * Système typographique — une seule famille, trois voix :
       *   • IBM Plex Serif pour les titres : la voix éditoriale ;
       *   • IBM Plex Sans pour le texte et l'interface ;
       *   • IBM Plex Mono pour les repères techniques (numéros, libellés).
       * Polices auto-hébergées (@fontsource) : la CSP n'autorise aucune feuille
       * de style externe, Google Fonts serait bloqué.
       */
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
        serif: ['"IBM Plex Serif"', "Georgia", '"Times New Roman"', "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      /** Échelle de hiérarchie : display > headline > title > lede > corps > eyebrow. */
      fontSize: {
        display: ["clamp(2.5rem, 1.6rem + 3.6vw, 4.5rem)", { lineHeight: "1.04", letterSpacing: "-0.022em" }],
        headline: ["clamp(1.75rem, 1.35rem + 1.6vw, 2.5rem)", { lineHeight: "1.12", letterSpacing: "-0.015em" }],
        // Titre d'écran applicatif : ~12 % sous `headline`, qui est calibré
        // pour l'accueil public. Dans un outil dense, un titre trop grand
        // repousse le contenu utile sous la ligne de flottaison.
        page: ["clamp(1.5rem, 1.2rem + 1.2vw, 2.1875rem)", { lineHeight: "1.15", letterSpacing: "-0.012em" }],
        title: ["1.25rem", { lineHeight: "1.35", letterSpacing: "-0.01em" }],
        lede: ["1.1875rem", { lineHeight: "1.6" }],
        eyebrow: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        /**
         * Palette des pages publiques, tirée du LOGO : bleu nuit #011535 et
         * cyan #00B9F2 (couleurs dominantes relevées dans logo.png).
         *
         * ⚠️ Le cyan du logo ne peut pas porter de texte blanc : 2,3:1, très en
         * dessous du seuil AA. Il est donc réservé aux accents sur fond sombre
         * (`signal-light`, 8:1 sur l'encre) et aux éléments graphiques. Sur
         * fond clair, l'accent textuel est un cyan assombri de même teinte
         * (`signal`, 4,8:1 ; texte blanc dessus : 4,8:1).
         *
         * Les tons neutres passent au froid : le papier chaud d'origine jurait
         * avec le bleu nuit et le cyan.
         */
        paper: { DEFAULT: "#F4F7FA", deep: "#E6EDF3" },
        ink: { DEFAULT: "#011535", soft: "#3A4A60", mute: "#56657A" },
        rule: "#D3DCE5",
        signal: { DEFAULT: "#0077A8", light: "#00B9F2", deep: "#005A80" },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
