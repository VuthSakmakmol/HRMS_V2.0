<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useRoute, useRouter } from "vue-router"

import Button from "primevue/button"
import Tag from "primevue/tag"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const uiStore = useUiStore()

const sidebarOpen = ref(false)
const desktopSidebarCollapsed = ref(false)
const isMobileSidebar = ref(false)

const pageTitle = computed(() =>
    t(route.meta.titleKey || "nav.overview"),
)

const isFlushContentRoute = computed(() =>
    route.name === "reports-hr-dashboard",
)

const roleLabel = computed(() => {
    if (authStore.isRootAdmin) {
        return t("auth.rootAdministrator")
    }

    return authStore.user?.roleCodes?.join(", ") || "-"
})

const navGroups = computed(() => {
    const groups = [
        {
            labelKey: "nav.workspace",
            items: [
                {
                    labelKey: "nav.overview",
                    icon: "pi pi-th-large",
                    to: {
                        name: "workspace",
                    },
                },
            ],
        },

        {
            labelKey: "nav.accessControl",
            items: [
                { labelKey: "nav.accounts", icon: "pi pi-users", to: { name: "access-accounts" }, permissionCode: "ACCESS.ACCOUNT.VIEW" },
                { labelKey: "nav.rolesPermissions", icon: "pi pi-shield", to: { name: "access-roles" }, permissionCode: "ACCESS.ROLE.VIEW" },
            ],
        },

        {
            labelKey: "nav.organization",
            items: [
                {
                    labelKey: "nav.companies",
                    icon: "pi pi-building",
                    to: {
                        name: "organization-companies",
                    },
                    permissionCode: "ORGANIZATION.COMPANY.VIEW",
                },

                {
                    labelKey: "nav.branches",
                    icon: "pi pi-sitemap",
                    to: {
                        name: "organization-branches",
                    },
                    permissionCode: "ORGANIZATION.BRANCH.VIEW",
                },

                {
                    labelKey: "nav.departments",
                    icon: "pi pi-objects-column",
                    to: {
                        name: "organization-departments",
                    },
                    permissionCode: "ORGANIZATION.DEPARTMENT.VIEW",
                },

                {
                    labelKey: "nav.positions",
                    icon: "pi pi-id-card",
                    to: {
                        name: "organization-positions",
                    },
                    permissionCode: "ORGANIZATION.POSITION.VIEW",
                },

                {
                    labelKey: "nav.lines",
                    icon: "pi pi-share-alt",
                    to: {
                        name: "organization-lines",
                    },
                    permissionCode: "ORGANIZATION.LINE.VIEW",
                },

                {
                    labelKey: "nav.shifts",
                    icon: "pi pi-clock",
                    to: {
                        name: "organization-shifts",
                    },
                    permissionCode: "ORGANIZATION.SHIFT.VIEW",
                },

                {
                    labelKey: "nav.employeeTypes",
                    icon: "pi pi-id-card",
                    to: {
                        name: "organization-employee-types",
                    },
                    permissionCode: "ORGANIZATION.EMPLOYEE_TYPE.VIEW",
                },

                {
                    labelKey: "nav.locations",
                    icon: "pi pi-map",
                    to: {
                        name: "organization-locations",
                    },
                    permissionCode: "ORGANIZATION.LOCATION.VIEW",
                },
                
                {
                    labelKey: "nav.employees",
                    icon: "pi pi-users",
                    to: {
                        name: "employees",
                    },
                    permissionCode: "EMPLOYEE.PROFILE.VIEW",
                },

                {
                    labelKey: "nav.calendar",
                    icon: "pi pi-calendar",
                    to: {
                        name: "calendar-days",
                    },
                    permissionCode: "CALENDAR.DAY.VIEW",
                },



            ],
        },

        {
            labelKey: "nav.attendance",
            items: [
                {
                    labelKey: "nav.attendanceRecords",
                    icon: "pi pi-calendar-clock",
                    to: { name: "attendance-records" },
                    permissionCode: "ATTENDANCE.RECORD.VIEW",
                },
                {
                    labelKey: "nav.attendancePolicies",
                    icon: "pi pi-sliders-h",
                    to: { name: "attendance-policies" },
                    permissionCode: "ATTENDANCE.POLICY.VIEW",
                },
                {
                    labelKey: "nav.attendanceRawScans",
                    icon: "pi pi-qrcode",
                    to: { name: "attendance-raw-scans" },
                    permissionCode: "ATTENDANCE.SCAN.VIEW",
                },
                {
                    labelKey: "nav.attendanceVerification",
                    icon: "pi pi-check-circle",
                    to: { name: "attendance-verification" },
                    permissionCode: "ATTENDANCE.VERIFICATION.VIEW",
                },
            ],
        },

        {
            labelKey: "nav.reports",
            items: [
                {
                    labelKey: "nav.manpowerPlans",
                    icon: "pi pi-chart-line",
                    to: {
                        name: "report-manpower-plans",
                    },
                    permissionCode: "REPORT.MANPOWER_PLAN.VIEW",
                },
                {
                    labelKey: "nav.employeeMovements",
                    icon: "pi pi-history",
                    to: {
                        name: "employee-movements",
                    },
                    permissionCode: "EMPLOYEE.MOVEMENT.VIEW",
                },

                {
                    labelKey: "nav.hrDashboard",
                    icon: "pi pi-chart-bar",
                    to: {
                        name: "reports-hr-dashboard",
                    },
                    permissionCode: "REPORT.HR_ANALYTICS.VIEW",
                },
                
                {
                    labelKey: "nav.recruitmentChannels",
                    icon: "pi pi-megaphone",
                    to: {
                        name: "organization-recruitment-channels",
                    },
                    permissionCode: "ORGANIZATION.RECRUITMENT_CHANNEL.VIEW",
                },

                {
                    labelKey: "nav.hrDashboardTargets",
                    icon: "pi pi-bullseye",
                    to: {
                        name: "report-hr-dashboard-targets",
                    },
                    permissionCode: "REPORT.HR_DASHBOARD_TARGET.VIEW",
                },

                {
                    labelKey: "nav.exitReasons",
                    icon: "pi pi-sign-out",
                    to: { name: "organization-exit-reasons" },
                    permissionCode: "ORGANIZATION.EXIT_REASON.VIEW",
                },


            ],
        },

    ]

    return groups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => {
                if (item.disabled) {
                    return true
                }

                if (!item.permissionCode) {
                    return true
                }

                return authStore.hasPermission(item.permissionCode)
            }),
        }))
        .filter((group) => group.items.length > 0)
})

function syncViewportMode() {
    isMobileSidebar.value = window.matchMedia("(max-width: 900px)").matches

    if (isMobileSidebar.value) {
        desktopSidebarCollapsed.value = false
    } else {
        sidebarOpen.value = false
    }
}

function closeSidebar() {
    sidebarOpen.value = false
}

function toggleSidebar() {
    if (isMobileSidebar.value) {
        sidebarOpen.value = !sidebarOpen.value
        return
    }

    desktopSidebarCollapsed.value = !desktopSidebarCollapsed.value
}

onMounted(() => {
    syncViewportMode()
    window.addEventListener("resize", syncViewportMode)
})

onBeforeUnmount(() => {
    window.removeEventListener("resize", syncViewportMode)
})

async function logout() {
    authStore.logout()
    closeSidebar()

    await router.replace({
        name: "login",
    })
}
</script>

<template>
    <div
        class="app-shell"
        :class="{
            'app-shell--sidebar-collapsed': desktopSidebarCollapsed,
        }"
    >
        <div
            v-if="sidebarOpen"
            class="app-shell__overlay"
            @click="closeSidebar"
        />

        <aside
            class="app-sidebar"
            :class="{
                'app-sidebar--open': sidebarOpen,
                'app-sidebar--desktop-collapsed': desktopSidebarCollapsed,
            }"
        >
            <div class="app-sidebar__brand">
                <div class="app-sidebar__brand-icon">
                    <i class="pi pi-building" />
                </div>

                <div class="app-sidebar__brand-text">
                    <strong>{{ t("app.name") }}</strong>
                    <span>{{ t("app.subtitle") }}</span>
                </div>

                <Button
                    class="app-sidebar__collapse-button"
                    text
                    rounded
                    icon="pi pi-angle-left"
                    :aria-label="t('common.close')"
                    @click="toggleSidebar"
                />
            </div>

            <nav class="app-sidebar__nav">
                <div
                    v-for="group in navGroups"
                    :key="group.labelKey"
                    class="app-sidebar__group"
                >
                    <span class="app-sidebar__section-label">
                        {{ t(group.labelKey) }}
                    </span>

                    <template
                        v-for="item in group.items"
                        :key="item.labelKey"
                    >
                        <RouterLink
                            v-if="!item.disabled"
                            :to="item.to"
                            class="app-sidebar__link"
                            active-class="app-sidebar__link--active"
                            @click="closeSidebar"
                        >
                            <i :class="item.icon" />
                            <span>{{ t(item.labelKey) }}</span>
                        </RouterLink>

                        <span
                            v-else
                            class="app-sidebar__link app-sidebar__link--disabled"
                        >
                            <i :class="item.icon" />
                            <span>{{ t(item.labelKey) }}</span>
                            <Tag
                                class="app-sidebar__soon"
                                severity="secondary"
                                :value="t('common.next')"
                            />
                        </span>
                    </template>
                </div>
            </nav>

            <div class="app-sidebar__bottom">
                <div class="app-sidebar__profile">
                    <div class="app-sidebar__avatar">
                        {{
                            (authStore.user?.displayName || "?")
                                .slice(0, 1)
                                .toUpperCase()
                        }}
                    </div>

                    <div class="app-sidebar__profile-text">
                        <strong>{{ authStore.user?.displayName }}</strong>
                        <span>{{ roleLabel }}</span>
                    </div>
                </div>

                <Button
                    class="app-sidebar__logout"
                    severity="danger"
                    text
                    icon="pi pi-sign-out"
                    :label="t('common.logout')"
                    @click="logout"
                />
            </div>
        </aside>

        <section class="app-main">
            <header class="app-topbar">
                <div class="app-topbar__left">
                    <Button
                        class="app-topbar__menu-button"
                        text
                        rounded
                        icon="pi pi-bars"
                        :aria-label="t('common.menu')"
                        @click="toggleSidebar"
                    />

                    <h1 class="app-topbar__title">
                        {{ pageTitle }}
                    </h1>
                </div>

                <div class="app-topbar__actions">
                    <Button
                        size="small"
                        :outlined="uiStore.locale !== 'en-US'"
                        label="EN"
                        @click="uiStore.setLocale('en-US')"
                    />

                    <Button
                        size="small"
                        :outlined="uiStore.locale !== 'km-KH'"
                        label="ខ្មែរ"
                        @click="uiStore.setLocale('km-KH')"
                    />

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

            <main
                class="app-content"
                :class="{
                    'app-content--flush': isFlushContentRoute,
                }"
            >
                <RouterView />
            </main>
        </section>
    </div>
</template>

<style scoped>
.app-shell {
    display: flex;
    width: 100%;
    height: 100dvh;
    overflow: hidden;
    background: var(--hrms-app-background);
}

.app-sidebar {
    display: flex;
    flex: 0 0 16rem;
    flex-direction: column;
    width: 16rem;
    height: 100dvh;
    overflow: hidden;
    color: var(--hrms-sidebar-text);
    background: var(--hrms-sidebar);
    border-right: 1px solid rgb(255 255 255 / 0.08);
    transition:
        flex-basis 0.2s ease,
        width 0.2s ease,
        opacity 0.16s ease;
}


.app-sidebar--desktop-collapsed {
    flex-basis: 0;
    width: 0;
    min-width: 0;
    opacity: 0;
    pointer-events: none;
    border-right: 0;
}

.app-sidebar__brand {
    display: flex;
    flex: 0 0 3.75rem;
    align-items: center;
    gap: var(--hrms-space-3);
    min-height: 3.75rem;
    padding: 0 var(--hrms-space-4);
    border-bottom: 1px solid rgb(255 255 255 / 0.08);
}

.app-sidebar__brand-icon,
.app-sidebar__avatar {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    color: white;
    background: var(--hrms-primary);
}

.app-sidebar__brand-icon {
    width: 2rem;
    height: 2rem;
    border-radius: var(--hrms-radius-md);
}

.app-sidebar__brand-text,
.app-sidebar__profile-text {
    min-width: 0;
}

.app-sidebar__brand-text strong,
.app-sidebar__brand-text span,
.app-sidebar__profile-text strong,
.app-sidebar__profile-text span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.app-sidebar__brand-text strong {
    font-size: 0.82rem;
}

.app-sidebar__collapse-button {
    flex: 0 0 auto;
    margin-left: auto;
    color: rgb(229 237 248 / 0.72);
}

.app-sidebar__collapse-button:hover {
    color: white;
    background: rgb(255 255 255 / 0.08);
}

.app-sidebar__brand-text span,
.app-sidebar__profile-text span {
    margin-top: 0.125rem;
    color: rgb(229 237 248 / 0.65);
    font-size: 0.67rem;
}

.app-sidebar__nav {
    display: grid;
    flex: 1 1 auto;
    align-content: start;
    gap: 0.7rem;
    min-height: 0;
    padding: 0.75rem;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
}

.app-sidebar__nav::-webkit-scrollbar {
    width: 0.35rem;
}

.app-sidebar__nav::-webkit-scrollbar-thumb {
    background: rgb(255 255 255 / 0.18);
    border-radius: 999px;
}

.app-sidebar__group {
    display: grid;
    gap: 0.2rem;
}

.app-sidebar__section-label {
    margin-bottom: 0.125rem;
    padding: 0 0.5rem;
    color: rgb(229 237 248 / 0.5);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.app-sidebar__link {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-height: 2.125rem;
    padding: 0 0.625rem;
    color: rgb(229 237 248 / 0.78);
    border-radius: 0.375rem;
    font-size: 0.76rem;
    font-weight: 600;
    transition:
        color 0.15s ease,
        background-color 0.15s ease;
}

.app-sidebar__link > i {
    width: 1rem;
    flex: 0 0 1rem;
    font-size: 0.9rem;
    text-align: center;
}

.app-sidebar__link:hover {
    color: white;
    background: rgb(255 255 255 / 0.07);
}

.app-sidebar__link--active {
    color: white;
    background: var(--hrms-primary);
}

.app-sidebar__link--disabled {
    cursor: not-allowed;
    opacity: 0.55;
}

.app-sidebar__soon {
    margin-left: auto;
    font-size: 0.6rem;
}

.app-sidebar__bottom {
    display: grid;
    flex: 0 0 auto;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: var(--hrms-sidebar);
    border-top: 1px solid rgb(255 255 255 / 0.08);
}

.app-sidebar__profile {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
}

.app-sidebar__avatar {
    width: 1.875rem;
    height: 1.875rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
}

.app-sidebar__profile-text strong {
    font-size: 0.72rem;
}

.app-sidebar__logout {
    width: 100%;
    min-height: 1.875rem;
    justify-content: flex-start;
    padding: 0 0.5rem;
    font-size: 0.72rem;
}

.app-main {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    height: 100dvh;
    overflow: hidden;
}

.app-topbar {
    display: flex;
    flex: 0 0 3.75rem;
    align-items: center;
    justify-content: space-between;
    gap: var(--hrms-space-3);
    min-height: 3.75rem;
    padding: 0 1rem;
    background: var(--hrms-surface);
    border-bottom: 1px solid var(--hrms-border);
}

.app-topbar__left,
.app-topbar__actions {
    display: flex;
    align-items: center;
}

.app-topbar__left {
    gap: 0.5rem;
    min-width: 0;
}

.app-topbar__title {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--hrms-text);
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.app-topbar__actions {
    flex: 0 0 auto;
    gap: 0.375rem;
}

.app-topbar__actions :deep(.p-button) {
    min-height: 2rem;
    padding-top: 0.35rem;
    padding-bottom: 0.35rem;
    font-size: 0.72rem;
}

.app-topbar__menu-button {
    display: inline-flex;
}

.app-content {
    flex: 1 1 auto;
    width: 100%;
    min-height: 0;
    padding: 0.875rem;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
}

.app-content--flush {
    padding: 0;
}

.app-shell__overlay {
    display: none;
}

@media (max-width: 900px) {
    .app-sidebar {
        position: fixed;
        z-index: 1200;
        inset: 0 auto 0 0;
        flex: 0 0 16rem;
        width: 16rem;
        opacity: 1;
        pointer-events: auto;
        transform: translateX(-100%);
        transition: transform 0.2s ease;
        box-shadow: var(--hrms-shadow-md);
    }

    .app-sidebar--open {
        transform: translateX(0);
    }

    .app-shell__overlay {
        position: fixed;
        z-index: 1100;
        inset: 0;
        display: block;
        background: rgb(0 0 0 / 0.42);
    }

    .app-topbar__menu-button {
        display: inline-flex;
    }
}

@media (max-width: 600px) {
    .app-topbar {
        padding-right: 0.625rem;
        padding-left: 0.625rem;
    }

    .app-content {
        padding: 0.625rem;
    }

    .app-content--flush {
        padding: 0;
    }

    .app-topbar__actions {
        gap: 0.125rem;
    }

    .app-topbar__actions :deep(.p-button) {
        min-width: 2rem;
        padding-right: 0.45rem;
        padding-left: 0.45rem;
    }
}
</style>
