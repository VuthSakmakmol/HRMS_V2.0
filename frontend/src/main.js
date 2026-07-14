import { createApp } from "vue"
import { createPinia } from "pinia"
import PrimeVue from "primevue/config"
import ToastService from "primevue/toastservice"
import ConfirmationService from "primevue/confirmationservice"
import Tooltip from "primevue/tooltip"

import App from "./App.vue"
import router from "./app/router"
import { i18n } from "./app/i18n"
import { primevueLocales } from "./app/i18n/primevueLocale.js"
import { useUiStore } from "./app/stores/ui.store.js"
import { hrmsPreset } from "./app/theme/hrmsPreset.js"

import "primeicons/primeicons.css"
import "./styles/tokens.css"
import "./styles/base.css"
import "./styles/components.css"
import "./styles/enterprise-list.css"
import "./styles/enterprise-framework.css"

const app = createApp(App)
const pinia = createPinia()

const uiStore = useUiStore(pinia)
uiStore.applyPreferences()

app.use(pinia)
app.use(i18n)
app.use(router)

app.use(PrimeVue, {
    ripple: true,
    inputVariant: "filled",
    locale: primevueLocales[uiStore.locale],
    theme: {
        preset: hrmsPreset,
        options: {
            darkModeSelector: ".app-dark",
        },
    },
    zIndex: {
        modal: 1200,
        overlay: 1100,
        menu: 1000,
        tooltip: 1300,
    },
})

app.use(ToastService)
app.use(ConfirmationService)
app.directive("tooltip", Tooltip)

app.mount("#app")
