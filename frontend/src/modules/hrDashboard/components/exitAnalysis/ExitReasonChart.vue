<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import EnterpriseChart from "../shared/EnterpriseChart.vue";
const props = defineProps({ data: { type: Object, default: () => ({}) } });
const { t } = useI18n();
const rows = computed(() =>
  (props.data.rows || []).filter(
    (r) => Number(r.count || 0) > 0 || Number(r.rate || 0) > 0,
  ),
);
const chartData = computed(() => ({
  labels: rows.value.map((r) => r.label),
  datasets: [
    {
      label: t("hrDashboard.exitAnalysis.exitReasons"),
      data: rows.value.map((r) => Number(r.rate || 0)),
    },
  ],
}));
</script>
<template>
  <EnterpriseChart
    :data="chartData"
    :title="data.title || t('hrDashboard.exitAnalysis.exitReasons')"
    horizontal
    percent
    :height="300"
  />
</template>
