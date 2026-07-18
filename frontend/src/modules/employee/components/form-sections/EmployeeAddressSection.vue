<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import { onMounted } from "vue"

import { useLocationHierarchy } from "@/modules/organization/location/composables/useLocationHierarchy.js"

const props = defineProps({
    form: { type: Object, required: true },
    disabled: { type: Boolean, default: false },
})

const groups = Object.freeze([
    { key: "birthAddress", label: "Birth Address" },
    { key: "permanentAddress", label: "Permanent Address" },
])

const countryHierarchy = useLocationHierarchy()
const groupHierarchies = {
    birthAddress: useLocationHierarchy(),
    permanentAddress: useLocationHierarchy(),
}

function toOptions(rows = []) {
    return rows.map((row) => ({
        label: [row.code, row.name].filter(Boolean).join(" - "),
        value: row.id,
    }))
}

function hierarchyFor(groupKey) {
    return groupHierarchies[groupKey]
}

function optionsFor(groupKey, field) {
    if (field === "countryId") {
        return toOptions(countryHierarchy.countries.value)
    }

    const hierarchy = hierarchyFor(groupKey)

    return {
        provinceId: toOptions(hierarchy.provinces.value),
        districtId: toOptions(hierarchy.districts.value),
        communeId: toOptions(hierarchy.communes.value),
        villageId: toOptions(hierarchy.villages.value),
    }[field]
}

function loadingFor(groupKey, field) {
    if (field === "countryId") {
        return countryHierarchy.loadingCountries.value
    }

    const hierarchy = hierarchyFor(groupKey)

    return {
        provinceId: hierarchy.loadingProvinces.value,
        districtId: hierarchy.loadingDistricts.value,
        communeId: hierarchy.loadingCommunes.value,
        villageId: hierarchy.loadingVillages.value,
    }[field]
}

function disabledFor(groupKey, field) {
    const address = props.form[groupKey]

    return (
        props.disabled ||
        (field === "provinceId" && !address.countryId) ||
        (field === "districtId" && !address.provinceId) ||
        (field === "communeId" && !address.districtId) ||
        (field === "villageId" && !address.communeId)
    )
}

async function onCountryChange(groupKey) {
    const address = props.form[groupKey]
    address.provinceId = ""
    address.districtId = ""
    address.communeId = ""
    address.villageId = ""
    await hierarchyFor(groupKey).loadProvinces(address.countryId)
}

async function onProvinceChange(groupKey) {
    const address = props.form[groupKey]
    address.districtId = ""
    address.communeId = ""
    address.villageId = ""
    await hierarchyFor(groupKey).loadDistricts(address.provinceId)
}

async function onDistrictChange(groupKey) {
    const address = props.form[groupKey]
    address.communeId = ""
    address.villageId = ""
    await hierarchyFor(groupKey).loadCommunes(address.districtId)
}

async function onCommuneChange(groupKey) {
    const address = props.form[groupKey]
    address.villageId = ""
    await hierarchyFor(groupKey).loadVillages(address.communeId)
}

async function hydrate() {
    await countryHierarchy.loadCountries()

    await Promise.all(
        groups.map(async ({ key }) => {
            const address = props.form[key]
            const hierarchy = hierarchyFor(key)

            if (address.countryId) {
                await hierarchy.loadProvinces(address.countryId)
            }
            if (address.provinceId) {
                await hierarchy.loadDistricts(address.provinceId)
            }
            if (address.districtId) {
                await hierarchy.loadCommunes(address.districtId)
            }
            if (address.communeId) {
                await hierarchy.loadVillages(address.communeId)
            }
        }),
    )
}

onMounted(hydrate)
</script>

<template>
    <div class="employee-addresses">
        <section
            v-for="group in groups"
            :key="group.key"
            class="employee-address"
        >
            <h4>{{ group.label }}</h4>

            <div class="employee-section-grid">
                <label class="enterprise-form-field">
                    <span>Country</span>
                    <Select
                        v-model="form[group.key].countryId"
                        :options="optionsFor(group.key, 'countryId')"
                        option-label="label"
                        option-value="value"
                        filter
                        show-clear
                        :loading="loadingFor(group.key, 'countryId')"
                        :disabled="disabledFor(group.key, 'countryId')"
                        @change="onCountryChange(group.key)"
                    />
                </label>

                <label class="enterprise-form-field">
                    <span>Province</span>
                    <Select
                        v-model="form[group.key].provinceId"
                        :options="optionsFor(group.key, 'provinceId')"
                        option-label="label"
                        option-value="value"
                        filter
                        show-clear
                        :loading="loadingFor(group.key, 'provinceId')"
                        :disabled="disabledFor(group.key, 'provinceId')"
                        @change="onProvinceChange(group.key)"
                    />
                </label>

                <label class="enterprise-form-field">
                    <span>District</span>
                    <Select
                        v-model="form[group.key].districtId"
                        :options="optionsFor(group.key, 'districtId')"
                        option-label="label"
                        option-value="value"
                        filter
                        show-clear
                        :loading="loadingFor(group.key, 'districtId')"
                        :disabled="disabledFor(group.key, 'districtId')"
                        @change="onDistrictChange(group.key)"
                    />
                </label>

                <label class="enterprise-form-field">
                    <span>Commune</span>
                    <Select
                        v-model="form[group.key].communeId"
                        :options="optionsFor(group.key, 'communeId')"
                        option-label="label"
                        option-value="value"
                        filter
                        show-clear
                        :loading="loadingFor(group.key, 'communeId')"
                        :disabled="disabledFor(group.key, 'communeId')"
                        @change="onCommuneChange(group.key)"
                    />
                </label>

                <label class="enterprise-form-field">
                    <span>Village</span>
                    <Select
                        v-model="form[group.key].villageId"
                        :options="optionsFor(group.key, 'villageId')"
                        option-label="label"
                        option-value="value"
                        filter
                        show-clear
                        :loading="loadingFor(group.key, 'villageId')"
                        :disabled="disabledFor(group.key, 'villageId')"
                    />
                </label>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>Address Detail</span>
                    <InputText
                        v-model="form[group.key].detail"
                        :disabled="disabled"
                        maxlength="500"
                    />
                </label>
            </div>
        </section>
    </div>
</template>

<style scoped>
.employee-addresses {
    display: grid;
    gap: 1rem;
}

.employee-address {
    display: grid;
    gap: 0.65rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
}

.employee-address:last-child {
    padding-bottom: 0;
    border-bottom: 0;
}

.employee-address h4 {
    margin: 0;
    font-size: 0.8rem;
}
</style>
