<script setup>
import Column from "primevue/column"
import DataTable from "primevue/datatable"

const props = defineProps({
    rows: {
        type: Array,
        default: () => [],
    },

    columns: {
        type: Array,
        default: () => [],
    },

    loading: {
        type: Boolean,
        default: false,
    },

    rowKey: {
        type: String,
        default: "_id",
    },

    scrollHeight: {
        type: String,
        default: "flex",
    },

    selectable: {
        type: Boolean,
        default: false,
    },

    selection: {
        type: Array,
        default: () => [],
    },

    stripedRows: {
        type: Boolean,
        default: false,
    },

    actionsHeader: {
        type: String,
        default: "Actions",
    },
})

const emit = defineEmits([
    "update:selection",
    "sort-change",
])

function getColumnStyle(column) {
    const style = {}

    if (column.width) {
        style.width = column.width
    }

    if (column.minWidth) {
        style.minWidth = column.minWidth
    }

    if (column.maxWidth) {
        style.maxWidth = column.maxWidth
    }

    return style
}

function getNestedValue(row, field) {
    if (!row || !field) {
        return null
    }

    return field
        .split(".")
        .reduce((current, key) => current?.[key], row)
}

function displayValue(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—"
    }

    return value
}

function onSort(event) {
    emit("sort-change", {
        sortBy: event.sortField,
        sortOrder: event.sortOrder === -1 ? "desc" : "asc",
    })
}
</script>

<template>
    <div class="enterprise-table-shell">
        <DataTable
            :value="props.rows"
            :data-key="props.rowKey"
            :loading="props.loading"
            :selection="props.selection"
            :striped-rows="props.stripedRows"
            scrollable
            :scroll-height="props.scrollHeight"
            removable-sort
            class="enterprise-table"
            size="small"
            @update:selection="emit('update:selection', $event)"
            @sort="onSort"
        >
            <Column
                v-if="props.selectable"
                selection-mode="multiple"
                frozen
                header-style="width: 2.75rem"
                body-style="width: 2.75rem"
            />

            <Column
                v-for="column in props.columns"
                :key="column.field"
                :field="column.field"
                :header="column.header"
                :sortable="Boolean(column.sortable)"
                :frozen="Boolean(column.frozen)"
                :align-frozen="column.alignFrozen || 'left'"
                :style="getColumnStyle(column)"
                :header-class="column.headerClass"
                :body-class="column.bodyClass"
            >
                <template #body="slotProps">
                    <slot
                        :name="`cell-${column.field}`"
                        :row="slotProps.data"
                        :value="getNestedValue(slotProps.data, column.field)"
                        :index="slotProps.index"
                    >
                        <span
                            class="enterprise-table__text"
                            :title="String(displayValue(getNestedValue(slotProps.data, column.field)))"
                        >
                            {{ displayValue(getNestedValue(slotProps.data, column.field)) }}
                        </span>
                    </slot>
                </template>
            </Column>

            <Column
                v-if="$slots.actions"
                :header="props.actionsHeader"
                frozen
                align-frozen="right"
                header-class="enterprise-table__actions-header"
                body-class="enterprise-table__actions-cell"
                :exportable="false"
                :style="{
                    width: '4.5rem',
                    minWidth: '4.5rem',
                    maxWidth: '4.5rem',
                }"
            >
                <template #body="slotProps">
                    <slot
                        name="actions"
                        :row="slotProps.data"
                        :index="slotProps.index"
                    />
                </template>
            </Column>
        </DataTable>
    </div>
</template>
