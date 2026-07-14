<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"
import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import AppTableActions from "@/shared/components/table/AppTableActions.vue"

import { fetchLocations } from "../services/location.api.js"
import { useLocationStore } from "../stores/location.store.js"

const { t } = useI18n()
const toast = useToast()

const authStore = useAuthStore()
const uiStore = useUiStore()
const locationStore = useLocationStore()

const LOCATION_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.LOCATION.VIEW",
    CREATE: "ORGANIZATION.LOCATION.CREATE",
    UPDATE: "ORGANIZATION.LOCATION.UPDATE",
    ARCHIVE: "ORGANIZATION.LOCATION.ARCHIVE",
    IMPORT: "ORGANIZATION.LOCATION.IMPORT",
    EXPORT: "ORGANIZATION.LOCATION.EXPORT",
})

const entityTabs = Object.freeze([
    {
        value: "countries",
        labelKey: "organization.location.tabs.countries",
        icon: "pi pi-globe",
    },
    {
        value: "provinces",
        labelKey: "organization.location.tabs.provinces",
        icon: "pi pi-map",
    },
    {
        value: "districts",
        labelKey: "organization.location.tabs.districts",
        icon: "pi pi-map-marker",
    },
    {
        value: "communes",
        labelKey: "organization.location.tabs.communes",
        icon: "pi pi-compass",
    },
    {
        value: "villages",
        labelKey: "organization.location.tabs.villages",
        icon: "pi pi-home",
    },
])

const activeEntity = ref("countries")

const countries = ref([])
const provinces = ref([])
const districts = ref([])
const communes = ref([])
const lookupLoading = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedLocationId = ref(null)

const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)

const importDialogVisible = ref(false)
const importResultDialogVisible = ref(false)
const selectedImportFile = ref(null)
const fileInputRef = ref(null)

const formErrors = ref({})

const filters = reactive(createEmptyFilters())
const form = reactive(createEmptyForm())

const canCreate = computed(() =>
    authStore.hasPermission(LOCATION_PERMISSIONS.CREATE),
)
const canUpdate = computed(() =>
    authStore.hasPermission(LOCATION_PERMISSIONS.UPDATE),
)
const canArchive = computed(() =>
    authStore.hasPermission(LOCATION_PERMISSIONS.ARCHIVE),
)
const canImport = computed(() =>
    authStore.hasPermission(LOCATION_PERMISSIONS.IMPORT),
)
const canExport = computed(() =>
    authStore.hasPermission(LOCATION_PERMISSIONS.EXPORT),
)

const isCountryEntity = computed(() => activeEntity.value === "countries")
const needsProvince = computed(() =>
    ["districts", "communes", "villages"].includes(activeEntity.value),
)
const needsDistrict = computed(() =>
    ["communes", "villages"].includes(activeEntity.value),
)
const needsCommune = computed(() => activeEntity.value === "villages")

const activeTab = computed(() =>
    entityTabs.find((tab) => tab.value === activeEntity.value),
)

const activeEntityLabel = computed(() => t(activeTab.value.labelKey))

const dialogTitle = computed(() =>
    dialogMode.value === "create"
        ? t("organization.location.createTitle", {
              entity: activeEntityLabel.value,
          })
        : t("organization.location.editTitle", {
              entity: activeEntityLabel.value,
          }),
)

const statusOptions = computed(() => [
    {
        label: t("organization.location.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.location.statusInactive"),
        value: "INACTIVE",
    },
])

const statusFilterOptions = computed(() => [
    {
        label: t("organization.location.statusAll"),
        value: "ALL",
    },
    ...statusOptions.value,
    {
        label: t("organization.location.statusArchived"),
        value: "ARCHIVED",
    },
])

const countryOptions = computed(() =>
    countries.value.map((country) => ({
        label: `${country.code} - ${country.name}`,
        value: country.id,
    })),
)

const countryFilterOptions = computed(() => [
    {
        label: t("organization.location.allCountries"),
        value: "",
    },
    ...countryOptions.value,
])

const provinceOptions = computed(() =>
    provinces.value
        .filter((province) => {
            if (!form.countryId) {
                return true
            }

            return province.countryId === form.countryId
        })
        .map((province) => ({
            label: `${province.code} - ${province.name}`,
            value: province.id,
        })),
)

const provinceFilterOptions = computed(() => [
    {
        label: t("organization.location.allProvinces"),
        value: "",
    },
    ...provinces.value
        .filter((province) => {
            if (!filters.countryId) {
                return true
            }

            return province.countryId === filters.countryId
        })
        .map((province) => ({
            label: `${province.code} - ${province.name}`,
            value: province.id,
        })),
])

const districtOptions = computed(() =>
    districts.value
        .filter((district) => {
            if (form.countryId && district.countryId !== form.countryId) {
                return false
            }

            if (form.provinceId && district.provinceId !== form.provinceId) {
                return false
            }

            return true
        })
        .map((district) => ({
            label: `${district.code} - ${district.name}`,
            value: district.id,
        })),
)

const districtFilterOptions = computed(() => [
    {
        label: t("organization.location.allDistricts"),
        value: "",
    },
    ...districts.value
        .filter((district) => {
            if (filters.countryId && district.countryId !== filters.countryId) {
                return false
            }

            if (
                filters.provinceId &&
                district.provinceId !== filters.provinceId
            ) {
                return false
            }

            return true
        })
        .map((district) => ({
            label: `${district.code} - ${district.name}`,
            value: district.id,
        })),
])

const communeOptions = computed(() =>
    communes.value
        .filter((commune) => {
            if (form.countryId && commune.countryId !== form.countryId) {
                return false
            }

            if (form.provinceId && commune.provinceId !== form.provinceId) {
                return false
            }

            if (form.districtId && commune.districtId !== form.districtId) {
                return false
            }

            return true
        })
        .map((commune) => ({
            label: `${commune.code} - ${commune.name}`,
            value: commune.id,
        })),
)

const communeFilterOptions = computed(() => [
    {
        label: t("organization.location.allCommunes"),
        value: "",
    },
    ...communes.value
        .filter((commune) => {
            if (filters.countryId && commune.countryId !== filters.countryId) {
                return false
            }

            if (filters.provinceId && commune.provinceId !== filters.provinceId) {
                return false
            }

            if (filters.districtId && commune.districtId !== filters.districtId) {
                return false
            }

            return true
        })
        .map((commune) => ({
            label: `${commune.code} - ${commune.name}`,
            value: commune.id,
        })),
])

const emptyMessage = computed(() =>
    t("organization.location.empty", {
        entity: activeEntityLabel.value.toLowerCase(),
    }),
)

function createEmptyFilters() {
    return {
        search: "",
        status: "ALL",
        countryId: "",
        provinceId: "",
        districtId: "",
        communeId: "",
    }
}

function createEmptyForm() {
    return {
        countryId: "",
        provinceId: "",
        districtId: "",
        communeId: "",
        code: "",
        name: "",
        nationality: "",
        phoneCode: "",
        description: "",
        status: "ACTIVE",
    }
}

function resetObject(target, source) {
    for (const key of Object.keys(target)) {
        delete target[key]
    }

    Object.assign(target, source)
}

function getErrorMessage(error) {
    const messageKey = error?.response?.data?.error?.messageKey

    if (messageKey) {
        return t(messageKey)
    }

    return t("errors.internal")
}

function getFieldError(field) {
    return formErrors.value?.[field]?.[0] || ""
}

function getFieldInvalid(field) {
    return Boolean(getFieldError(field))
}

function getStatusSeverity(status) {
    if (status === "ACTIVE") {
        return "success"
    }

    if (status === "INACTIVE") {
        return "warn"
    }

    return "danger"
}

function getStatusLabel(status) {
    return {
        ACTIVE: t("organization.location.statusActive"),
        INACTIVE: t("organization.location.statusInactive"),
        ARCHIVED: t("organization.location.statusArchived"),
    }[status]
}

async function loadLookupEntity(entity, params = {}) {
    const result = await fetchLocations(entity, {
        page: 1,
        limit: 100,
        status: "ACTIVE",
        search: "",
        ...params,
    })

    return result.items || []
}

async function loadLookups() {
    lookupLoading.value = true

    try {
        countries.value = await loadLookupEntity("countries")

        if (["districts", "communes", "villages"].includes(activeEntity.value)) {
            provinces.value = await loadLookupEntity("provinces", {
                countryId: filters.countryId || undefined,
            })
        } else if (activeEntity.value === "provinces") {
            provinces.value = []
        }

        if (["communes", "villages"].includes(activeEntity.value)) {
            districts.value = await loadLookupEntity("districts", {
                countryId: filters.countryId || undefined,
                provinceId: filters.provinceId || undefined,
            })
        } else {
            districts.value = []
        }

        if (activeEntity.value === "villages") {
            communes.value = await loadLookupEntity("communes", {
                countryId: filters.countryId || undefined,
                provinceId: filters.provinceId || undefined,
                districtId: filters.districtId || undefined,
            })
        } else {
            communes.value = []
        }

        if (activeEntity.value === "provinces") {
            provinces.value = await loadLookupEntity("provinces", {
                countryId: filters.countryId || undefined,
            })
        }
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.location.lookupLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        lookupLoading.value = false
    }
}

async function loadLocationItems(page = 1) {
    try {
        await locationStore.loadLocations(activeEntity.value, {
            page,
            limit: locationStore.pagination.limit || 20,
            search: filters.search,
            status: filters.status,
            countryId: filters.countryId || undefined,
            provinceId: filters.provinceId || undefined,
            districtId: filters.districtId || undefined,
            communeId: filters.communeId || undefined,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.location.loadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function changeEntity(entity) {
    if (activeEntity.value === entity) {
        return
    }

    activeEntity.value = entity
}

function resetFilterParents(parentField) {
    if (parentField === "countryId") {
        filters.provinceId = ""
        filters.districtId = ""
        filters.communeId = ""
    }

    if (parentField === "provinceId") {
        filters.districtId = ""
        filters.communeId = ""
    }

    if (parentField === "districtId") {
        filters.communeId = ""
    }
}

async function applyFilters() {
    await loadLookups()
    await loadLocationItems(1)
}

async function clearFilters() {
    resetObject(filters, createEmptyFilters())
    await loadLookups()
    await loadLocationItems(1)
}

function openCreateDialog() {
    dialogMode.value = "create"
    selectedLocationId.value = null
    formErrors.value = {}
    resetObject(form, createEmptyForm())

    form.countryId = filters.countryId || ""
    form.provinceId = filters.provinceId || ""
    form.districtId = filters.districtId || ""
    form.communeId = filters.communeId || ""

    dialogVisible.value = true
}

function openEditDialog(location) {
    dialogMode.value = "edit"
    selectedLocationId.value = location.id
    formErrors.value = {}

    resetObject(form, {
        ...createEmptyForm(),
        countryId: location.countryId || "",
        provinceId: location.provinceId || "",
        districtId: location.districtId || "",
        communeId: location.communeId || "",
        code: location.code || "",
        name: location.name || "",
        nationality: location.nationality || "",
        phoneCode: location.phoneCode || "",
        description: location.description || "",
        status: location.status === "ARCHIVED" ? "INACTIVE" : location.status,
    })

    dialogVisible.value = true
}

function closeDialog() {
    dialogVisible.value = false
    formErrors.value = {}
}

function buildPayload() {
    const payload = {
        code: form.code,
        name: form.name,
        description: form.description || "",
        status: form.status || "ACTIVE",
    }

    if (activeEntity.value === "countries") {
        payload.nationality = form.nationality || ""
        payload.phoneCode = form.phoneCode || ""

        return payload
    }

    payload.countryId = form.countryId
    if (needsProvince.value) {
        payload.provinceId = form.provinceId
    }

    if (needsDistrict.value) {
        payload.districtId = form.districtId
    }

    if (needsCommune.value) {
        payload.communeId = form.communeId
    }

    return payload
}

async function submitForm() {
    formErrors.value = {}

    try {
        if (dialogMode.value === "create") {
            await locationStore.createLocation(activeEntity.value, buildPayload())

            toast.add({
                severity: "success",
                summary: t("organization.location.created"),
                detail: t("organization.location.createdDetail"),
                life: 3000,
            })
        } else {
            await locationStore.updateLocation(
                activeEntity.value,
                selectedLocationId.value,
                buildPayload(),
            )

            toast.add({
                severity: "success",
                summary: t("organization.location.updated"),
                detail: t("organization.location.updatedDetail"),
                life: 3000,
            })
        }

        closeDialog()
        await loadLookups()
        await loadLocationItems(locationStore.pagination.page)
    } catch (error) {
        formErrors.value = error?.response?.data?.error?.fields || {}

        toast.add({
            severity: "error",
            summary: t("organization.location.saveFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function openArchiveDialog(location) {
    archiveCandidate.value = location
    archiveDialogVisible.value = true
}

function closeArchiveDialog() {
    archiveCandidate.value = null
    archiveDialogVisible.value = false
}

async function confirmArchive() {
    if (!archiveCandidate.value) {
        return
    }

    try {
        await locationStore.archiveLocation(
            activeEntity.value,
            archiveCandidate.value.id,
        )

        toast.add({
            severity: "success",
            summary: t("organization.location.archived"),
            detail: t("organization.location.archivedDetail"),
            life: 3000,
        })

        closeArchiveDialog()
        await loadLookups()
        await loadLocationItems(locationStore.pagination.page)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.location.archiveFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

async function downloadSample() {
    try {
        await locationStore.downloadImportTemplate(activeEntity.value)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.location.downloadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

async function exportExcel() {
    try {
        await locationStore.exportLocations(activeEntity.value)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.location.exportFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function openImportDialog() {
    selectedImportFile.value = null
    importDialogVisible.value = true

    if (fileInputRef.value) {
        fileInputRef.value.value = ""
    }
}

function closeImportDialog() {
    selectedImportFile.value = null
    importDialogVisible.value = false
}

function onFileSelected(event) {
    const file = event.target.files?.[0]
    selectedImportFile.value = file || null
}

async function submitImport() {
    if (!selectedImportFile.value) {
        toast.add({
            severity: "warn",
            summary: t("organization.location.importFileRequired"),
            detail: t("organization.location.importFileRequiredDetail"),
            life: 3500,
        })
        return
    }

    try {
        await locationStore.importLocations(activeEntity.value, selectedImportFile.value)

        closeImportDialog()
        importResultDialogVisible.value = true
        await loadLookups()
        await loadLocationItems(1)
    } catch (error) {
        const summary = error?.response?.data?.data?.summary

        if (summary) {
            locationStore.importSummary = summary
            closeImportDialog()
            importResultDialogVisible.value = true
            await loadLookups()
            await loadLocationItems(1)
            return
        }

        toast.add({
            severity: "error",
            summary: t("organization.location.importFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

async function goToPage(page) {
    if (page < 1 || page > locationStore.pagination.totalPages) {
        return
    }

    await loadLocationItems(page)
}

function onPage(event) {
    locationStore.pagination.limit = event.rows
    loadLocationItems(event.page + 1)
}

watch(activeEntity, async () => {
    resetObject(filters, createEmptyFilters())
    locationStore.items = []
    locationStore.pagination = {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
    }

    await loadLookups()
    await loadLocationItems(1)
})

watch(
    () => form.countryId,
    () => {
        if (!form.countryId) {
            form.provinceId = ""
            form.districtId = ""
            form.communeId = ""
            return
        }

        if (
            form.provinceId &&
            !provinceOptions.value.some((option) => option.value === form.provinceId)
        ) {
            form.provinceId = ""
            form.districtId = ""
            form.communeId = ""
        }
    },
)

watch(
    () => form.provinceId,
    () => {
        if (!form.provinceId) {
            form.districtId = ""
            form.communeId = ""
            return
        }

        if (
            form.districtId &&
            !districtOptions.value.some((option) => option.value === form.districtId)
        ) {
            form.districtId = ""
            form.communeId = ""
        }
    },
)

watch(
    () => form.districtId,
    () => {
        if (!form.districtId) {
            form.communeId = ""
            return
        }

        if (
            form.communeId &&
            !communeOptions.value.some((option) => option.value === form.communeId)
        ) {
            form.communeId = ""
        }
    },
)

onMounted(async () => {
    await loadLookups()
    await loadLocationItems(1)
})
</script>

<template>
    <section class="location-page hrms-list-page">
        <div class="location-page__tabs">
            <button
                v-for="tab in entityTabs"
                :key="tab.value"
                type="button"
                class="location-page__tab"
                :class="{
                    'location-page__tab--active': activeEntity === tab.value,
                }"
                @click="changeEntity(tab.value)"
            >
                <i :class="tab.icon" />
                <span>{{ t(tab.labelKey) }}</span>
            </button>
        </div>

        <AppFilterBar
            class="location-filter-bar"
            :loading="locationStore.loading"
        >
            <span class="app-filter-field app-filter-field--search location-search">
                <i class="pi pi-search" />

                <InputText
                    v-model="filters.search"
                    :placeholder="t('organization.location.searchPlaceholder')"
                    @keyup.enter="applyFilters"
                />
            </span>

            <Select
                v-if="!isCountryEntity"
                v-model="filters.countryId"
                class="app-filter-field location-filter"
                :options="countryFilterOptions"
                option-label="label"
                option-value="value"
                :placeholder="t('organization.location.selectCountry')"
                filter
                :loading="lookupLoading"
                @change="resetFilterParents('countryId')"
            />

            <Select
                v-if="needsProvince"
                v-model="filters.provinceId"
                class="app-filter-field location-filter"
                :options="provinceFilterOptions"
                option-label="label"
                option-value="value"
                :placeholder="t('organization.location.selectProvince')"
                filter
                :loading="lookupLoading"
                @change="resetFilterParents('provinceId')"
            />

            <Select
                v-if="needsDistrict"
                v-model="filters.districtId"
                class="app-filter-field location-filter"
                :options="districtFilterOptions"
                option-label="label"
                option-value="value"
                :placeholder="t('organization.location.selectDistrict')"
                filter
                :loading="lookupLoading"
                @change="resetFilterParents('districtId')"
            />

            <Select
                v-if="needsCommune"
                v-model="filters.communeId"
                class="app-filter-field location-filter"
                :options="communeFilterOptions"
                option-label="label"
                option-value="value"
                :placeholder="t('organization.location.selectCommune')"
                filter
                :loading="lookupLoading"
            />

            <Select
                v-model="filters.status"
                class="app-filter-field location-filter location-status-filter"
                :options="statusFilterOptions"
                option-label="label"
                option-value="value"
            />

            <template #actions>
                <Button
                    icon="pi pi-filter"
                    :label="t('common.apply')"
                    :loading="locationStore.loading"
                    @click="applyFilters"
                />

                <Button
                    severity="secondary"
                    outlined
                    icon="pi pi-times"
                    :aria-label="t('common.clear')"
                    v-tooltip.top="t('common.clear')"
                    :disabled="locationStore.loading"
                    @click="clearFilters"
                />

                <Button
                    severity="secondary"
                    outlined
                    icon="pi pi-refresh"
                    :aria-label="t('common.refresh')"
                    v-tooltip.top="t('common.refresh')"
                    :loading="locationStore.loading"
                    @click="loadLocationItems(locationStore.pagination.page)"
                />

                <Button
                    v-if="canImport"
                    severity="secondary"
                    outlined
                    icon="pi pi-download"
                    :aria-label="t('organization.location.downloadSample')"
                    v-tooltip.top="t('organization.location.downloadSample')"
                    :loading="locationStore.downloadingTemplate"
                    @click="downloadSample"
                />

                <Button
                    v-if="canImport"
                    severity="secondary"
                    outlined
                    icon="pi pi-upload"
                    :aria-label="t('organization.location.importExcel')"
                    v-tooltip.top="t('organization.location.importExcel')"
                    @click="openImportDialog"
                />

                <Button
                    v-if="canExport"
                    severity="secondary"
                    outlined
                    icon="pi pi-file-excel"
                    :aria-label="t('organization.location.exportExcel')"
                    v-tooltip.top="t('organization.location.exportExcel')"
                    :loading="locationStore.exporting"
                    @click="exportExcel"
                />

                <Button
                    v-if="canCreate"
                    icon="pi pi-plus"
                    :label="t('organization.location.newLocation', { entity: activeEntityLabel })"
                    :disabled="locationStore.loading"
                    @click="openCreateDialog"
                />
            </template>
        </AppFilterBar>

        <div class="location-table-shell hrms-list-card">
            <div class="hrms-table-wrap">
                <DataTable
                    class="hrms-standard-table hrms-standard-table--horizontal"
                    lazy
                    paginator
                    striped-rows
                    data-key="id"
                    size="small"
                    scrollable
                    scroll-height="flex"
                    :value="locationStore.items"
                    :loading="locationStore.loading"
                    :rows="locationStore.pagination.limit"
                    :first="(locationStore.pagination.page - 1) * locationStore.pagination.limit"
                    :total-records="locationStore.pagination.total"
                    :rows-per-page-options="[10, 20, 50, 100]"
                    :empty-message="emptyMessage"
                    @page="onPage"
                >
                    <Column
                        field="code"
                        :header="t('organization.location.code')"
                        frozen
                        style="min-width: 8rem"
                    >
                        <template #body="{ data }">
                            <span class="hrms-cell-primary--accent">{{ data.code }}</span>
                        </template>
                    </Column>

                    <Column
                        field="name"
                        :header="t('organization.location.name')"
                        style="min-width: 14rem"
                    >
                        <template #body="{ data }">
                            <span class="location-name-only">{{ data.name || "-" }}</span>
                        </template>
                    </Column>

                    <Column
                        v-if="!isCountryEntity"
                        :header="t('organization.location.country')"
                        style="min-width: 12rem"
                    >
                        <template #body="{ data }">
                            <span class="location-name-only">{{ data.country?.name || "-" }}</span>
                        </template>
                    </Column>

                    <Column
                        v-if="needsProvince"
                        :header="t('organization.location.province')"
                        style="min-width: 12rem"
                    >
                        <template #body="{ data }">
                            <span class="location-name-only">{{ data.province?.name || "-" }}</span>
                        </template>
                    </Column>

                    <Column
                        v-if="needsDistrict"
                        :header="t('organization.location.district')"
                        style="min-width: 12rem"
                    >
                        <template #body="{ data }">
                            <span class="location-name-only">{{ data.district?.name || "-" }}</span>
                        </template>
                    </Column>

                    <Column
                        v-if="needsCommune"
                        :header="t('organization.location.commune')"
                        style="min-width: 12rem"
                    >
                        <template #body="{ data }">
                            <span class="location-name-only">{{ data.commune?.name || "-" }}</span>
                        </template>
                    </Column>

                    <Column
                        v-if="isCountryEntity"
                        field="phoneCode"
                        :header="t('organization.location.phoneCode')"
                        style="min-width: 8rem"
                    />

                    <Column
                        field="status"
                        :header="t('organization.location.status')"
                        style="min-width: 8rem"
                    >
                        <template #body="{ data }">
                            <Tag
                                :severity="getStatusSeverity(data.status)"
                                :value="getStatusLabel(data.status)"
                            />
                        </template>
                    </Column>

                    <Column
                        v-if="canUpdate || canArchive"
                        :header="t('common.actions')"
                        align-frozen="right"
                        frozen
                        style="min-width: 6.5rem"
                    >
                        <template #body="{ data }">
                            <AppTableActions
                                :can-edit="canUpdate && data.status !== 'ARCHIVED'"
                                :can-archive="canArchive && data.status !== 'ARCHIVED'"
                                :edit-label="t('common.edit')"
                                :archive-label="t('common.archive')"
                                :disabled="locationStore.saving || locationStore.archiving"
                                @edit="openEditDialog(data)"
                                @archive="openArchiveDialog(data)"
                            />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="dialogTitle"
            class="location-dialog"
            :style="{ width: 'min(52rem, calc(100vw - 2rem))' }"
        >
            <div class="location-form-grid">
                <label
                    v-if="!isCountryEntity"
                    class="location-field"
                >
                    <span>{{ t("organization.location.country") }}</span>
                    <Select
                        v-model="form.countryId"
                        :options="countryOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="t('organization.location.selectCountry')"
                        filter
                        :invalid="getFieldInvalid('countryId')"
                    />
                    <small v-if="getFieldError('countryId')">
                        {{ getFieldError("countryId") }}
                    </small>
                </label>

                <label
                    v-if="needsProvince"
                    class="location-field"
                >
                    <span>{{ t("organization.location.province") }}</span>
                    <Select
                        v-model="form.provinceId"
                        :options="provinceOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="t('organization.location.selectProvince')"
                        filter
                        :disabled="!form.countryId"
                        :invalid="getFieldInvalid('provinceId')"
                    />
                    <small v-if="getFieldError('provinceId')">
                        {{ getFieldError("provinceId") }}
                    </small>
                </label>

                <label
                    v-if="needsDistrict"
                    class="location-field"
                >
                    <span>{{ t("organization.location.district") }}</span>
                    <Select
                        v-model="form.districtId"
                        :options="districtOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="t('organization.location.selectDistrict')"
                        filter
                        :disabled="!form.provinceId"
                        :invalid="getFieldInvalid('districtId')"
                    />
                    <small v-if="getFieldError('districtId')">
                        {{ getFieldError("districtId") }}
                    </small>
                </label>

                <label
                    v-if="needsCommune"
                    class="location-field"
                >
                    <span>{{ t("organization.location.commune") }}</span>
                    <Select
                        v-model="form.communeId"
                        :options="communeOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="t('organization.location.selectCommune')"
                        filter
                        :disabled="!form.districtId"
                        :invalid="getFieldInvalid('communeId')"
                    />
                    <small v-if="getFieldError('communeId')">
                        {{ getFieldError("communeId") }}
                    </small>
                </label>

                <label class="location-field">
                    <span>{{ t("organization.location.code") }}</span>
                    <InputText
                        v-model="form.code"
                        :placeholder="t('organization.location.codePlaceholder')"
                        :invalid="getFieldInvalid('code')"
                    />
                    <small v-if="getFieldError('code')">
                        {{ getFieldError("code") }}
                    </small>
                </label>

                <label class="location-field">
                    <span>{{ t("organization.location.name") }}</span>
                    <InputText
                        v-model="form.name"
                        :placeholder="t('organization.location.namePlaceholder')"
                        :invalid="getFieldInvalid('name')"
                    />
                    <small v-if="getFieldError('name')">
                        {{ getFieldError("name") }}
                    </small>
                </label>


                <label
                    v-if="isCountryEntity"
                    class="location-field"
                >
                    <span>{{ t("organization.location.nationality") }}</span>
                    <InputText v-model="form.nationality" />
                </label>

                <label
                    v-if="isCountryEntity"
                    class="location-field"
                >
                    <span>{{ t("organization.location.phoneCode") }}</span>
                    <InputText
                        v-model="form.phoneCode"
                        placeholder="+855"
                    />
                </label>

                <label class="location-field">
                    <span>{{ t("organization.location.status") }}</span>
                    <Select
                        v-model="form.status"
                        :options="statusOptions"
                        option-label="label"
                        option-value="value"
                    />
                </label>

                <label class="location-field location-field--full">
                    <span>{{ t("organization.location.descriptionLabel") }}</span>
                    <Textarea
                        v-model="form.description"
                        rows="3"
                        auto-resize
                    />
                </label>
            </div>

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    outlined
                    severity="secondary"
                    @click="closeDialog"
                />
                <Button
                    :label="t('common.save')"
                    icon="pi pi-check"
                    :loading="locationStore.saving"
                    @click="submitForm"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            :header="t('organization.location.archiveTitle')"
            :style="{ width: 'min(30rem, calc(100vw - 2rem))' }"
        >
            <p>
                {{
                    t("organization.location.archiveMessage", {
                        name: archiveCandidate?.name || "-",
                    })
                }}
            </p>

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    outlined
                    severity="secondary"
                    @click="closeArchiveDialog"
                />
                <Button
                    :label="t('common.archive')"
                    severity="danger"
                    icon="pi pi-trash"
                    :loading="locationStore.archiving"
                    @click="confirmArchive"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importDialogVisible"
            modal
            :header="t('organization.location.importTitle', { entity: activeEntityLabel })"
            :style="{ width: 'min(34rem, calc(100vw - 2rem))' }"
        >
            <div class="location-import-box">
                <p>{{ t("organization.location.importDescription") }}</p>

                <input
                    ref="fileInputRef"
                    type="file"
                    accept=".xlsx,.xls"
                    @change="onFileSelected"
                />

                <span v-if="selectedImportFile">
                    {{ selectedImportFile.name }}
                </span>

                <ProgressBar
                    v-if="locationStore.importing"
                    :value="locationStore.importProgress"
                />
            </div>

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    outlined
                    severity="secondary"
                    :disabled="locationStore.importing"
                    @click="closeImportDialog"
                />
                <Button
                    :label="t('organization.location.importExcel')"
                    icon="pi pi-upload"
                    :loading="locationStore.importing"
                    @click="submitImport"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importResultDialogVisible"
            modal
            :header="t('organization.location.importResultTitle')"
            :style="{ width: 'min(44rem, calc(100vw - 2rem))' }"
        >
            <div
                v-if="locationStore.importSummary"
                class="location-import-summary"
            >
                <div class="location-summary-card">
                    <span>{{ t("organization.location.importTotal") }}</span>
                    <strong>{{ locationStore.importSummary.total }}</strong>
                </div>
                <div class="location-summary-card">
                    <span>{{ t("organization.location.importCreated") }}</span>
                    <strong>{{ locationStore.importSummary.created }}</strong>
                </div>
                <div class="location-summary-card">
                    <span>{{ t("organization.location.importFailedCount") }}</span>
                    <strong>{{ locationStore.importSummary.failed }}</strong>
                </div>
            </div>

            <div
                v-if="locationStore.importSummary?.errors?.length"
                class="location-import-errors"
            >
                <h4>{{ t("organization.location.importErrors") }}</h4>
                <ul>
                    <li
                        v-for="(error, index) in locationStore.importSummary.errors"
                        :key="`${error.row}-${index}`"
                    >
                        <strong>Row {{ error.row }}:</strong>
                        <span>{{ error.message }}</span>
                    </li>
                </ul>
            </div>

            <template #footer>
                <Button
                    :label="t('common.close')"
                    @click="importResultDialogVisible = false"
                />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.location-page {
    display: grid;
    gap: 1rem;
    width: 100%;
}

.location-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.location-page__header h2,
.location-page__header p {
    margin: 0;
}

.location-page__header h2 {
    color: var(--hrms-text);
    font-size: 1.15rem;
}

.location-page__header p:not(.location-page__eyebrow) {
    max-width: 42rem;
    margin-top: 0.45rem;
    color: var(--hrms-text-muted);
    font-size: 0.82rem;
    line-height: 1.5;
}

.location-page__eyebrow {
    margin: 0 0 0.4rem;
    color: var(--hrms-text);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.location-page__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
}

.location-page__tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
}

.location-page__tab {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 2.35rem;
    padding: 0 0.85rem;
    color: var(--hrms-text-muted);
    background: var(--hrms-surface);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
}

.location-page__tab--active {
    color: white;
    background: var(--hrms-primary);
    border-color: var(--hrms-primary);
}

.location-card :deep(.p-card-body),
.location-card :deep(.p-card-content) {
    padding: 0;
}

.location-card :deep(.p-card-content) {
    display: grid;
    gap: 1rem;
}

.location-filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.55rem;
    padding: 1rem 1rem 0;
}

.location-search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: min(22rem, 100%);
    padding: 0 0.75rem;
    background: var(--hrms-app-background);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
}

.location-search i {
    color: var(--hrms-text-muted);
}

.location-search :deep(.p-inputtext) {
    width: 100%;
    border: 0;
    box-shadow: none;
    background: transparent;
}

.location-select {
    width: min(14rem, 100%);
}

.location-select--status {
    width: min(12rem, 100%);
}

.location-table {
    padding: 0 1rem;
    font-size: 0.78rem;
}

.location-table :deep(.p-datatable-thead > tr > th),
.location-table :deep(.p-datatable-tbody > tr > td) {
    padding: 0.6rem 0.55rem;
    vertical-align: middle;
    border-color: var(--hrms-border);
}

.location-table :deep(.p-datatable-thead > tr > th) {
    color: var(--hrms-text);
    background: var(--hrms-surface);
    font-size: 0.72rem;
    font-weight: 800;
}

.location-name-cell,
.location-table small,
.location-table span {
    display: block;
}

.location-name-cell {
    line-height: 1.35;
}

.location-name-cell strong {
    color: var(--hrms-text);
}

.location-name-cell span,
.location-table small {
    color: var(--hrms-text-muted);
    font-size: 0.7rem;
}

.location-row-actions {
    display: flex;
    align-items: center;
    gap: 0.15rem;
}

.location-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0 1rem 1rem;
    color: var(--hrms-text-muted);
    font-size: 0.75rem;
}

.location-pagination > div {
    display: flex;
    gap: 0.4rem;
}

.location-dialog :deep(.p-dialog-content) {
    padding-top: 0.5rem;
}

.location-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
}

.location-field {
    display: grid;
    gap: 0.35rem;
}

.location-field > span {
    color: var(--hrms-text);
    font-size: 0.72rem;
    font-weight: 700;
}

.location-field small {
    color: var(--p-red-500);
    font-size: 0.68rem;
}

.location-field--full {
    grid-column: 1 / -1;
}

.location-import-box {
    display: grid;
    gap: 0.85rem;
}

.location-import-box p {
    margin: 0;
    color: var(--hrms-text-muted);
    font-size: 0.82rem;
    line-height: 1.5;
}

.location-import-box input {
    width: 100%;
    padding: 0.8rem;
    border: 1px dashed var(--hrms-border);
    border-radius: var(--hrms-radius-md);
}

.location-import-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
}

.location-summary-card {
    display: grid;
    gap: 0.25rem;
    padding: 0.85rem;
    background: var(--hrms-app-background);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
}

.location-summary-card span {
    color: var(--hrms-text-muted);
    font-size: 0.7rem;
    font-weight: 700;
}

.location-summary-card strong {
    color: var(--hrms-text);
    font-size: 1.1rem;
}

.location-import-errors {
    margin-top: 1rem;
}

.location-import-errors h4 {
    margin: 0 0 0.5rem;
    color: var(--hrms-text);
    font-size: 0.85rem;
}

.location-import-errors ul {
    display: grid;
    gap: 0.4rem;
    max-height: 15rem;
    margin: 0;
    padding-left: 1.1rem;
    overflow: auto;
    color: var(--hrms-text-muted);
    font-size: 0.75rem;
}

@media (max-width: 860px) {
    .location-page__header {
        display: grid;
    }

    .location-page__actions {
        justify-content: stretch;
    }

    .location-page__actions :deep(.p-button),
    .location-filter-bar :deep(.p-button),
    .location-select,
    .location-search {
        width: 100%;
    }

    .location-form-grid,
    .location-import-summary {
        grid-template-columns: 1fr;
    }

    .location-pagination {
        align-items: flex-start;
        flex-direction: column;
    }
}
/* Compact enterprise layout aligned with Shift and Department. */
.location-page {
    gap: 0.8rem;
}

.location-page__tabs {
    gap: 0.35rem;
}

.location-page__tab {
    min-height: 2.1rem;
    padding: 0 0.72rem;
    border-radius: 6px;
    font-size: 0.74rem;
}

.location-card {
    min-width: 0;
}

.location-card :deep(.p-card-body),
.location-card :deep(.p-card-content) {
    height: 100%;
}

.location-card :deep(.p-card-content) {
    gap: 0.75rem;
}

.location-search {
    position: relative;
    display: flex;
    align-items: center;
    width: min(31rem, 100%);
    min-width: 15rem;
    height: 2.5rem;
    padding: 0;
    overflow: hidden;
    background: var(--hrms-surface, #ffffff);
    border: 1px solid var(--hrms-border, #cbd5e1);
    border-radius: 6px;
}

.location-search > i {
    position: absolute;
    left: 0.85rem;
    z-index: 2;
    color: var(--hrms-text-muted);
    pointer-events: none;
}

.location-search :deep(.p-inputtext) {
    width: 100%;
    height: 100%;
    padding: 0.55rem 0.75rem 0.55rem 2.55rem;
    background: transparent;
    border: 0 !important;
    border-radius: 0;
    box-shadow: none !important;
    font-size: 0.78rem;
}

.location-search:focus-within {
    border-color: var(--p-primary-color, #3b82f6);
    box-shadow: 0 0 0 1px var(--p-primary-color, #3b82f6);
}

.location-filter-select {
    width: 100%;
    min-width: 11rem;
}

.location-status-field {
    max-width: 12rem;
}

.location-filter-select :deep(.p-select-label) {
    padding-block: 0.55rem;
    font-size: 0.78rem;
}

.location-table {
    padding: 0 0.75rem;
    font-size: 0.76rem;
}

.location-table :deep(.p-datatable-thead > tr > th),
.location-table :deep(.p-datatable-tbody > tr > td) {
    padding: 0.5rem 0.48rem;
    text-align: center;
}

.location-table :deep(.p-datatable-thead > tr > th .p-column-header-content) {
    justify-content: center;
}

.location-pagination {
    padding: 0 0.75rem 0.75rem;
}

@media (max-width: 1180px) {
    .location-search {
        width: min(100%, 28rem);
        flex: 1 1 24rem;
    }

    .location-filter-select {
        min-width: 10rem;
    }
}

@media (max-width: 760px) {
    .location-page__tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .location-page__tab {
        justify-content: center;
        width: 100%;
    }

    .location-search,
    .location-status-field {
        width: 100%;
        max-width: none;
        min-width: 0;
    }

    .location-filter-select {
        min-width: 0;
    }

    .location-pagination {
        align-items: flex-start;
        flex-direction: column;
    }
}

@media (max-width: 480px) {
    .location-page__tabs {
        grid-template-columns: 1fr;
    }
}



/* Company-standard list alignment and typography. */
.location-page {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
    width: 100%;
}

.location-page__tabs {
    display: flex;
    gap: 0.35rem;
    overflow-x: auto;
    padding-bottom: 0.1rem;
}

.location-page__tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 2rem;
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
    background: var(--hrms-surface);
    color: var(--hrms-text-muted);
    font: inherit;
    font-size: var(--hrms-font-size-sm);
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
}

.location-page__tab--active {
    border-color: var(--p-primary-color);
    background: color-mix(in srgb, var(--p-primary-color) 10%, white);
    color: var(--p-primary-color);
}

.location-search {
    position: relative;
    flex: 1 1 14rem;
    min-width: 11rem;
    max-width: 22rem;
}

.location-search > i {
    position: absolute;
    top: 50%;
    left: 0.7rem;
    z-index: 1;
    transform: translateY(-50%);
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
    pointer-events: none;
}

.location-search :deep(.p-inputtext) {
    width: 100%;
    padding-left: 2rem;
}

.location-filter {
    flex: 0 1 11rem;
    min-width: 9.5rem;
    max-width: 13rem;
}

.location-status-filter {
    max-width: 10rem;
}

:deep(.app-filter-bar__fields),
:deep(.app-filter-bar__actions) {
    flex-wrap: nowrap;
}

:deep(.hrms-standard-table .p-datatable-thead > tr > th) {
    font-weight: 700;
}

:deep(.hrms-standard-table .p-datatable-tbody > tr > td),
:deep(.hrms-standard-table .hrms-cell-primary),
:deep(.hrms-standard-table .hrms-cell-primary--accent),
:deep(.hrms-standard-table .p-tag) {
    font-weight: 400;
}

.location-stacked-cell {
    display: grid;
    gap: 0.12rem;
    font-weight: 400;
}

.location-stacked-cell small {
    color: var(--hrms-text-muted);
    font-size: var(--hrms-font-size-xs);
    font-weight: 400;
}

@media (max-width: 1200px) {
    :deep(.app-filter-bar__fields),
    :deep(.app-filter-bar__actions) {
        flex-wrap: wrap;
    }
}


/* Final Company-standard Location toolbar and table corrections. */
.location-filter-bar {
    margin-bottom: 0;
}

.location-filter-bar :deep(.app-filter-bar__fields) {
    flex: 1 1 auto;
    flex-wrap: nowrap;
    gap: 0.45rem;
    overflow: hidden;
}

.location-filter-bar :deep(.app-filter-bar__actions) {
    flex: 0 0 auto;
    flex-wrap: nowrap;
    gap: 0.35rem;
    white-space: nowrap;
}

.location-filter-bar :deep(.app-filter-field) {
    flex: 1 1 8.5rem;
    min-width: 7.5rem;
    max-width: 10.5rem;
}

.location-filter-bar :deep(.app-filter-field--search) {
    flex: 1.35 1 12rem;
    min-width: 11rem;
    max-width: 15rem;
}

.location-filter-bar :deep(.p-inputtext),
.location-filter-bar :deep(.p-select),
.location-filter-bar :deep(.p-button) {
    min-height: var(--hrms-control-height);
}

.location-filter-bar :deep(.p-select-label),
.location-filter-bar :deep(.p-inputtext) {
    font-size: var(--hrms-font-size-sm);
}

.location-filter-bar :deep(.p-button-icon-only),
.location-filter-bar :deep(.p-button:not(:has(.p-button-label))) {
    width: var(--hrms-control-height);
    min-width: var(--hrms-control-height);
    padding-inline: 0;
}

.location-name-only {
    display: block;
    max-width: 100%;
    overflow: hidden;
    color: var(--hrms-text);
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.location-table-shell :deep(.p-datatable-tbody > tr > td),
.location-table-shell :deep(.p-datatable-tbody > tr > td *) {
    font-weight: 400;
}

.location-table-shell :deep(.p-datatable-thead > tr > th),
.location-table-shell :deep(.p-datatable-thead > tr > th *) {
    font-weight: 700;
}

@media (max-width: 1280px) {
    .location-filter-bar :deep(.app-filter-bar__fields) {
        flex-wrap: wrap;
        overflow: visible;
    }

    .location-filter-bar :deep(.app-filter-bar__actions) {
        flex-wrap: wrap;
    }
}

@media (max-width: 760px) {
    .location-filter-bar :deep(.app-filter-bar__fields) {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        width: 100%;
    }

    .location-filter-bar :deep(.app-filter-field),
    .location-filter-bar :deep(.app-filter-field--search) {
        width: 100%;
        min-width: 0;
        max-width: none;
    }

    .location-filter-bar :deep(.app-filter-bar__actions) {
        width: 100%;
        justify-content: flex-start;
    }
}

</style>
