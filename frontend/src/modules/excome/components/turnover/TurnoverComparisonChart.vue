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
  labels: props.rows.map((row) =>
    row.month === "AVG" ? "AVG" : t(`excome.monthsShort.${row.month}`),
  ),
  datasets: [
    {
      type: "bar",
      label: String(props.previousYear),
      data: props.rows.map((row) => Number(row.previousRate || 0)),

      // EnterpriseChart already supports permanent value labels.
      // Show the turnover % directly above every real bar so users do not
      // need to hover the chart to read the value.
      valueLabel: true,
      valueLabelDecimals: 2,
      valueLabelSuffix: "%",
      valueLabelShowZero: false,
    },
    {
      type: "bar",
      label: String(props.currentYear),
      data: props.rows.map((row) => Number(row.currentRate || 0)),
      valueLabel: true,
      valueLabelDecimals: 2,
      valueLabelSuffix: "%",
      valueLabelShowZero: false,
    },
    {
      type: "line",
      label: `Target < ${Number(props.targetRate).toFixed(2)}%`,
      data: props.rows.map((row) =>
        Number(row.targetRate || props.targetRate || 0),
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
