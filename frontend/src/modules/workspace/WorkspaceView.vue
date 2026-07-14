<script setup>
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"

import Button from "primevue/button"
import Card from "primevue/card"
import Tag from "primevue/tag"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { apiClient } from "@/shared/services/apiClient.js"

const router = useRouter()
const authStore = useAuthStore()

const apiStatus = ref("Checking...")
const apiSeverity = ref("info")
const lastCheckedAt = ref("Not checked yet")

const permissionCount = computed(() => {
    return authStore.user?.effectivePermissionCodes?.length || 0
})

const roleName = computed(() => {
    if (authStore.user?.isRootAdmin) {
        return "Root Administrator"
    }

    return authStore.user?.roleCodes?.join(", ") || "No role assigned"
})

const visiblePermissions = computed(() => {
    return (authStore.user?.effectivePermissionCodes || []).slice(0, 8)
})

async function checkApiHealth() {
    apiStatus.value = "Checking..."
    apiSeverity.value = "info"

    try {
        const response = await apiClient.get("/health")

        apiStatus.value = "API connected"
        apiSeverity.value = "success"

        lastCheckedAt.value = new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "medium",
        }).format(new Date(response.data.data.timestamp))
    } catch {
        apiStatus.value = "API unavailable"
        apiSeverity.value = "danger"
    }
}

function goToOrganization() {
    alert(
        "Organization module is the next step. We will build Company and Branch management after this frontend login shell is stable.",
    )
}

onMounted(checkApiHealth)
</script>

<template>
    <section class="workspace-page">
        <div class="workspace-page__heading">
            <div>
                <span class="workspace-page__eyebrow">SECURE WORKSPACE</span>

                <h2>
                    Welcome back,
                    {{ authStore.user?.displayName || "User" }}
                </h2>

                <p>
                    Your login session, role, and effective permissions are
                    coming from the backend.
                </p>
            </div>

            <Tag
                :severity="authStore.user?.isRootAdmin ? 'success' : 'info'"
                :value="roleName"
            />
        </div>

        <div class="workspace-grid">
            <Card class="workspace-card">
                <template #title>
                    <div class="workspace-card__title">
                        <i class="pi pi-link" />
                        <span>Backend API</span>
                    </div>
                </template>

                <template #content>
                    <div class="workspace-card__content">
                        <div class="workspace-card__row">
                            <strong>{{ apiStatus }}</strong>

                            <Tag
                                :severity="apiSeverity"
                                :value="apiStatus"
                            />
                        </div>

                        <span class="workspace-card__label">
                            Last checked
                        </span>

                        <strong class="workspace-card__value">
                            {{ lastCheckedAt }}
                        </strong>

                        <Button
                            size="small"
                            icon="pi pi-refresh"
                            label="Retry"
                            @click="checkApiHealth"
                        />
                    </div>
                </template>
            </Card>

            <Card class="workspace-card">
                <template #title>
                    <div class="workspace-card__title">
                        <i class="pi pi-user" />
                        <span>Signed-in Account</span>
                    </div>
                </template>

                <template #content>
                    <div class="workspace-card__content">
                        <span class="workspace-card__label">Login ID</span>

                        <strong class="workspace-card__value">
                            {{ authStore.user?.loginId }}
                        </strong>

                        <span class="workspace-card__label">Role</span>

                        <strong class="workspace-card__value">
                            {{ roleName }}
                        </strong>
                    </div>
                </template>
            </Card>

            <Card class="workspace-card">
                <template #title>
                    <div class="workspace-card__title">
                        <i class="pi pi-shield" />
                        <span>Access Control</span>
                    </div>
                </template>

                <template #content>
                    <div class="workspace-card__content">
                        <span class="workspace-card__label">
                            Effective permissions
                        </span>

                        <strong class="workspace-card__number">
                            {{ permissionCount }}
                        </strong>

                        <span class="workspace-card__label">
                            Permissions are calculated by the backend.
                        </span>
                    </div>
                </template>
            </Card>

            <Card class="workspace-card">
                <template #title>
                    <div class="workspace-card__title">
                        <i class="pi pi-sitemap" />
                        <span>Next Module</span>
                    </div>
                </template>

                <template #content>
                    <div class="workspace-card__content">
                        <strong class="workspace-card__value">
                            Company and Branch Management
                        </strong>

                        <span class="workspace-card__label">
                            Root Admin will create companies and branches from
                            the HRMS interface.
                        </span>

                        <Button
                            size="small"
                            icon="pi pi-arrow-right"
                            label="Open Organization"
                            @click="goToOrganization"
                        />
                    </div>
                </template>
            </Card>
        </div>

        <section class="permission-panel">
            <div class="permission-panel__heading">
                <div>
                    <h3>Permission Preview</h3>
                    <p>
                        These permission codes were returned by your backend
                        login session.
                    </p>
                </div>

                <Tag severity="info" :value="String(permissionCount)" />
            </div>

            <div class="permission-panel__items">
                <Tag
                    v-for="permissionCode in visiblePermissions"
                    :key="permissionCode"
                    severity="secondary"
                    :value="permissionCode"
                />

                <span
                    v-if="permissionCount > visiblePermissions.length"
                    class="workspace-card__label"
                >
                    +{{ permissionCount - visiblePermissions.length }} more
                    permissions
                </span>
            </div>
        </section>
    </section>
</template>

<style scoped>
.workspace-page {
    width: 100%;
}

.workspace-page__heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
}

.workspace-page__eyebrow {
    color: var(--hrms-primary);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
}

.workspace-page h2 {
    margin: 0.45rem 0;
    color: var(--hrms-text);
    font-size: 1.65rem;
}

.workspace-page p {
    max-width: 50rem;
    margin: 0;
    color: var(--hrms-text-muted);
    line-height: 1.6;
}

.workspace-grid {
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
    gap: 0.5rem;
    color: var(--hrms-text);
    font-size: 0.82rem;
}

.workspace-card__content {
    display: grid;
    gap: 0.65rem;
}

.workspace-card__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
}

.workspace-card__row strong,
.workspace-card__value {
    color: var(--hrms-text);
    font-size: 0.84rem;
}

.workspace-card__label {
    color: var(--hrms-text-muted);
    font-size: 0.74rem;
    line-height: 1.5;
}

.workspace-card__number {
    color: var(--hrms-primary);
    font-size: 2.25rem;
    line-height: 1;
}

.permission-panel {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--hrms-surface);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
    box-shadow: var(--hrms-shadow-sm);
}

.permission-panel__heading {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.9rem;
}

.permission-panel__heading h3,
.permission-panel__heading p {
    margin: 0;
}

.permission-panel__heading h3 {
    color: var(--hrms-text);
    font-size: 0.88rem;
}

.permission-panel__heading p {
    margin-top: 0.25rem;
    font-size: 0.74rem;
}

.permission-panel__items {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
}

@media (max-width: 1200px) {
    .workspace-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 650px) {
    .workspace-page__heading {
        flex-direction: column;
    }

    .workspace-grid {
        grid-template-columns: 1fr;
    }
}
</style>