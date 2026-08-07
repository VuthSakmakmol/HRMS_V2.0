<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import EnterpriseChart from "../shared/EnterpriseChart.vue";
const props = defineProps({
  rows: { type: Array, default: () => [] },
  selectedPeriodKey: { type: String, default: null },
});
const { t } = useI18n();
const selectedIndex = computed(() =>
  props.rows.findIndex((row) => row.key === props.selectedPeriodKey),
);
const chartData = computed(() => ({
  labels: props.rows.map((r) => t(`excome.monthsShort.${r.month}`)),
  datasets: [
    {
      label: t("excome.manpower.budget"),
      data: props.rows.map((r) => Number(r.budget || 0)),
    },
    {
      label: t("excome.manpower.roadmap"),
      data: props.rows.map((r) => Number(r.roadmap || 0)),
    },
    {
      label: t("excome.manpower.actual"),
      data: props.rows.map((r) => Number(r.actual || 0)),
    },
    {
      label: t("excome.manpower.overLessTarget"),
      data: props.rows.map((r) => Number(r.targetGap || 0)),
    },
    {
      label: t("excome.manpower.overLessRoadmap"),
      data: props.rows.map((r) => Number(r.roadmapGap || 0)),
    },
  ],
}));
</script>
<template>
  <EnterpriseChart
    :data="chartData"
    :title="t('excome.manpower.chartAria')"
    :height="280"
    :selected-index="selectedIndex"
  />
</template>
