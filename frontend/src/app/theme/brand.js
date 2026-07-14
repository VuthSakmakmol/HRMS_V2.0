export const HRMS_BRAND = Object.freeze({
    fontFamily: '"Inter", "Noto Sans Khmer", "Segoe UI", Arial, sans-serif',

    primary: Object.freeze({
        50: "#eff6ff",
        100: "#dbeafe",
        200: "#bfdbfe",
        300: "#93c5fd",
        400: "#60a5fa",
        500: "#3b82f6",
        600: "#2563eb",
        700: "#1d4ed8",
        800: "#1e40af",
        900: "#1e3a8a",
        950: "#172554",
    }),

    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",

    surface: Object.freeze({
        light: Object.freeze({
            app: "#f4f7fb",
            surface: "#ffffff",
            surfaceMuted: "#f8fafc",
            border: "#e2e8f0",
            text: "#172033",
            textMuted: "#64748b",
            sidebar: "#111827",
            sidebarText: "#e5edf8",
        }),

        dark: Object.freeze({
            app: "#0b1220",
            surface: "#111c2e",
            surfaceMuted: "#172338",
            border: "#29364a",
            text: "#e7edf7",
            textMuted: "#9caec6",
            sidebar: "#070d18",
            sidebarText: "#e5edf8",
        }),
    }),
})

export function applyBrandTokens(colorMode = "light") {
    const mode = colorMode === "dark" ? "dark" : "light"
    const surface = HRMS_BRAND.surface[mode]
    const root = document.documentElement

    const tokens = {
        "--hrms-font-family": HRMS_BRAND.fontFamily,

        "--hrms-primary": HRMS_BRAND.primary[600],
        "--hrms-primary-hover": HRMS_BRAND.primary[700],
        "--hrms-primary-soft": HRMS_BRAND.primary[50],

        "--hrms-success": HRMS_BRAND.success,
        "--hrms-warning": HRMS_BRAND.warning,
        "--hrms-danger": HRMS_BRAND.danger,

        "--hrms-app-background": surface.app,
        "--hrms-surface": surface.surface,
        "--hrms-surface-muted": surface.surfaceMuted,
        "--hrms-border": surface.border,
        "--hrms-text": surface.text,
        "--hrms-text-muted": surface.textMuted,
        "--hrms-sidebar": surface.sidebar,
        "--hrms-sidebar-text": surface.sidebarText,
    }

    for (const [name, value] of Object.entries(tokens)) {
        root.style.setProperty(name, value)
    }

    root.style.colorScheme = mode
}