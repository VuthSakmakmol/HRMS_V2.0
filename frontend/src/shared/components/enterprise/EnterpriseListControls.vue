<script setup>
import Button from "primevue/button"

import {
    computed,
    ref,
    watch,
} from "vue"

const props = defineProps({
    filterLabel: {
        type: String,
        required: true,
    },

    hideFilterLabel: {
        type: String,
        required: true,
    },

    filterIcon: {
        type: String,
        default: "pi pi-filter",
    },

    activeFilterCount: {
        type: Number,
        default: 0,
    },

    defaultFilterVisible: {
        type: Boolean,
        default: false,
    },

    filterDisabled: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits([
    "filter-visible-change",
])

const filterVisible = ref(props.defaultFilterVisible)

const currentFilterLabel = computed(() => {
    return filterVisible.value
        ? props.hideFilterLabel
        : props.filterLabel
})

watch(
    () => props.defaultFilterVisible,
    (value) => {
        filterVisible.value = value
    },
)

function toggleFilters() {
    if (props.filterDisabled) {
        return
    }

    filterVisible.value = !filterVisible.value

    emit(
        "filter-visible-change",
        filterVisible.value,
    )
}
</script>

<template>
    <section class="enterprise-list-controls">
        <div class="enterprise-list-controls__toolbar">
            <div class="enterprise-list-controls__start">
                <Button
                    type="button"
                    severity="secondary"
                    outlined
                    size="small"
                    :disabled="props.filterDisabled"
                    :aria-expanded="filterVisible"
                    @click="toggleFilters"
                >
                    <span class="enterprise-list-controls__filter-button">
                        <i
                            :class="
                                filterVisible
                                    ? 'pi pi-times'
                                    : props.filterIcon
                            "
                        />

                        <span>
                            {{ currentFilterLabel }}
                        </span>

                        <span
                            v-if="props.activeFilterCount > 0"
                            class="enterprise-list-controls__filter-count"
                        >
                            {{ props.activeFilterCount }}
                        </span>
                    </span>
                </Button>

                <slot name="start" />
            </div>

            <div class="enterprise-list-controls__actions">
                <slot name="actions" />
            </div>
        </div>

        <Transition name="enterprise-filter-collapse">
            <div
                v-if="filterVisible"
                class="enterprise-list-controls__filter-panel"
            >
                <slot name="filters" />
            </div>
        </Transition>
    </section>
</template>
