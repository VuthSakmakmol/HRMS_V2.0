<script setup>
import { computed } from "vue";
import { Bar, Line, Doughnut } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const props = defineProps({
  type: { type: String, default: "bar" },
  data: { type: Object, required: true },
  title: { type: String, default: "" },
  horizontal: { type: Boolean, default: false },
  percent: { type: Boolean, default: false },
  height: { type: Number, default: 280 },
  stacked: { type: Boolean, default: false },
});

const component = computed(() =>
  props.type === "line" ? Line : props.type === "doughnut" ? Doughnut : Bar,
);
const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 380, easing: "easeOutQuart" },
  interaction: { mode: "index", intersect: false },
  indexAxis: props.horizontal ? "y" : "x",
  plugins: {
    title: {
      display: Boolean(props.title),
      text: props.title,
      font: { size: 14, weight: "700" },
      padding: { bottom: 12 },
    },
    legend: {
      position: "bottom",
      labels: { usePointStyle: true, boxWidth: 8, padding: 14 },
    },
    tooltip: {
      callbacks: {
        label(context) {
          const value =
            context.parsed?.y ?? context.parsed?.x ?? context.raw ?? 0;
          return ` ${context.dataset.label || ""}: ${Number(value).toLocaleString()}${props.percent ? "%" : ""}`;
        },
      },
    },
  },
  scales:
    props.type === "doughnut"
      ? undefined
      : {
          x: {
            stacked: props.stacked,
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkip: true },
          },
          y: {
            stacked: props.stacked,
            beginAtZero: true,
            grid: { color: "rgba(148,163,184,.22)" },
            ticks: {
              callback: (value) => `${value}${props.percent ? "%" : ""}`,
            },
          },
        },
}));
</script>

<template>
  <div class="enterprise-chart" :style="{ height: `${height}px` }">
    <component :is="component" :data="data" :options="options" />
  </div>
</template>

<style scoped>
.enterprise-chart {
  min-width: 0;
  width: 100%;
  padding: 0.65rem 0.75rem 0.4rem;
  border: 1px solid var(--hrms-border, #dbe3ec);
  background: var(--hrms-surface, #fff);
}
</style>
