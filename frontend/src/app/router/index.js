import { createRouter, createWebHistory } from "vue-router"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"

const router = createRouter({
    history: createWebHistory(),

    routes: [
        {
            path: "/login",
            name: "login",
            component: () => import("@/modules/auth/LoginView.vue"),
            meta: {
                guestOnly: true,
            },
        },

        {
            path: "/",
            component: () => import("@/layouts/AppShell.vue"),
            meta: {
                requiresAuth: true,
            },

            children: [
                {
                    path: "",
                    name: "workspace",
                    component: () => import("@/modules/workspace/WorkspaceView.vue"),
                    meta: {
                        titleKey: "nav.overview",
                    },
                },

                {
                    path: "access/accounts",
                    name: "access-accounts",
                    component: () => import("@/modules/access/views/AccountListView.vue"),
                    meta: { titleKey: "nav.accounts", permissionCode: "ACCESS.ACCOUNT.VIEW" },
                },
                {
                    path: "access/roles",
                    name: "access-roles",
                    component: () => import("@/modules/access/views/RoleListView.vue"),
                    meta: { titleKey: "nav.rolesPermissions", permissionCode: "ACCESS.ROLE.VIEW" },
                },

                {
                    path: "organization/companies",
                    name: "organization-companies",
                    component: () =>
                        import("@/modules/organization/company/views/CompanyListView.vue"),
                    meta: {
                        titleKey: "nav.companies",
                        permissionCode: "ORGANIZATION.COMPANY.VIEW",
                    },
                },

                {
                    path: "organization/branches",
                    name: "organization-branches",
                    component: () =>
                        import("@/modules/organization/branch/views/BranchListView.vue"),
                    meta: {
                        titleKey: "nav.branches",
                        permissionCode: "ORGANIZATION.BRANCH.VIEW",
                    },
                },

                {
                    path: "organization/departments",
                    name: "organization-departments",
                    component: () => import("@/modules/organization/department/views/DepartmentListView.vue"),
                    meta: {
                        titleKey: "nav.departments",
                        permissionCode: "ORGANIZATION.DEPARTMENT.VIEW",
                    },
                },

                {
                    path: "organization/positions",
                    name: "organization-positions",
                    component: () => import("@/modules/organization/position/views/PositionListView.vue"),
                    meta: {
                        titleKey: "nav.positions",
                        permissionCode: "ORGANIZATION.POSITION.VIEW",
                    },
                },

                {
                    path: "organization/lines",
                    name: "organization-lines",
                    component: () => import("@/modules/line/views/LineListView.vue"),
                    meta: {
                        titleKey: "nav.lines",
                        permissionCode: "ORGANIZATION.LINE.VIEW",
                    },
                },

                {
                    path: "organization/shifts",
                    name: "organization-shifts",
                    component: () => import("@/modules/organization/shift/views/ShiftListView.vue"),
                    meta: {
                        titleKey: "nav.shifts",
                        permissionCode: "ORGANIZATION.SHIFT.VIEW",
                    },
                },

                {
                    path: "organization/employee-types",
                    name: "organization-employee-types",
                    component: () =>
                        import("@/modules/organization/employeeType/views/EmployeeTypeListView.vue"),
                    meta: {
                        titleKey: "nav.employeeTypes",
                        permissionCode: "ORGANIZATION.EMPLOYEE_TYPE.VIEW",
                    },
                },

                {
                    path: "organization/locations",
                    name: "organization-locations",
                    component: () => import("@/modules/organization/location/views/LocationListView.vue"),
                    meta: {
                        titleKey: "nav.locations",
                        permissionCode: "ORGANIZATION.LOCATION.VIEW",
                    },
                },

                {
                    path: "employees",
                    name: "employees",
                    component: () => import("@/modules/employee/views/EmployeeListView.vue"),
                    meta: {
                        titleKey: "nav.employees",
                        permissionCode: "EMPLOYEE.PROFILE.VIEW",
                    },
                },

                {
                    path: "employees/movements",
                    name: "employee-movements",
                    component: () =>
                        import("@/modules/employeeMovement/views/EmployeeMovementListView.vue"),
                    meta: {
                        titleKey: "nav.employeeMovements",
                        permissionCode: "EMPLOYEE.MOVEMENT.VIEW",
                    },
                },

                {
                    path: "reports/manpower-plans",
                    name: "report-manpower-plans",
                    component: () =>
                        import("@/modules/manpowerPlan/views/ManpowerPlanListview.vue"),
                    meta: {
                        titleKey: "nav.manpowerPlans",
                        permissionCode: "REPORT.MANPOWER_PLAN.VIEW",
                    },
                },

                {
                    path: "calendar",
                    name: "calendar-days",
                    component: () => import("@/modules/calendar/views/CalendarListView.vue"),
                    meta: {
                        titleKey: "nav.calendar",
                        permissionCode: "CALENDAR.DAY.VIEW",
                    },
                },

                {
                    path: "attendance/records",
                    name: "attendance-records",
                    component: () => import("@/modules/attendance/views/AttendanceRecordsView.vue"),
                    meta: {
                        titleKey: "nav.attendanceRecords",
                        permissionCode: "ATTENDANCE.RECORD.VIEW",
                    },
                },

                {
                    path: "reports/attendance-daily",
                    name: "attendance-daily-report",
                    component: () => import("@/modules/attendance/views/AttendanceDailyReportView.vue"),
                    meta: {
                        titleKey: "nav.attendanceDailyReport",
                        permissionCode: "ATTENDANCE.RECORD.VIEW",
                    },
                },

                {
                    path: "attendance/policies",
                    name: "attendance-policies",
                    component: () => import("@/modules/attendance/views/AttendancePolicyView.vue"),
                    meta: {
                        titleKey: "nav.attendancePolicies",
                        permissionCode: "ATTENDANCE.POLICY.VIEW",
                    },
                },

                {
                    path: "attendance/raw-scans",
                    name: "attendance-raw-scans",
                    component: () => import("@/modules/attendance/views/AttendanceImportView.vue"),
                    meta: {
                        titleKey: "nav.attendanceRawScans",
                        permissionCode: "ATTENDANCE.SCAN.VIEW",
                    },
                },

                {
                    path: "attendance/verification",
                    name: "attendance-verification",
                    component: () =>
                        import("@/modules/attendance/views/AttendanceVerificationView.vue"),
                    meta: {
                        titleKey: "nav.attendanceVerification",
                        permissionCode: "ATTENDANCE.VERIFICATION.VIEW",
                    },
                },

                {
                    path: "reports/hr-dashboard",
                    name: "reports-hr-dashboard",
                    component: () => import("@/modules/hrDashboard/views/HRDashboardView.vue"),
                    meta: {
                        titleKey: "nav.hrDashboard",
                        permissionCode: "REPORT.HR_ANALYTICS.VIEW",
                    },
                },

                {
                    path: "organization/recruitment-channels",
                    name: "organization-recruitment-channels",
                    component: () =>
                        import("@/modules/recruitmentChannel/views/RecruitmentChannelListView.vue"),
                    meta: {
                        titleKey: "nav.recruitmentChannels",
                        permissionCode: "ORGANIZATION.RECRUITMENT_CHANNEL.VIEW",
                    },
                },

                {
                    path: "reports/hr-dashboard-targets",
                    name: "report-hr-dashboard-targets",
                    component: () =>
                        import("@/modules/hrDashboardTarget/views/HrDashboardTargetListView.vue"),
                    meta: {
                        titleKey: "nav.hrDashboardTargets",
                        permissionCode: "REPORT.HR_DASHBOARD_TARGET.VIEW",
                    },
                },

                {
                    path: "organization/exit-reasons",
                    name: "organization-exit-reasons",
                    component: () => import("@/modules/exitReason/views/ExitReasonListView.vue"),
                    meta: {
                        titleKey: "nav.exitReasons",
                        permissionCode: "ORGANIZATION.EXIT_REASON.VIEW",
                    },
                },
            ],
        },

        {
            path: "/:pathMatch(.*)*",
            redirect: {
                name: "workspace",
            },
        },
    ],
})

router.beforeEach(async (to) => {
    const authStore = useAuthStore()

    await authStore.bootstrap()

    const requiresAuth = to.matched.some((route) => route.meta.requiresAuth)

    const guestOnly = to.matched.some((route) => route.meta.guestOnly)

    if (requiresAuth && !authStore.isAuthenticated) {
        return {
            name: "login",
            query: {
                redirect: to.fullPath,
            },
        }
    }

    if (requiresAuth && authStore.isAuthenticated) {
        const workspaceStore = useWorkspaceStore()
        await workspaceStore.initialize(authStore.user)
    }

    if (guestOnly && authStore.isAuthenticated) {
        return {
            name: "workspace",
        }
    }

    const permissionCode = [...to.matched].reverse().find((route) => route.meta.permissionCode)
        ?.meta.permissionCode

    if (requiresAuth && permissionCode && !authStore.hasPermission(permissionCode)) {
        return {
            name: "workspace",
        }
    }

    return true
})

export default router
