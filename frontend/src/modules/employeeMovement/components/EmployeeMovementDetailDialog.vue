<script setup>
import Tag from "primevue/tag"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import { titleCase } from "../config/employeeMovement.config.js"

defineProps({ visible: Boolean, movement: { type: Object, default: null }, loading: Boolean })
const emit = defineEmits(["update:visible"])

const fields = [
    ["Company", "company"], ["Branch", "branch"], ["Department", "department"],
    ["Position", "position"], ["Line", "line"], ["Shift", "shift"],
    ["Employee Type", "employeeType"], ["Employment Status", "employmentStatus"],
]

function value(snapshot, key) {
    const item = snapshot?.[key]
    if (typeof item === "string") return titleCase(item) || "—"
    return item?.name || item?.title || item?.displayName || item?.code || "—"
}

function formatDate(date) {
    const parsed = new Date(date)
    return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed)
}
</script>

<template>
    <EnterpriseDialog :visible="visible" title="Employee Movement Details" width="58rem" @update:visible="emit('update:visible', $event)">
        <div v-if="loading" class="detail-loading"><i class="pi pi-spin pi-spinner" /> Loading movement…</div>
        <div v-else-if="movement" class="movement-detail">
            <section class="movement-detail__summary">
                <div><small>Employee</small><strong>{{ movement.employee?.employeeCode }} — {{ movement.employee?.displayName }}</strong></div>
                <div><small>Effective Date</small><strong>{{ formatDate(movement.effectiveDate) }}</strong></div>
                <div><small>Movement Type</small><Tag :value="titleCase(movement.movementType)" severity="info" /></div>
                <div><small>Source</small><strong>{{ titleCase(movement.source) }}</strong></div>
            </section>

            <div class="movement-detail__comparison">
                <div class="comparison-head">Field</div><div class="comparison-head">Before</div><div class="comparison-head">After</div>
                <template v-for="field in fields" :key="field[1]">
                    <div class="comparison-label">{{ field[0] }}</div>
                    <div>{{ value(movement.from, field[1]) }}</div>
                    <div>{{ value(movement.to, field[1]) }}</div>
                </template>
            </div>

            <section class="movement-detail__reason"><small>Reason</small><p>{{ movement.reason || "—" }}</p></section>
        </div>
    </EnterpriseDialog>
</template>

<style scoped>
.detail-loading { display: flex; justify-content: center; gap: .6rem; padding: 4rem; color: var(--p-text-muted-color); }
.movement-detail { display: grid; gap: 1rem; }
.movement-detail__summary { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: .75rem; padding: .85rem; border: 1px solid var(--p-content-border-color); border-radius: .6rem; background: var(--p-surface-50); }
.movement-detail__summary > div, .movement-detail__reason { display: grid; gap: .3rem; }
small { color: var(--p-text-muted-color); font-size: .7rem; }
.movement-detail__comparison { display: grid; grid-template-columns: 10rem 1fr 1fr; border: 1px solid var(--p-content-border-color); border-radius: .6rem; overflow: hidden; font-size: .78rem; }
.movement-detail__comparison > div { min-width: 0; padding: .55rem .7rem; border-right: 1px solid var(--p-content-border-color); border-bottom: 1px solid var(--p-content-border-color); }
.comparison-head { background: var(--p-surface-100); font-weight: 700; }
.comparison-label { font-weight: 600; }
.movement-detail__reason { padding: .75rem; border: 1px solid var(--p-content-border-color); border-radius: .6rem; }
.movement-detail__reason p { margin: 0; white-space: pre-wrap; }
@media (max-width: 700px) { .movement-detail__summary { grid-template-columns: 1fr 1fr; } .movement-detail__comparison { grid-template-columns: 7rem 1fr 1fr; overflow-x: auto; } }
</style>
