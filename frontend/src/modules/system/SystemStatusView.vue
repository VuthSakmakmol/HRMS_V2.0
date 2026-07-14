<script setup>
import { computed, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"

import Button from "primevue/button"
import Card from "primevue/card"
import Tag from "primevue/tag"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"
import { apiClient } from "@/shared/services/apiClient.js"

const { t } = useI18n()

const authStore = useAuthStore()
const uiStore = useUiStore()

const apiState = ref("loading")
const lastCheckedAt = ref(null)

const apiSeverity = computed(() => {
    if (apiState.value === "success") {
        return "success"
    }

    if (apiState.value === "error") {
        return "danger"
    }

    return "info"
})

const apiStatusText = computed(() => {
    if (apiState.value === "success") {
        return t("workspace.apiConnected")
    }

    if (apiState.value === "error") {
        return t("workspace.apiUnavailable")
    }

    return t("workspace.apiChecking")
})

const lastCheckedText = computed(() => {
    if (!lastCheckedAt.value) {
        return t("workspace.notChecked")
    }

    return new Intl.DateTimeFormat(uiStore.locale, {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(lastCheckedAt.value)
})

const permissionCount = computed(
    () => authStore.user?.effectivePermissionCodes?.length || 0,
)

const displayedPermissions = computed(() =>
    (authStore.user?.effectivePermissionCodes || []).slice(0, 6),
)

async function checkApiHealth() {
    apiState.value = "loading"

    try {
        const response = await apiClient.get("/health")

        lastCheckedAt.value = new Date(response.data?.data?.timestamp)
        apiState.value = "success"
    } catch {
        apiState.value = "error"
    }
}

onMounted(checkApiHealth)
</script>

<template>
    <section class="workspace">
        <div class="workspace__heading">
            <div>
                <span>{{ t("workspace.eyebrow") }}</span>
                <h2>
                    {{
                        t("workspace.welcome", {
                            name: authStore.user?.displayName || "",
                        })
                    }}
                </h2>
                <p>{{ t("workspace.description") }}</p>
            </div>

            <Tag
                :severity="authStore.isRootAdmin ? 'success' : 'info'"
                :value="
                    authStore.isRootAdmin
                        ? t('auth.rootAdministrator')
                        : t('workspace.authorizedUser')
                "
            />
        </div>

        <section class="workspace__grid">
            <Card class="workspace-card">
                <template #title>
                    <div class="workspace-card__title">
                        <i class="pi pi-link" />
                        <span>{{ t("workspace.backendConnection") }}</span>
                    </div>
                </template>

                <template #content>
                    <div class="workspace-card__content">
                        <div class="workspace-card__status">
                            <strong>{{ apiStatusText }}</strong>

                            <Tag
                                :severity="apiSeverity"
                                :value="apiStatusText"
                            />
                        </div>

                        <span class="workspace-card__muted">
                            {{ t("workspace.lastChecked") }}
                        </span>

                        <strong class="workspace-card__value">
                            {{ lastCheckedText }}
                        </strong>

                        <Button
                            size="small"
                            icon="pi pi-refresh"
                            :label="t('common.retry')"
                            :loading="apiState === 'loading'"
                            @click="checkApiHealth"
                        />
                    </div>
                </template>
            </Card>

            <Card class="workspace-card">
                <template #title>
                    <div class="workspace-card__title">
                        <i class="pi pi-user" />
                        <span>{{ t("workspace.signedInAccount") }}</span>
                    </div>
                </template>

                <template #content>
                    <div class="workspace-card__content">
                        <span class="workspace-card__muted">
                            {{ t("auth.loginId") }}
                        </span>

                        <strong class="workspace-card__value">
                            {{ authStore.user?.loginId }}
                        </strong>

                        <span class="workspace-card__muted">
                            {{ t("workspace.role") }}
                        </span>

                        <strong class="workspace-card__value">
                            {{
                                authStore.isRootAdmin
                                    ? t("auth.rootAdministrator")
                                    : authStore.user?.roleCodes?.join(", ")
                            }}
                        </strong>
                    </div>
                </template>
            </Card>

            <Card class="workspace-card">
                <template #title>
                    <div class="workspace-card__title">
                        <i class="pi pi-shield" />
                        <span>{{ t("workspace.accessControl") }}</span>
                    </div>
                </template>

                <template #content>
                    <div class="workspace-card__content">
                        <span class="workspace-card__muted">
                            {{ t("workspace.effectivePermissions") }}
                        </span>

                        <strong class="workspace-card__number">
                            {{ permissionCount }}
                        </strong>

                        <span class="workspace-card__muted">
                            {{ t("workspace.permissionDescription") }}
                        </span>
                    </div>
                </template>
            </Card>

            <Card class="workspace-card">
                <template #title>
                    <div class="workspace-card__title">
                        <i class="pi pi-sitemap" />
                        <span>{{ t("workspace.nextModule") }}</span>
                    </div>
                </template>

                <template #content>
                    <div class="workspace-card__content">
                        <strong class="workspace-card__value">
                            {{ t("workspace.organizationTitle") }}
                        </strong>

                        <span class="workspace-card__muted">
                            {{ t("workspace.organizationDescription") }}
                        </span>
                    </div>
                </template>
            </Card>
        </section>

        <section class="workspace-permissions">
            <div class="workspace-permissions__heading">
                <div>
                    <h3>{{ t("workspace.permissionPreview") }}</h3>
                    <p>{{ t("workspace.permissionPreviewDescription") }}</p>
                </div>

                <Tag
                    severity="info"
                    :value="String(permissionCount)"
                />
            </div>

            <div class="workspace-permissions__items">
                <Tag
                    v-for="permissionCode in displayedPermissions"
                    :key="permissionCode"
                    severity="secondary"
                    :value="permissionCode"
                />

                <span
                    v-if="permissionCount > displayedPermissions.length"
                    class="workspace-card__muted"
                >
                    {{
                        t("workspace.morePermissions", {
                            count:
                                permissionCount - displayedPermissions.length,
                        })
                    }}
                </span>
            </div>
        </section>
    </section>
</template>

<style scoped>
.workspace {
    width: 100%;
}

.workspace__heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--hrms-space-4);
    margin-bottom: 1.25rem;
}

.workspace__heading > div {
    min-width: 0;
}

.workspace__heading span {
    color: var(--hrms-primary);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.workspace__heading h2 {
    margin: 0.45rem 0;
    color: var(--hrms-text);
    font-size: clamp(1.25rem, 2vw, 1.8rem);
}

.workspace__heading p {
    max-width: 48rem;
    margin: 0;
    color: var(--hrms-text-muted);
    line-height: 1.6;
}

.workspace__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
}

.workspace-card {
    min-width: 0;
    border: 1px solid var(--hrms-border);
    box-shadow: var(--hrms-shadow-sm);
}

.workspace-card__title {
    display: flex;
    align-items: center;
    gap: var(--hrms-space-2);
    color: var(--hrms-text);
    font-size: 0.82rem;
}

.workspace-card__content {
    display: grid;
    gap: var(--hrms-space-2);
}

.workspace-card__status {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--hrms-space-2);
}

.workspace-card__status strong,
.workspace-card__value {
    color: var(--hrms-text);
    font-size: 0.84rem;
}

.workspace-card__number {
    color: var(--hrms-primary);
    font-size: 2rem;
    line-height: 1;
}

.workspace-card__muted {
    color: var(--hrms-text-muted);
    font-size: 0.74rem;
    line-height: 1.5;
}

.workspace-permissions {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--hrms-surface);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
    box-shadow: var(--hrms-shadow-sm);
}

.workspace-permissions__heading {
    display: flex;
    justify-content: space-between;
    gap: var(--hrms-space-3);
    margin-bottom: 0.9rem;
}

.workspace-permissions__heading h3,
.workspace-permissions__heading p {
    margin: 0;
}

.workspace-permissions__heading h3 {
    color: var(--hrms-text);
    font-size: 0.86rem;
}

.workspace-permissions__heading p {
    margin-top: 0.25rem;
    color: var(--hrms-text-muted);
    font-size: 0.74rem;
}

.workspace-permissions__items {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
}

@media (max-width: 1200px) {
    .workspace__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 650px) {
    .workspace__heading {
        align-items: flex-start;
        flex-direction: column;
    }

    .workspace__grid {
        grid-template-columns: 1fr;
    }
}
</style>