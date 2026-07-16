import { defineStore } from "pinia"

import { i18n } from "@/app/i18n"
import { applyBrandTokens } from "@/app/theme/brand.js"

const STORAGE_KEY = "hrms-ui-preferences"

function getInitialPreferences() {
    try {
        const savedPreferences = JSON.parse(localStorage.getItem(STORAGE_KEY))

        if (savedPreferences?.colorMode) {
            return {
                locale: "en-US",
                colorMode: savedPreferences.colorMode,
            }
        }
    } catch {
        // Ignore invalid local storage data.
    }

    return {
        locale: "en-US",
        colorMode: window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light",
    }
}

export const useUiStore = defineStore("ui", {
    state: () => ({
        ...getInitialPreferences(),
    }),

    actions: {
        applyPreferences() {
            document.documentElement.lang = this.locale

            document.documentElement.classList.toggle(
                "app-dark",
                this.colorMode === "dark",
            )

            i18n.global.locale.value = this.locale

            applyBrandTokens(this.colorMode)

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    locale: this.locale,
                    colorMode: this.colorMode,
                }),
            )
        },

        toggleColorMode() {
            this.colorMode = this.colorMode === "dark" ? "light" : "dark"
            this.applyPreferences()
        },
    },
})