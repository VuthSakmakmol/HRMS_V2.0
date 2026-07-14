<script setup>
import RecruitmentChannelCharts from "./RecruitmentChannelCharts.vue"
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
</script>

<template>
    <section class="recruitment-section dashboard-section-card">
        <div class="dashboard-section-card__title recruitment-section__title">
            {{ props.title }}
        </div>

        <RecruitmentChannelTable
            :data="props.data"
            :selected-period-key="props.selectedPeriodKey"
        />

        <RecruitmentChannelCharts :data="props.data" />
    </section>
</template>

<style scoped>
.recruitment-section {
    display: grid;
    gap: 0;
    min-width: 0;
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #7f8fa6;
}

.recruitment-section__title {
    background: #09aee3;
    color: #ffffff;
    font-size: 0.82rem;
    font-weight: 900;
    letter-spacing: 0.01em;
    padding: 0.5rem 0.75rem;
    text-transform: uppercase;
}
</style>
