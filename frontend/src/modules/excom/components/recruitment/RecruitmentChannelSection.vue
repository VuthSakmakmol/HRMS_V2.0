<script setup>
import { computed } from "vue"

import RecruitmentChannelTable from "./RecruitmentChannelTable.vue"

const props = defineProps({
    title: {
        type: String,
        default: "Recruitment Channels",
    },
    data: {
        type: Object,
        default: () => ({}),
    },
    selectedPeriodKey: {
        type: String,
        default: null,
    },
})

const scopeLabel = computed(() =>
    String(props.data?.selectedLabel || "All Employee Types")
        .trim()
        .toUpperCase(),
)

const sectionTitle = computed(() =>
    `${scopeLabel.value} RECRUITMENT CHANNELS`,
)
</script>

<template>
    <section class="recruitment-section">
        <div class="recruitment-titlebar">
            {{ sectionTitle }}
        </div>

        <div class="recruitment-section__body">
            <RecruitmentChannelTable
                :data="props.data"
                :selected-period-key="props.selectedPeriodKey"
            />
        </div>
    </section>
</template>

<style scoped>
.recruitment-section {
    display: grid;
    gap: 0;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    background: #ffffff;
}

/* Same Excom title standard used by Absent, Movement and Turnover. */
.recruitment-titlebar {
    display: flex;
    min-height: 2.25rem;
    align-items: center;
    justify-content: center;
    padding: 0.42rem 0.75rem;
    background: #0b2d6b;
    color: #ffffff;
    font-size: 1.08rem;
    font-weight: 900;
    letter-spacing: 0.01em;
    text-align: center;
    text-transform: uppercase;
}

.recruitment-section__body {
    width: 100%;
    min-width: 0;
    padding: 0;
    background: #ffffff;
}

@media (max-width: 760px) {
    .recruitment-titlebar {
        font-size: 0.92rem;
    }
}
</style>
