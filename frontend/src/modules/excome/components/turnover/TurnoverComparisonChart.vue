<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import EnterpriseChart from "../shared/EnterpriseChart.vue";
const props = defineProps({
  rows: { type: Array, default: () => [] },
  previousYear: { type: [String, Number], default: "" },
  currentYear: { type: [String, Number], default: "" },
  targetRate: { type: Number, default: 2.64 },
  title: { type: String, default: "" },
  selectedPeriodKey: { type: String, default: null },
});
const { t } = useI18n();
const selectedIndex = computed(() =>
  props.rows.findIndex((row) => row.key === props.selectedPeriodKey),
);
const chartData = computed(() => ({
  labels: props.rows.map((r) =>
    r.month === "AVG" ? "AVG" : t(`excome.monthsShort.${r.month}`),
  ),
  datasets: [
    {
      type: "bar",
      label: String(props.previousYear),
      data: props.rows.map((r) => Number(r.previousRate || 0)),
    },
    {
      type: "bar",
      label: String(props.currentYear),
      data: props.rows.map((r) => Number(r.currentRate || 0)),
    },
    {
      type: "line",
      label: `Target < ${Number(props.targetRate).toFixed(2)}%`,
      data: props.rows.map((r) =>
        Number(r.targetRate || props.targetRate || 0),
      ),
      borderDash: [6, 4],
      pointRadius: 0,
      tension: 0.25,
    },
  ],
}));
</script>
<template>
  <EnterpriseChart
    :data="chartData"
    :title="title"
    percent
    :height="310"
    :selected-index="selectedIndex"
  />
</template>
