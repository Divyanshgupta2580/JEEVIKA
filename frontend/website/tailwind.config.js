/** @type {import('tailwindcss').Config} */
export default {
    content: { relative: true, files: ["./index.html", "./erp.html", "./src/**/*.{js,ts,jsx,tsx}"] },
    theme: {
        extend: {
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'sans-serif'],
            },
            colors: {
                canvas: "var(--ds-surface-canvas)",
                surface: "var(--ds-surface)",
                "surface-subtle": "var(--ds-surface-subtle)",
                emergency: {
                    DEFAULT: "var(--ds-emergency)",
                    soft: "var(--ds-emergency-soft)",
                },
                critical: {
                    DEFAULT: "var(--ds-critical)",
                    soft: "var(--ds-critical-soft)",
                },
                warning: {
                    DEFAULT: "var(--ds-warning)",
                    soft: "var(--ds-warning-soft)",
                },
                success: {
                    DEFAULT: "var(--ds-success)",
                    soft: "var(--ds-success-soft)",
                },
                info: {
                    DEFAULT: "var(--ds-info)",
                    soft: "var(--ds-info-soft)",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                sidebar: {
                    DEFAULT: "var(--sidebar-bg)",
                },
                artemis: { navy: "#0f172a", blue: "#3b82f6" }
            }
        }
    },
    plugins: [],
};
