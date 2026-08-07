<script setup>
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
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--p-content-border-color, #cbd5e1);
    border-radius: 12px;
    background: var(--p-content-background, #ffffff);
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
}

.recruitment-section__title {
    flex: 0 0 auto;
    padding: 0.65rem 0.9rem;
    background: #0ea5d8;
    color: #ffffff;
    font-size: 0.84rem;
    font-weight: 900;
    letter-spacing: 0.015em;
    text-transform: uppercase;
}

.recruitment-section__body {
    min-width: 0;
    padding: 0.7rem;
    background: var(--p-content-background, #ffffff);
}

@media (max-width: 700px) {
    .recruitment-section__body {
        padding: 0.45rem;
    }
}
</style>
