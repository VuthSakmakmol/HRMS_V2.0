<script setup>
import { ref } from "vue"
import { useI18n } from "vue-i18n"
import { useRoute, useRouter } from "vue-router"

import Button from "primevue/button"
import InputText from "primevue/inputtext"
import Message from "primevue/message"
import Password from "primevue/password"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const uiStore = useUiStore()

const loginId = ref("")
const password = ref("")
const isSubmitting = ref(false)
const errorMessage = ref("")

function getErrorMessage(error) {
    const messageKey = error.response?.data?.error?.messageKey

    if (messageKey) {
        return t(messageKey)
    }

    return t("errors.internal")
}

async function submitLogin() {
    if (isSubmitting.value) {
        return
    }

    errorMessage.value = ""
    isSubmitting.value = true

    try {
        await authStore.login({
            loginId: loginId.value,
            password: password.value,
        })

        const redirect =
            typeof route.query.redirect === "string" &&
            route.query.redirect.startsWith("/")
                ? route.query.redirect
                : "/"

        await router.replace(redirect)
    } catch (error) {
        errorMessage.value = getErrorMessage(error)
    } finally {
        isSubmitting.value = false
    }
}
</script>

<template>
    <main class="login-page">
        <header class="login-page__topbar">
            <div class="login-page__brand">
                <div class="login-page__brand-icon">
                    <i class="pi pi-building" />
                </div>

                <div>
                    <strong>{{ t("app.name") }}</strong>
                    <span>{{ t("app.subtitle") }}</span>
                </div>
            </div>

            <div class="login-page__actions">

                <Button
                    text
                    rounded
                    :icon="
                        uiStore.colorMode === 'dark'
                            ? 'pi pi-sun'
                            : 'pi pi-moon'
                    "
                    :aria-label="
                        uiStore.colorMode === 'dark'
                            ? t('common.lightMode')
                            : t('common.darkMode')
                    "
                    @click="uiStore.toggleColorMode()"
                />
            </div>
        </header>

        <section class="login-page__content">
            <div class="login-introduction">
                <span>{{ t("auth.systemAccess") }}</span>
                <h1>{{ t("auth.welcomeTitle") }}</h1>
                <p>{{ t("auth.welcomeDescription") }}</p>

                <div class="login-introduction__points">
                    <div>
                        <i class="pi pi-shield" />
                        <span>{{ t("auth.securityPoint") }}</span>
                    </div>

                    <div>
                        <i class="pi pi-sitemap" />
                        <span>{{ t("auth.permissionPoint") }}</span>
                    </div>

                    <div>
                        <i class="pi pi-palette" />
                        <span>{{ t("auth.globalDesignPoint") }}</span>
                    </div>
                </div>
            </div>

            <form class="login-card" @submit.prevent="submitLogin">
                <div class="login-card__heading">
                    <h2>{{ t("auth.signIn") }}</h2>
                    <p>{{ t("auth.signInDescription") }}</p>
                </div>

                <Message
                    v-if="errorMessage"
                    severity="error"
                    :closable="false"
                >
                    {{ errorMessage }}
                </Message>

                <label class="login-field">
                    <span>{{ t("auth.loginId") }}</span>

                    <InputText
                        v-model="loginId"
                        autocomplete="username"
                        :placeholder="t('auth.loginIdPlaceholder')"
                        :disabled="isSubmitting"
                    />
                </label>

                <label class="login-field">
                    <span>{{ t("auth.password") }}</span>

                    <Password
                        v-model="password"
                        toggle-mask
                        :feedback="false"
                        autocomplete="current-password"
                        :placeholder="t('auth.passwordPlaceholder')"
                        :disabled="isSubmitting"
                    />
                </label>

                <Button
                    type="submit"
                    class="login-card__submit"
                    icon="pi pi-sign-in"
                    :label="t('auth.signIn')"
                    :loading="isSubmitting"
                />
            </form>
        </section>
    </main>
</template>

<style scoped>
.login-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--hrms-app-background);
}

.login-page__topbar {
    min-height: 4.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--hrms-space-4);
    padding: 0 var(--hrms-space-5);
    background: var(--hrms-surface);
    border-bottom: 1px solid var(--hrms-border);
}

.login-page__brand {
    display: flex;
    align-items: center;
    gap: var(--hrms-space-3);
}

.login-page__brand-icon {
    width: 2.25rem;
    height: 2.25rem;
    display: grid;
    place-items: center;
    color: white;
    border-radius: var(--hrms-radius-md);
    background: var(--hrms-primary);
}

.login-page__brand strong,
.login-page__brand span {
    display: block;
}

.login-page__brand strong {
    color: var(--hrms-text);
    font-size: 0.86rem;
}

.login-page__brand span {
    margin-top: 0.125rem;
    color: var(--hrms-text-muted);
    font-size: 0.7rem;
}

.login-page__actions {
    display: flex;
    align-items: center;
    gap: var(--hrms-space-2);
}

.login-page__content {
    width: 100%;
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(20rem, 27rem);
    align-items: center;
    gap: clamp(2rem, 8vw, 9rem);
    padding: clamp(2rem, 8vw, 7rem);
}

.login-introduction {
    max-width: 43rem;
}

.login-introduction > span {
    color: var(--hrms-primary);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
}

.login-introduction h1 {
    max-width: 38rem;
    margin: 0.75rem 0;
    color: var(--hrms-text);
    font-size: clamp(2rem, 4vw, 3.5rem);
    line-height: 1.15;
}

.login-introduction p {
    max-width: 36rem;
    margin: 0;
    color: var(--hrms-text-muted);
    font-size: 0.95rem;
    line-height: 1.7;
}

.login-introduction__points {
    display: grid;
    gap: var(--hrms-space-3);
    margin-top: 2rem;
}

.login-introduction__points > div {
    display: flex;
    align-items: center;
    gap: var(--hrms-space-3);
    color: var(--hrms-text);
    font-size: 0.82rem;
    font-weight: 600;
}

.login-introduction__points i {
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    color: var(--hrms-primary);
    border-radius: var(--hrms-radius-sm);
    background: var(--hrms-primary-soft);
}

.login-card {
    display: grid;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--hrms-surface);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-lg);
    box-shadow: var(--hrms-shadow-md);
}

.login-card__heading h2,
.login-card__heading p {
    margin: 0;
}

.login-card__heading h2 {
    color: var(--hrms-text);
    font-size: 1.2rem;
}

.login-card__heading p {
    margin-top: 0.4rem;
    color: var(--hrms-text-muted);
    font-size: 0.8rem;
    line-height: 1.5;
}

.login-field {
    display: grid;
    gap: 0.45rem;
    color: var(--hrms-text);
    font-size: 0.78rem;
    font-weight: 700;
}

.login-field :deep(.p-inputtext),
.login-field :deep(.p-password),
.login-field :deep(.p-password-input) {
    width: 100%;
}

.login-card__submit {
    width: 100%;
    margin-top: 0.25rem;
}

@media (max-width: 900px) {
    .login-page__content {
        grid-template-columns: minmax(0, 31rem);
        justify-content: center;
        padding: 2.5rem 1.25rem;
    }

    .login-introduction {
        text-align: center;
    }

    .login-introduction__points {
        justify-items: center;
    }
}

@media (max-width: 550px) {
    .login-page__topbar {
        padding: 0 1rem;
    }

    .login-page__brand span {
        display: none;
    }

    .login-page__content {
        padding: 1.5rem 1rem;
    }

    .login-introduction h1 {
        font-size: 1.8rem;
    }

    .login-introduction__points {
        display: none;
    }
}
</style>