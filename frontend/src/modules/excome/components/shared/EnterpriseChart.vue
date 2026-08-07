<script setup>
import { computed } from "vue";
import { Bar, Doughnut, Line } from "vue-chartjs";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
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
  selectedIndex: { type: Number, default: -1 },
});

const BAR_COLORS = [
  { background: "rgba(37, 99, 235, 0.78)", border: "#1D4ED8" },
  { background: "rgba(14, 165, 233, 0.78)", border: "#0284C7" },
  { background: "rgba(16, 185, 129, 0.78)", border: "#059669" },
  { background: "rgba(245, 158, 11, 0.78)", border: "#D97706" },
  { background: "rgba(139, 92, 246, 0.78)", border: "#7C3AED" },
  { background: "rgba(239, 68, 68, 0.78)", border: "#DC2626" },
];

const DOUGHNUT_COLORS = [
  "#2563EB",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EF4444",
  "#64748B",
  "#14B8A6",
];

const component = computed(() => {
  if (props.type === "line") return Line;
  if (props.type === "doughnut") return Doughnut;
  return Bar;
});

function withDefaultDatasetStyle(dataset, index) {
  const datasetType = dataset.type || props.type;

  if (datasetType === "line") {
    const lineColor = dataset.borderColor || (index === 0 ? "#2563EB" : "#EF4444");

    return {
      ...dataset,
      borderColor: lineColor,
      backgroundColor: dataset.backgroundColor || lineColor,
      borderWidth: dataset.borderWidth ?? 2,
      pointBackgroundColor: dataset.pointBackgroundColor || lineColor,
      pointBorderColor: dataset.pointBorderColor || "#FFFFFF",
      pointBorderWidth: dataset.pointBorderWidth ?? 1,
      pointRadius: dataset.pointRadius ?? 2.5,
      pointHoverRadius: dataset.pointHoverRadius ?? 4,
      tension: dataset.tension ?? 0.3,
      fill: dataset.fill ?? false,
    };
  }

  if (datasetType === "doughnut") {
    return {
      ...dataset,
      backgroundColor: dataset.backgroundColor || DOUGHNUT_COLORS,
      borderColor: dataset.borderColor || "#FFFFFF",
      borderWidth: dataset.borderWidth ?? 2,
      hoverOffset: dataset.hoverOffset ?? 5,
    };
  }

  const palette = BAR_COLORS[index % BAR_COLORS.length];

  return {
    ...dataset,
    backgroundColor: dataset.backgroundColor || palette.background,
    borderColor: dataset.borderColor || palette.border,
    borderWidth: dataset.borderWidth ?? 1,
    borderRadius: dataset.borderRadius ?? 4,
    borderSkipped: dataset.borderSkipped ?? false,
    maxBarThickness: dataset.maxBarThickness ?? 44,
  };
}


const selectedMonthPlugin = {
  id: "excomeSelectedMonth",
  afterDatasetsDraw(chart) {
    const index = Number(props.selectedIndex);
    if (!Number.isInteger(index) || index < 0 || props.type === "doughnut") return;

    const xScale = chart.scales?.x;
    const chartArea = chart.chartArea;
    if (!xScale || !chartArea) return;

    const center = xScale.getPixelForValue(index);
    const previous = index > 0 ? xScale.getPixelForValue(index - 1) : null;
    const next = index < (chart.data.labels?.length || 0) - 1
      ? xScale.getPixelForValue(index + 1)
      : null;
    const halfWidth = previous !== null && next !== null
      ? Math.min(center - previous, next - center) * 0.46
      : previous !== null
        ? (center - previous) * 0.46
        : next !== null
          ? (next - center) * 0.46
          : 18;

    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = "#EF4444";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      center - halfWidth,
      chartArea.top + 1,
      halfWidth * 2,
      Math.max(chartArea.bottom - chartArea.top - 2, 0),
    );
    ctx.restore();
  },
};

const chartPlugins = computed(() =>
  Number.isInteger(props.selectedIndex) && props.selectedIndex >= 0
    ? [selectedMonthPlugin]
    : [],
);

const chartData = computed(() => ({
  ...props.data,
  labels: Array.isArray(props.data?.labels) ? props.data.labels : [],
  datasets: Array.isArray(props.data?.datasets)
    ? props.data.datasets.map(withDefaultDatasetStyle)
    : [],
}));

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 380,
    easing: "easeOutQuart",
  },
  transitions: {
    active: {
      animation: { duration: 180 },
    },
  },
  interaction: {
    mode: "index",
    intersect: false,
  },
  indexAxis: props.horizontal ? "y" : "x",
  plugins: {
    title: {
      display: Boolean(props.title),
      text: props.title,
      color: "#334155",
      font: { size: 14, weight: "700" },
      padding: { bottom: 12 },
    },
    legend: {
      position: "bottom",
      labels: {
        usePointStyle: true,
        boxWidth: 8,
        boxHeight: 8,
        padding: 14,
        color: "#475569",
        font: { size: 11, weight: "600" },
      },
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.94)",
      titleColor: "#FFFFFF",
      bodyColor: "#FFFFFF",
      borderColor: "rgba(148, 163, 184, 0.35)",
      borderWidth: 1,
      padding: 10,
      callbacks: {
        label(context) {
          const parsedValue = props.horizontal
            ? context.parsed?.x
            : context.parsed?.y;
          const value = parsedValue ?? context.raw ?? 0;
          const label = context.dataset.label ? `${context.dataset.label}: ` : "";

          return `${label}${Number(value).toLocaleString()}${props.percent ? "%" : ""}`;
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
            border: { color: "#CBD5E1" },
            ticks: {
              color: "#64748B",
              maxRotation: 0,
              autoSkip: true,
              font: { size: 11 },
            },
          },
          y: {
            stacked: props.stacked,
            beginAtZero: true,
            grid: { color: "rgba(148, 163, 184, 0.22)" },
            border: { color: "#CBD5E1" },
            ticks: {
              color: "#64748B",
              font: { size: 11 },
              callback: (value) => `${value}${props.percent ? "%" : ""}`,
            },
          },
        },
}));
</script>

<template>
  <div class="enterprise-chart" :style="{ height: `${height}px` }">
    <component
      :is="component"
      :data="chartData"
      :options="options"
      :plugins="chartPlugins"
    />
  </div>
</template>

<style scoped>
.enterprise-chart {
  width: 100%;
  min-width: 0;
  padding: 0.65rem 0.75rem 0.4rem;
  border: 1px solid var(--hrms-border, #dbe3ec);
  border-radius: 8px;
  background: var(--hrms-surface, #ffffff);
}
</style>
