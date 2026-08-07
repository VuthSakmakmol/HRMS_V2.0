<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import EnterpriseChart from "../shared/EnterpriseChart.vue";
const props = defineProps({
  rows: { type: Array, default: () => [] },
  selectedPeriodKey: { type: String, default: null },
});
const { t } = useI18n();
const chartData = computed(() => ({
  labels: props.rows.map((r) => t(`hrDashboard.monthsShort.${r.month}`)),
  datasets: [
    {
      label: t("hrDashboard.movement.in"),
      data: props.rows.map((r) => Number(r.in || 0)),
    },
    {
      label: t("hrDashboard.movement.out"),
      data: props.rows.map((r) => Number(r.out || 0)),
    },
    {
      label: t("hrDashboard.movement.balance"),
      data: props.rows.map((r) => Number(r.balance || 0)),
    },
  ],
}));
</script>
<template>
  <EnterpriseChart
    :data="chartData"
    :title="t('hrDashboard.movement.chartAria')"
    :height="270"
  />
</template>
