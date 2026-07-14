<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue"
import { useI18n } from "vue-i18n"

import DatePicker from "primevue/datepicker"
import Tag from "primevue/tag"

import {
    resolveCalendarDay,
    resolveCalendarRange,
} from "../services/calendar.api.js"

const RESOLVE_CACHE_TTL_MS = 10 * 60 * 1000
const resolveCache = new Map()
const rangeCache = new Map()

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
    inputId: {
        type: String,
        default: "",
    },
    placeholder: {
        type: String,
        default: "",
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    showStatus: {
        type: Boolean,
        default: true,
    },
    statusDisplay: {
        type: String,
        default: "tag",
        validator: (value) => ["tag", "dot", "none"].includes(value),
    },
    showPanelHighlights: {
        type: Boolean,
        default: true,
    },
    compact: {
        type: Boolean,
        default: false,
    },
    minDate: {
        type: [String, Date],
        default: "",
    },
    maxDate: {
        type: [String, Date],
        default: "",
    },
    dateFormat: {
        type: String,
        default: "yy-mm-dd",
    },
    iconDisplay: {
        type: String,
        default: "input",
    },
    appendTo: {
        type: String,
        default: "body",
    },
    baseZIndex: {
        type: Number,
        default: 22000,
    },
    manualInput: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(["update:modelValue", "resolved"])

const { t } = useI18n()

const loading = ref(false)
const rangeLoading = ref(false)
const rangeRequestSequence = ref(0)
const rangeRenderVersion = ref(0)
const resolvedDay = ref(null)
const visibleYear = ref(new Date().getFullYear())
const visibleMonthIndex = ref(new Date().getMonth())
const resolvedRangeMap = ref(new Map())

const pickerValue = computed({
    get() {
        return toDate(props.modelValue)
    },
    set(value) {
        const selectedDate = normalizePickerDate(value)

        if (!selectedDate) {
            emit("update:modelValue", "")
            resolvedDay.value = null
            emit("resolved", null)
            return
        }

        visibleYear.value = selectedDate.getFullYear()
        visibleMonthIndex.value = selectedDate.getMonth()
        emit("update:modelValue", toDateString(selectedDate))
    },
})

const normalizedMinDate = computed(() => toDate(props.minDate))
const normalizedMaxDate = computed(() => toDate(props.maxDate))

const shouldResolvePanelHighlights = computed(
    () => props.showStatus && props.showPanelHighlights,
)

const statusSeverity = computed(() => getCalendarDaySeverity(resolvedDay.value))

const statusLabel = computed(() => {
    if (!resolvedDay.value) {
        return t("organization.calendar.day.resolving")
    }

    return getCalendarDayLabel(resolvedDay.value)
})

function normalizePickerDate(value) {
    if (Array.isArray(value)) {
        return toDate(value[0])
    }

    return toDate(value)
}

function toDate(value) {
    if (!value) {
        return null
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value
    }

    const textValue = String(value).trim()

    const isoMatch = textValue.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
        return createLocalDate(isoMatch[1], isoMatch[2], isoMatch[3])
    }

    const displayMatch = textValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (displayMatch) {
        return createLocalDate(displayMatch[3], displayMatch[2], displayMatch[1])
    }

    const parsedDate = new Date(textValue)

    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function createLocalDate(year, month, day) {
    const parsedDate = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        0,
        0,
        0,
        0,
    )

    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function toDateString(value) {
    const date = toDate(value)

    if (!date) {
        return ""
    }

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
}

function buildResolveCacheKey() {
    return [
        props.modelValue || "",
        props.companyId || "",
        props.branchId || "",
    ].join("::")
}

function buildRangeCacheKey(startDate, endDate) {
    return [
        startDate || "",
        endDate || "",
        props.companyId || "",
        props.branchId || "",
    ].join("::")
}

function getCachedResolvedDay() {
    const cacheKey = buildResolveCacheKey()
    const cached = resolveCache.get(cacheKey)

    if (!cached) {
        return null
    }

    if (Date.now() - cached.cachedAt > RESOLVE_CACHE_TTL_MS) {
        resolveCache.delete(cacheKey)
        return null
    }

    return cached.day
}

function setCachedResolvedDay(day) {
    resolveCache.set(buildResolveCacheKey(), {
        cachedAt: Date.now(),
        day,
    })
}

function getCachedResolvedRange(startDate, endDate) {
    const cacheKey = buildRangeCacheKey(startDate, endDate)
    const cached = rangeCache.get(cacheKey)

    if (!cached) {
        return null
    }

    if (Date.now() - cached.cachedAt > RESOLVE_CACHE_TTL_MS) {
        rangeCache.delete(cacheKey)
        return null
    }

    return cached.map
}

function setCachedResolvedRange(startDate, endDate, map) {
    rangeCache.set(buildRangeCacheKey(startDate, endDate), {
        cachedAt: Date.now(),
        map,
    })
}

function getMonthGridRange(year, monthIndex) {
    const start = new Date(year, monthIndex, 1)
    start.setDate(start.getDate() - start.getDay())

    const end = new Date(year, monthIndex + 1, 0)
    end.setDate(end.getDate() + (6 - end.getDay()))

    return {
        startDate: toDateString(start),
        endDate: toDateString(end),
    }
}

function normalizeSlotMonth(rawMonth) {
    const parsedMonth = Number(rawMonth)

    if (!Number.isFinite(parsedMonth)) {
        return visibleMonthIndex.value
    }

    if (parsedMonth >= 0 && parsedMonth <= 11) {
        return parsedMonth
    }

    if (parsedMonth >= 1 && parsedMonth <= 12) {
        return parsedMonth - 1
    }

    return visibleMonthIndex.value
}

function normalizeNavigationMonth(rawMonth) {
    const parsedMonth = Number(rawMonth)

    if (!Number.isFinite(parsedMonth)) {
        return visibleMonthIndex.value
    }

    if (parsedMonth >= 1 && parsedMonth <= 12) {
        return parsedMonth - 1
    }

    if (parsedMonth >= 0 && parsedMonth <= 11) {
        return parsedMonth
    }

    return visibleMonthIndex.value
}

function setResolvedRangeMap(map) {
    resolvedRangeMap.value = map
    rangeRenderVersion.value += 1
}

function syncVisibleMonthFromValue() {
    const selectedDate = pickerValue.value || new Date()

    visibleYear.value = selectedDate.getFullYear()
    visibleMonthIndex.value = selectedDate.getMonth()
}

function makeRangeMap(payload) {
    const mapSource = payload?.map || {}
    const items = payload?.items || []
    const nextMap = new Map()

    for (const [dateKey, day] of Object.entries(mapSource)) {
        nextMap.set(dateKey, day)
    }

    for (const day of items) {
        if (day?.dateKey) {
            nextMap.set(day.dateKey, day)
        }
    }

    return nextMap
}

async function resolveSelectedDate() {
    if (!props.showStatus) {
        resolvedDay.value = null
        emit("resolved", null)
        return
    }

    if (!props.modelValue) {
        resolvedDay.value = null
        emit("resolved", null)
        return
    }

    const cached = getCachedResolvedDay()

    if (cached) {
        resolvedDay.value = cached
        emit("resolved", cached)
        return
    }

    loading.value = true

    try {
        const day = await resolveCalendarDay({
            date: props.modelValue,
            companyId: props.companyId || undefined,
            branchId: props.branchId || undefined,
        })

        resolvedDay.value = day
        setCachedResolvedDay(day)
        emit("resolved", day)
    } finally {
        loading.value = false
    }
}

async function resolveVisibleMonth() {
    if (!shouldResolvePanelHighlights.value) {
        setResolvedRangeMap(new Map())
        return
    }

    const { startDate, endDate } = getMonthGridRange(
        visibleYear.value,
        visibleMonthIndex.value,
    )

    const cached = getCachedResolvedRange(startDate, endDate)

    if (cached) {
        setResolvedRangeMap(cached)
        return
    }

    const requestId = rangeRequestSequence.value + 1
    rangeRequestSequence.value = requestId
    rangeLoading.value = true

    try {
        const payload = await resolveCalendarRange({
            startDate,
            endDate,
            companyId: props.companyId || undefined,
            branchId: props.branchId || undefined,
        })

        if (requestId !== rangeRequestSequence.value) {
            return
        }

        const nextMap = makeRangeMap(payload)
        setResolvedRangeMap(nextMap)
        setCachedResolvedRange(startDate, endDate, nextMap)
    } catch {
        if (requestId === rangeRequestSequence.value) {
            setResolvedRangeMap(new Map())
        }
    } finally {
        if (requestId === rangeRequestSequence.value) {
            rangeLoading.value = false
        }
    }
}

function prefetchVisibleMonth() {
    syncVisibleMonthFromValue()
    resolveVisibleMonth()
}

function handlePanelShow() {
    prefetchVisibleMonth()
}

async function handleMonthChange(event) {
    visibleMonthIndex.value = normalizeNavigationMonth(event?.month)
    visibleYear.value = Number(event?.year) || visibleYear.value
    await nextTick()
    resolveVisibleMonth()
}

async function handleYearChange(event) {
    if (event?.month !== undefined && event?.month !== null) {
        visibleMonthIndex.value = normalizeNavigationMonth(event.month)
    }

    visibleYear.value = Number(event?.year) || visibleYear.value
    await nextTick()
    resolveVisibleMonth()
}

function getSlotDate(dateMeta) {
    if (!dateMeta) {
        return null
    }

    return new Date(
        Number(dateMeta.year),
        normalizeSlotMonth(dateMeta.month),
        Number(dateMeta.day),
        0,
        0,
        0,
        0,
    )
}

function getSlotDateKey(dateMeta) {
    const date = getSlotDate(dateMeta)
    return date ? toDateString(date) : ""
}

function getCalendarDayBySlot(dateMeta) {
    rangeRenderVersion.value

    const dateKey = getSlotDateKey(dateMeta)

    if (!dateKey) {
        return null
    }

    return resolvedRangeMap.value.get(dateKey) || null
}

function getFallbackDayType(dateMeta) {
    const date = getSlotDate(dateMeta)

    if (!date) {
        return ""
    }

    return date.getDay() === 0 ? "WEEKEND" : ""
}

function getCalendarDaySeverity(day) {
    if (!day) {
        return "secondary"
    }

    if (
        ["WORKING_DAY", "SPECIAL_WORKING_DAY"].includes(day.dayType)
    ) {
        return "success"
    }

    if (day.dayType === "COMPANY_EVENT") {
        return "info"
    }

    if (["WEEKEND", "HOLIDAY", "CLOSED_DAY"].includes(day.dayType)) {
        return "danger"
    }

    return "secondary"
}

function getCalendarDayLabel(day) {
    if (!day) {
        return ""
    }

    const dayType = t(`organization.calendar.dayTypes.${day.dayType}`)
    const name = day.name || dayType

    return `${dayType} - ${name}`
}

function getDateCellClass(dateMeta) {
    const day = getCalendarDayBySlot(dateMeta)
    const dayType = day?.dayType || getFallbackDayType(dateMeta)
    const classes = []

    if (dateMeta?.otherMonth) {
        classes.push("internal-calendar-picker__date-cell--other-month")
    }

    if (["WEEKEND", "HOLIDAY", "CLOSED_DAY"].includes(dayType)) {
        classes.push("internal-calendar-picker__date-cell--danger")
    }

    if (dayType === "HOLIDAY") {
        classes.push("internal-calendar-picker__date-cell--holiday")
    }

    if (dayType === "CLOSED_DAY") {
        classes.push("internal-calendar-picker__date-cell--closed")
    }

    if (dayType === "SPECIAL_WORKING_DAY") {
        classes.push("internal-calendar-picker__date-cell--special-working")
    }

    if (dayType === "COMPANY_EVENT") {
        classes.push("internal-calendar-picker__date-cell--company-event")
    }

    return classes
}

function getDateCellTitle(dateMeta) {
    const day = getCalendarDayBySlot(dateMeta)

    if (day) {
        return getCalendarDayLabel(day)
    }

    if (getFallbackDayType(dateMeta) === "WEEKEND") {
        return t("organization.calendar.dayTypes.WEEKEND")
    }

    return ""
}

watch(
    () => [props.modelValue, props.companyId, props.branchId, props.showStatus],
    () => {
        syncVisibleMonthFromValue()
        resolveSelectedDate()
        resolveVisibleMonth()
    },
    { immediate: true },
)

watch(
    () => props.showPanelHighlights,
    () => resolveVisibleMonth(),
)

onMounted(() => {
    syncVisibleMonthFromValue()
    resolveVisibleMonth()
})
</script>

<template>
    <div
        class="internal-calendar-picker"
        :class="{
            'internal-calendar-picker--compact': compact,
        }"
    >
        <DatePicker
            v-model="pickerValue"
            :input-id="inputId || undefined"
            :date-format="dateFormat"
            show-icon
            :icon-display="iconDisplay"
            :disabled="disabled"
            :manual-input="manualInput"
            :append-to="appendTo"
            :auto-z-index="true"
            :base-z-index="baseZIndex"
            panel-class="internal-calendar-picker-panel"
            :min-date="normalizedMinDate"
            :max-date="normalizedMaxDate"
            :placeholder="placeholder || t('organization.calendar.day.selectDate')"
            @focus="prefetchVisibleMonth"
            @show="handlePanelShow"
            @month-change="handleMonthChange"
            @year-change="handleYearChange"
        >
            <template #date="slotProps">
                <span
                    :key="`${getSlotDateKey(slotProps.date)}-${rangeRenderVersion}`"
                    class="internal-calendar-picker__date-cell"
                    :class="getDateCellClass(slotProps.date)"
                    :data-calendar-version="rangeRenderVersion"
                    :title="getDateCellTitle(slotProps.date)"
                    :aria-label="getDateCellTitle(slotProps.date) || undefined"
                >
                    {{ slotProps.date.day }}
                </span>
            </template>
        </DatePicker>

        <div
            v-if="showStatus && statusDisplay !== 'none' && (resolvedDay || loading)"
            class="internal-calendar-picker__status"
            :class="`internal-calendar-picker__status--${statusDisplay}`"
        >
            <Tag
                v-if="resolvedDay && statusDisplay === 'tag'"
                :severity="statusSeverity"
                :value="statusLabel"
            />

            <span
                v-else-if="resolvedDay && statusDisplay === 'dot'"
                class="internal-calendar-picker__dot"
                :class="`internal-calendar-picker__dot--${statusSeverity}`"
                :title="statusLabel"
                :aria-label="statusLabel"
            />

            <span
                v-else-if="loading && statusDisplay === 'tag'"
                class="internal-calendar-picker__loading"
            >
                {{ t("organization.calendar.day.resolving") }}
            </span>
        </div>
    </div>
</template>

<style scoped>
.internal-calendar-picker {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
    pointer-events: auto;
}

.internal-calendar-picker--compact {
    gap: 0.2rem;
}

.internal-calendar-picker__status {
    display: inline-flex;
    align-items: center;
    min-height: 1.5rem;
}

.internal-calendar-picker__status--dot {
    min-height: auto;
}

.internal-calendar-picker__loading {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
}

.internal-calendar-picker__dot {
    display: inline-block;
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 999px;
    background: var(--hrms-text-muted);
}

.internal-calendar-picker__dot--success {
    background: var(--hrms-success);
}

.internal-calendar-picker__dot--warn {
    background: var(--hrms-warning);
}

.internal-calendar-picker__dot--danger {
    background: var(--hrms-danger);
}

.internal-calendar-picker__dot--info {
    background: var(--hrms-primary);
}

.internal-calendar-picker__dot--secondary {
    background: var(--hrms-text-muted);
}

.internal-calendar-picker__date-cell {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.95rem;
    height: 1.95rem;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 700;
    line-height: 1;
    pointer-events: none;
}

.internal-calendar-picker__date-cell--other-month {
    opacity: 0.55;
}

.internal-calendar-picker__date-cell--danger {
    color: var(--hrms-danger);
    background: color-mix(in srgb, var(--hrms-danger) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hrms-danger) 42%, transparent);
}

.internal-calendar-picker__date-cell--holiday,
.internal-calendar-picker__date-cell--closed {
    color: #ffffff;
    background: var(--hrms-danger);
    box-shadow: none;
}

.internal-calendar-picker__date-cell--special-working {
    color: var(--hrms-success);
    background: color-mix(in srgb, var(--hrms-success) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hrms-success) 42%, transparent);
}

.internal-calendar-picker__date-cell--company-event {
    color: var(--hrms-primary);
    background: color-mix(in srgb, var(--hrms-primary) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hrms-primary) 42%, transparent);
}
</style>

<style>
.internal-calendar-picker-panel {
    z-index: 22000 !important;
    pointer-events: auto;
}

.internal-calendar-picker-panel .p-datepicker-calendar,
.internal-calendar-picker-panel .p-datepicker-header,
.internal-calendar-picker-panel .p-datepicker-buttonbar,
.internal-calendar-picker-panel .p-datepicker-year,
.internal-calendar-picker-panel .p-datepicker-month,
.internal-calendar-picker-panel .p-datepicker-day,
.internal-calendar-picker-panel .p-datepicker-next-button,
.internal-calendar-picker-panel .p-datepicker-prev-button {
    pointer-events: auto;
}

.internal-calendar-picker-panel .internal-calendar-picker__date-cell {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.95rem;
    height: 1.95rem;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 700;
    line-height: 1;
    pointer-events: none;
}

.internal-calendar-picker-panel .internal-calendar-picker__date-cell--other-month {
    opacity: 0.55;
}

.internal-calendar-picker-panel .internal-calendar-picker__date-cell--danger {
    color: var(--hrms-danger);
    background: color-mix(in srgb, var(--hrms-danger) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hrms-danger) 42%, transparent);
}

.internal-calendar-picker-panel .internal-calendar-picker__date-cell--holiday,
.internal-calendar-picker-panel .internal-calendar-picker__date-cell--closed {
    color: #ffffff;
    background: var(--hrms-danger);
    box-shadow: none;
}

.internal-calendar-picker-panel .internal-calendar-picker__date-cell--special-working {
    color: var(--hrms-success);
    background: color-mix(in srgb, var(--hrms-success) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hrms-success) 42%, transparent);
}

.internal-calendar-picker-panel .internal-calendar-picker__date-cell--company-event {
    color: var(--hrms-primary);
    background: color-mix(in srgb, var(--hrms-primary) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hrms-primary) 42%, transparent);
}
</style>
