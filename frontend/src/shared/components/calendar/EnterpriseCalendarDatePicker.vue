<script setup>
import InternalCalendarDatePicker from "@/modules/calendar/components/InternalCalendarDatePicker.vue"

defineOptions({
    inheritAttrs: false,
})

const props = defineProps({
    modelValue: {
        type: String,
        default: "",
    },
    companyId: {
        type: String,
        default: "",
    },
    branchId: {
        type: String,
        default: "",
    },
})

const emit = defineEmits([
    "update:modelValue",
    "resolved",
])
</script>

<template>
    <InternalCalendarDatePicker
        v-bind="$attrs"
        :model-value="props.modelValue"
        :company-id="props.companyId"
        :branch-id="props.branchId"
        @update:model-value="emit('update:modelValue', $event)"
        @resolved="emit('resolved', $event)"
    />
</template>
