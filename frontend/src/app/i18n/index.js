import { createI18n } from "vue-i18n"

import enUS from "./en-US.js"
import kmKH from "./km-KH.js"

export const i18n = createI18n({
    legacy: false,
    locale: "en-US",
    fallbackLocale: "en-US",
    messages: {
        "en-US": enUS,
        "km-KH": kmKH,
    },
})