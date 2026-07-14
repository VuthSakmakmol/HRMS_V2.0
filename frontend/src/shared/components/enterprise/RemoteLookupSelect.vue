<script setup>
import Select from "primevue/select"
import { onMounted, watch } from "vue"
import { useRemoteLookup } from "../../composables/useRemoteLookup.js"

const props = defineProps({
    modelValue: { type: [String, Number, Object, Array], default: null },
    fetcher: { type: Function, required: true },
    optionLabel: { type: String, default: "label" },
    optionValue: { type: String, default: "id" },
    placeholder: { type: String, default: "Select" },
    minimumSearchLength: { type: Number, default: 0 },
    pageSize: { type: Number, default: 30 },
    preload: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    params: { type: Object, default: () => ({}) },
})

const emit = defineEmits(["update:modelValue", "change"])

const lookup = useRemoteLookup({
    fetcher: props.fetcher,
    minimumSearchLength: props.minimumSearchLength,
    pageSize: props.pageSize,
})

function onFilter(event) {
    lookup.search(event.value, props.params)
}

function onChange(event) {
    emit("update:modelValue", event.value)
    emit("change", event.value)
}

watch(
    () => props.params,
    () => {
        lookup.reset()
        if (props.preload) lookup.search("", props.params)
    },
    { deep: true },
)

onMounted(() => {
    if (props.preload) lookup.search("", props.params)
})
</script>

<template>
    <Select
        :model-value="modelValue"
        :options="lookup.items.value"
        :option-label="optionLabel"
        :option-value="optionValue"
        :placeholder="placeholder"
        :loading="lookup.loading.value"
        :disabled="disabled"
        filter
        show-clear
        :virtual-scroller-options="{ itemSize: 34 }"
        @filter="onFilter"
        @change="onChange"
    />
</template>
