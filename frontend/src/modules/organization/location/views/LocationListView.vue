<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import {
    computed,
    onMounted,
    ref,
} from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import { useAuthStore } from "@/app/stores/auth.store.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"

import {
    downloadLocationTemplate,
    exportLocations,
    lookupLocations,
} from "../api/location.api.js"
import LocationArchiveDialog from "../components/LocationArchiveDialog.vue"
import LocationFormDialog from "../components/LocationFormDialog.vue"
import LocationImportDialog from "../components/LocationImportDialog.vue"
import { useLocationForm } from "../composables/useLocationForm.js"
import { useLocationImport } from "../composables/useLocationImport.js"
import { useLocationList } from "../composables/useLocationList.js"
import { createLocationColumns } from "../config/location.columns.js"
import {
    LOCATION_ENTITIES,
    createLocationStatusOptions,
} from "../config/location.filters.js"
import { LOCATION_PERMISSIONS } from "../config/location.permissions.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()

const activeEntity = ref("countries")
const list = useLocationList()
const formState = useLocationForm()
const importState = useLocationImport(activeEntity)

const formVisible = ref(false)
const archiveVisible = ref(false)
const archiveCandidate = ref(null)
const importVisible = ref(false)
const exporting = ref(false)
const downloadingTemplate = ref(false)

const countries = ref([])
const provinces = ref([])
const districts = ref([])
const communes = ref([])

// Top-level bindings prevent nested Ref objects from reaching PrimeVue.
const rows = list.rows
const loading = list.loading
const listError = list.error
const archiving = list.archiving
const pagination = list.pagination
const query = list.query
const formMode = formState.mode
const formSaving = formState.saving
const formErrors = formState.errors
const importing = importState.importing
const importProgress = importState.progress
const importPhaseMessageKey = importState.phaseMessageKey
const importProcessedRows = importState.processedRows
const importTotalRows = importState.totalRows
const importResult = importState.result
const importError = importState.error

const columns = computed(() => createLocationColumns(t, activeEntity.value))
const statusOptions = computed(() => createLocationStatusOptions(t))
const currentEntity = computed(() =>
    LOCATION_ENTITIES.find((item) => item.value === activeEntity.value),
)
const entityLabel = computed(() => t(currentEntity.value.labelKey))
const singularEntityLabel = computed(() =>
    t(`organization.location.singular.${activeEntity.value}`),
)

const canUpdate = computed(() =>
    authStore.hasPermission(LOCATION_PERMISSIONS.UPDATE),
)
const canArchive = computed(() =>
    authStore.hasPermission(LOCATION_PERMISSIONS.ARCHIVE),
)

const activeFilterCount = computed(() => {
    return [
        query.search?.trim(),
        query.status !== "ALL",
        query.countryId,
        query.provinceId,
        query.districtId,
        query.communeId,
    ].filter(Boolean).length
})

function toOption(row) {
    return {
        label: `${row.code} - ${row.name}`,
        value: row.id,
    }
}

const countryOptions = computed(() => [
    {
        label: t("organization.location.allCountries"),
        value: "",
    },
    ...countries.value.map(toOption),
])

const provinceOptions = computed(() => [
    {
        label: t("organization.location.allProvinces"),
        value: "",
    },
    ...provinces.value
        .filter((row) => !query.countryId || row.countryId === query.countryId)
        .map(toOption),
])

const districtOptions = computed(() => [
    {
        label: t("organization.location.allDistricts"),
        value: "",
    },
    ...districts.value
        .filter(
            (row) =>
                (!query.countryId || row.countryId === query.countryId) &&
                (!query.provinceId || row.provinceId === query.provinceId),
        )
        .map(toOption),
])

const communeOptions = computed(() => [
    {
        label: t("organization.location.allCommunes"),
        value: "",
    },
    ...communes.value
        .filter((row) => !query.districtId || row.districtId === query.districtId)
        .map(toOption),
])

const formCountries = computed(() => countries.value.map(toOption))
const formProvinces = computed(() =>
    provinces.value
        .filter(
            (row) =>
                !formState.form.countryId ||
                row.countryId === formState.form.countryId,
        )
        .map(toOption),
)
const formDistricts = computed(() =>
    districts.value
        .filter(
            (row) =>
                (!formState.form.countryId ||
                    row.countryId === formState.form.countryId) &&
                (!formState.form.provinceId ||
                    row.provinceId === formState.form.provinceId),
        )
        .map(toOption),
)
const formCommunes = computed(() =>
    communes.value
        .filter(
            (row) =>
                !formState.form.districtId ||
                row.districtId === formState.form.districtId,
        )
        .map(toOption),
)

function translatedError(error) {
    const key = error?.response?.data?.error?.messageKey || error?.messageKey

    if (!key) {
        return t("errors.internal")
    }

    const translated = t(key)
    return translated === key ? t("errors.internal") : translated
}

async function loadLookups() {
    const [countryRows, provinceRows, districtRows, communeRows] =
        await Promise.all([
            lookupLocations("countries"),
            lookupLocations("provinces"),
            lookupLocations("districts"),
            lookupLocations("communes"),
        ])

    countries.value = countryRows
    provinces.value = provinceRows
    districts.value = districtRows
    communes.value = communeRows
}

async function load() {
    try {
        await Promise.all([
            list.load(activeEntity.value),
            loadLookups(),
        ])
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.location.loadFailed"),
            detail: translatedError(error),
            life: 4500,
        })
    }
}

async function switchEntity(entity) {
    if (entity === activeEntity.value || loading.value) {
        return
    }

    activeEntity.value = entity
    formVisible.value = false
    archiveVisible.value = false
    importVisible.value = false
    importState.reset()
    await list.reset(entity)
}

function openCreate() {
    formState.openCreate()
    formVisible.value = true
}

function openEdit(row) {
    formState.openEdit(row)
    formVisible.value = true
}

function onCountryChange() {
    formState.form.provinceId = ""
    formState.form.districtId = ""
    formState.form.communeId = ""
}

function onProvinceChange() {
    formState.form.districtId = ""
    formState.form.communeId = ""
}

function onDistrictChange() {
    formState.form.communeId = ""
}

async function saveLocation() {
    try {
        const editing = formState.isEdit.value
        await formState.save(activeEntity.value)
        formVisible.value = false

        toast.add({
            severity: "success",
            summary: editing
                ? t("organization.location.updated")
                : t("organization.location.created"),
            detail: editing
                ? t("organization.location.updatedDetail")
                : t("organization.location.createdDetail"),
            life: 3000,
        })

        await Promise.all([
            list.load(activeEntity.value),
            loadLookups(),
        ])
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.location.saveFailed"),
            detail: translatedError(error),
            life: 4500,
        })
    }
}

function askArchive(row) {
    archiveCandidate.value = row
    archiveVisible.value = true
}

async function confirmArchive() {
    const id = archiveCandidate.value?.id ?? archiveCandidate.value?._id

    if (!id) {
        return
    }

    try {
        await list.archive(activeEntity.value, id)
        archiveVisible.value = false
        archiveCandidate.value = null
        await loadLookups()

        toast.add({
            severity: "success",
            summary: t("organization.location.archived"),
            detail: t("organization.location.archivedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.location.archiveFailed"),
            detail: translatedError(error),
            life: 4500,
        })
    }
}

async function downloadTemplate() {
    downloadingTemplate.value = true

    try {
        await downloadLocationTemplate(activeEntity.value)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.location.downloadFailed"),
            detail: translatedError(error),
            life: 4500,
        })
    } finally {
        downloadingTemplate.value = false
    }
}

async function exportRows() {
    exporting.value = true

    try {
        await exportLocations(activeEntity.value, {
            search: query.search || undefined,
            status: query.status,
            countryId: query.countryId || undefined,
            provinceId: query.provinceId || undefined,
            districtId: query.districtId || undefined,
            communeId: query.communeId || undefined,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.location.exportFailed"),
            detail: translatedError(error),
            life: 4500,
        })
    } finally {
        exporting.value = false
    }
}

async function submitImport() {
    try {
        const response = await importState.submit()
        const summary = response?.summary
        const failed = summary?.errors?.length ?? summary?.failed ?? 0

        toast.add({
            severity: failed > 0 ? "warn" : "success",
            summary:
                failed > 0
                    ? t("organization.location.importCompletedWithErrors")
                    : t("organization.location.importSuccess"),
            detail: t("organization.location.importSummary", {
                created: summary?.created ?? 0,
                failed,
            }),
            life: 5000,
        })

        if (failed === 0) {
            importVisible.value = false
            importState.reset()
        }

        await Promise.all([
            list.load(activeEntity.value),
            loadLookups(),
        ])
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.location.importFailed"),
            detail: translatedError(error),
            life: 4500,
        })
    }
}

function rowActions(row) {
    return [
        {
            label: t("common.edit"),
            icon: "pi pi-pencil",
            visible: canUpdate.value && row.status !== "ARCHIVED",
            command: () => openEdit(row),
        },
        {
            label: t("common.archive"),
            icon: "pi pi-archive",
            visible: canArchive.value && row.status !== "ARCHIVED",
            command: () => askArchive(row),
        },
    ]
}

function statusSeverity(status) {
    if (status === "ACTIVE") {
        return "success"
    }

    if (status === "INACTIVE") {
        return "warn"
    }

    return "danger"
}

function statusLabel(status) {
    return t(`organization.location.status${status[0]}${status.slice(1).toLowerCase()}`)
}

function formatDate(value) {
    if (!value) {
        return "—"
    }

    const date = new Date(value)
    return Number.isNaN(date.getTime())
        ? "—"
        : new Intl.DateTimeFormat(undefined, {
              year: "numeric",
              month: "short",
              day: "2-digit",
          }).format(date)
}

onMounted(load)
</script>

<template>
    <EnterpriseListPage
        :rows="rows"
        :columns="columns"
        :loading="loading"
        :error="listError"
        :pagination="pagination"
        row-key="id"
        :actions-header="t('common.actions')"
        :empty-title="t('organization.location.empty', { entity: entityLabel.toLowerCase() })"
        :empty-description="t('organization.location.emptyDescription')"
        @retry="load"
        @page-change="list.changePage(activeEntity, $event)"
        @sort-change="list.changeSort(activeEntity, $event)"
    >
        <template #controls>
            <EnterpriseListControls
                :filter-label="t('common.filters')"
                :hide-filter-label="t('common.hideFilters')"
                :active-filter-count="activeFilterCount"
            >
                <template #start>
                    <Button
                        severity="secondary"
                        text
                        icon="pi pi-refresh"
                        :label="t('common.refresh')"
                        :loading="loading"
                        @click="load"
                    />

                    <PermissionButton
                        :permission="LOCATION_PERMISSIONS.EXPORT"
                        severity="secondary"
                        text
                        icon="pi pi-download"
                        :label="t('organization.location.downloadSample')"
                        :loading="downloadingTemplate"
                        @click="downloadTemplate"
                    />

                    <PermissionButton
                        :permission="LOCATION_PERMISSIONS.IMPORT"
                        severity="secondary"
                        text
                        icon="pi pi-upload"
                        :label="t('common.import')"
                        @click="importVisible = true"
                    />

                    <PermissionButton
                        :permission="LOCATION_PERMISSIONS.EXPORT"
                        severity="secondary"
                        text
                        icon="pi pi-file-export"
                        :label="t('common.export')"
                        :loading="exporting"
                        @click="exportRows"
                    />
                </template>

                <template #actions>
                    <PermissionButton
                        :permission="LOCATION_PERMISSIONS.CREATE"
                        icon="pi pi-plus"
                        :label="t('organization.location.newLocation', { entity: singularEntityLabel })"
                        @click="openCreate"
                    />
                </template>

                <template #filters>
                    <div class="location-entity-tabs">
                        <Button
                            v-for="tab in LOCATION_ENTITIES"
                            :key="tab.value"
                            :label="t(tab.labelKey)"
                            :icon="tab.icon"
                            :severity="activeEntity === tab.value ? 'primary' : 'secondary'"
                            :outlined="activeEntity !== tab.value"
                            @click="switchEntity(tab.value)"
                        />
                    </div>

                    <EnterpriseFilterBar :loading="loading">
                        <EnterpriseFilterField search :label="t('common.search')">
                            <span class="enterprise-search-input">
                                <i class="pi pi-search" />
                                <InputText
                                    v-model="query.search"
                                    :placeholder="t('organization.location.searchPlaceholder')"
                                    @keyup.enter="list.apply(activeEntity)"
                                />
                            </span>
                        </EnterpriseFilterField>

                        <EnterpriseFilterField
                            v-if="activeEntity !== 'countries'"
                            :label="t('organization.location.country')"
                        >
                            <Select
                                v-model="query.countryId"
                                :options="countryOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                @change="query.provinceId = ''; query.districtId = ''; query.communeId = ''"
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField
                            v-if="['districts', 'communes', 'villages'].includes(activeEntity)"
                            :label="t('organization.location.province')"
                        >
                            <Select
                                v-model="query.provinceId"
                                :options="provinceOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                @change="query.districtId = ''; query.communeId = ''"
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField
                            v-if="['communes', 'villages'].includes(activeEntity)"
                            :label="t('organization.location.district')"
                        >
                            <Select
                                v-model="query.districtId"
                                :options="districtOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                @change="query.communeId = ''"
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField
                            v-if="activeEntity === 'villages'"
                            :label="t('organization.location.commune')"
                        >
                            <Select
                                v-model="query.communeId"
                                :options="communeOptions"
                                option-label="label"
                                option-value="value"
                                filter
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField :label="t('common.status')">
                            <Select
                                v-model="query.status"
                                :options="statusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </EnterpriseFilterField>

                        <template #actions>
                            <Button
                                severity="secondary"
                                outlined
                                icon="pi pi-times"
                                :label="t('common.clear')"
                                :disabled="loading || activeFilterCount === 0"
                                @click="list.reset(activeEntity)"
                            />

                            <Button
                                icon="pi pi-check"
                                :label="t('common.apply')"
                                :loading="loading"
                                @click="list.apply(activeEntity)"
                            />
                        </template>
                    </EnterpriseFilterBar>
                </template>
            </EnterpriseListControls>
        </template>

        <template #empty-action>
            <PermissionButton
                :permission="LOCATION_PERMISSIONS.CREATE"
                icon="pi pi-plus"
                :label="t('organization.location.newLocation', { entity: singularEntityLabel })"
                @click="openCreate"
            />
        </template>

        <template #cell-code="{ row }">
            <span class="enterprise-table__code">{{ row.code || "—" }}</span>
        </template>
        <template #cell-name="{ row }">{{ row.name || "—" }}</template>
        <template #cell-country="{ row }">{{ row.country?.name || "—" }}</template>
        <template #cell-province="{ row }">{{ row.province?.name || "—" }}</template>
        <template #cell-district="{ row }">{{ row.district?.name || "—" }}</template>
        <template #cell-commune="{ row }">{{ row.commune?.name || "—" }}</template>
        <template #cell-status="{ row }">
            <Tag :value="statusLabel(row.status)" :severity="statusSeverity(row.status)" />
        </template>
        <template #cell-updatedAt="{ row }">{{ formatDate(row.updatedAt) }}</template>
        <template #actions="{ row }">
            <EnterpriseActionMenu :items="rowActions(row)" :aria-label="t('common.actions')" />
        </template>
    </EnterpriseListPage>

    <LocationFormDialog
        :visible="formVisible"
        :mode="formMode"
        :entity="activeEntity"
        :entity-label="singularEntityLabel"
        :form="formState.form"
        :errors="formErrors"
        :saving="formSaving"
        :countries="formCountries"
        :provinces="formProvinces"
        :districts="formDistricts"
        :communes="formCommunes"
        @update:visible="formVisible = $event"
        @save="saveLocation"
        @clear-error="formState.clearError"
        @normalize-code="formState.normalizeCode"
        @country-change="onCountryChange"
        @province-change="onProvinceChange"
        @district-change="onDistrictChange"
    />

    <LocationArchiveDialog
        :visible="archiveVisible"
        :row="archiveCandidate"
        :busy="archiving"
        @update:visible="archiveVisible = $event"
        @confirm="confirmArchive"
    />

    <LocationImportDialog
        :visible="importVisible"
        :entity-label="entityLabel"
        :importing="importing"
        :progress="importProgress"
        :phase-message-key="importPhaseMessageKey"
        :processed-rows="importProcessedRows"
        :total-rows="importTotalRows"
        :result="importResult"
        :error-message="importError ? translatedError(importError) : ''"
        @update:visible="importVisible = $event"
        @file-change="importState.setFile"
        @download-template="downloadTemplate"
        @import="submitImport"
        @close="importState.reset"
    />
</template>

<style scoped>
.location-entity-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    width: 100%;
    margin-bottom: 0.75rem;
}
</style>
