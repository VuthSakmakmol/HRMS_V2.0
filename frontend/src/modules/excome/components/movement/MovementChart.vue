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
      label: t("excome.movement.in"),
      data: props.rows.map((r) => Number(r.in || 0)),
    },
    {
      label: t("excome.movement.out"),
      data: props.rows.map((r) => Number(r.out || 0)),
    },
    {
      label: t("excome.movement.balance"),
      data: props.rows.map((r) => Number(r.balance || 0)),
    },
  ],
}));
</script>
<template>
  <EnterpriseChart
    :data="chartData"
    :title="t('excome.movement.chartAria')"
    :height="270"
    :selected-index="selectedIndex"
  />
</template>
