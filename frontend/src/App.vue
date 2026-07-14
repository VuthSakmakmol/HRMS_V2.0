<script setup>
import { watch } from "vue"
import { usePrimeVue } from "primevue/config"
import Toast from "primevue/toast"

import { primevueLocales } from "@/app/i18n/primevueLocale.js"
import { useUiStore } from "@/app/stores/ui.store.js"

const uiStore = useUiStore()
const primevue = usePrimeVue()

watch(
    () => uiStore.locale,
    (locale) => {
        primevue.config.locale =
            primevueLocales[locale] || primevueLocales["en-US"]
    },
    { immediate: true },
)
</script>

<template>
    <Toast position="top-right" />
    <RouterView />
</template>