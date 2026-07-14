<script setup>
import EnterpriseEmptyState from "./EnterpriseEmptyState.vue"
import EnterpriseErrorState from "./EnterpriseErrorState.vue"
import EnterpriseFilterBar from "./EnterpriseFilterBar.vue"
import EnterpriseLoadingState from "./EnterpriseLoadingState.vue"
import EnterprisePaginator from "./EnterprisePaginator.vue"
import EnterpriseTable from "./EnterpriseTable.vue"
import EnterpriseToolbar from "./EnterpriseToolbar.vue"

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

    error: {
        type: [String, Object],
        default: null,
    },

    pagination: {
        type: Object,
        default: () => ({
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
        }),
    },

    rowKey: {
        type: String,
        default: "_id",
    },

    scrollHeight: {
        type: String,
        default: "flex",
    },

    emptyTitle: {
        type: String,
        default: "No records found",
    },

    emptyDescription: {
        type: String,
        default: "Try adjusting the filters or create a new record.",
    },

    actionsHeader: {
        type: String,
        default: "Actions",
    },

    loadingRows: {
        type: Number,
        default: 8,
    },

    showFilters: {
        type: Boolean,
        default: true,
    },

    showPaginator: {
        type: Boolean,
        default: true,
    },

    selectable: {
        type: Boolean,
        default: false,
    },

    selection: {
        type: Array,
        default: () => [],
    },
})

const emit = defineEmits([
    "update:selection",
    "page-change",
    "sort-change",
    "retry",
])
</script>

<template>
    <section class="enterprise-list-page">
        <EnterpriseToolbar
            v-if="$slots.toolbar || $slots['toolbar-start']"
        >
            <template #start>
                <slot name="toolbar-start" />
            </template>

            <slot name="toolbar" />
        </EnterpriseToolbar>

        <EnterpriseFilterBar
            v-if="props.showFilters && $slots.filters"
            :loading="props.loading"
        >
            <slot name="filters" />

            <template #actions>
                <slot name="filter-actions" />
            </template>
        </EnterpriseFilterBar>

        <div class="enterprise-list-page__surface">
            <EnterpriseErrorState
                v-if="props.error && !props.loading"
                :error="props.error"
                @retry="emit('retry')"
            />

            <EnterpriseLoadingState
                v-else-if="props.loading && props.rows.length === 0"
                :columns="props.columns.length || 5"
                :rows="props.loadingRows"
            />

            <EnterpriseEmptyState
                v-else-if="!props.loading && props.rows.length === 0"
                :title="props.emptyTitle"
                :description="props.emptyDescription"
            >
                <template #action>
                    <slot name="empty-action" />
                </template>
            </EnterpriseEmptyState>

            <EnterpriseTable
                v-else
                :rows="props.rows"
                :columns="props.columns"
                :loading="props.loading"
                :row-key="props.rowKey"
                :scroll-height="props.scrollHeight"
                :selectable="props.selectable"
                :selection="props.selection"
                :actions-header="props.actionsHeader"
                @update:selection="emit('update:selection', $event)"
                @sort-change="emit('sort-change', $event)"
            >
                <template
                    v-for="column in props.columns"
                    #[`cell-${column.field}`]="slotProps"
                >
                    <slot
                        :name="`cell-${column.field}`"
                        v-bind="slotProps"
                    />
                </template>

                <template
                    v-if="$slots.actions"
                    #actions="slotProps"
                >
                    <slot
                        name="actions"
                        v-bind="slotProps"
                    />
                </template>
            </EnterpriseTable>
        </div>

        <EnterprisePaginator
            v-if="props.showPaginator && !props.error"
            :page="props.pagination.page"
            :limit="props.pagination.limit"
            :total="props.pagination.total"
            :total-pages="props.pagination.totalPages"
            :disabled="props.loading"
            @change="emit('page-change', $event)"
        />
    </section>
</template>
