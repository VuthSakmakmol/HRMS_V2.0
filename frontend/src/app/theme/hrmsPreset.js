import { definePreset } from "@primeuix/themes"
import Aura from "@primeuix/themes/aura"
import { HRMS_BRAND } from "./brand.js"

export const hrmsPreset = definePreset(Aura, {
    semantic: {
        primary: HRMS_BRAND.primary,
    },
})