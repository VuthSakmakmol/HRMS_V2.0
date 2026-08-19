<script setup>
import { computed } from "vue";
import Tag from "primevue/tag";

const props = defineProps({ data: { type: Object, default: () => ({}) } });
const items = computed(() => props.data.items || []);
const summary = computed(
  () => `${props.data.readyCount || 0} / ${props.data.totalCount || 0} ready`,
);
function severity(ready) {
  return ready ? "success" : "warn";
}
</script>

<template>
  <section class="readiness-card">
    <header>
      <div>
        <strong>Excom Data Readiness</strong>
        <span>Shows which dashboard sections have enough source data.</span>
      </div>
      <Tag
        :value="summary"
        :severity="
          data.status === 'READY'
            ? 'success'
            : data.status === 'PARTIAL'
              ? 'warn'
              : 'danger'
        "
      />
    </header>
    <div class="readiness-grid">
      <article v-for="item in items" :key="item.key">
        <div>
          <strong>{{ item.label }}</strong
          ><Tag
            :value="item.ready ? 'Ready' : 'Needs data'"
            :severity="severity(item.ready)"
          />
        </div>
        <span>{{ item.detail }}</span>
      </article>
    </div>
  </section>
</template>

<style scoped>
.readiness-card {
  padding: 0.75rem;
  border: 1px solid var(--hrms-border);
  border-radius: 0.65rem;
  background: var(--hrms-surface);
}
.readiness-card header,
.readiness-card header > div,
.readiness-card article,
.readiness-card article > div {
  display: flex;
  align-items: center;
}
.readiness-card header {
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.65rem;
}
.readiness-card header > div,
.readiness-card article {
  align-items: flex-start;
  flex-direction: column;
  gap: 0.2rem;
}
.readiness-card header span,
.readiness-card article > span {
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
}
.readiness-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 0.45rem;
}
.readiness-card article {
  padding: 0.55rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.5rem;
}
.readiness-card article > div {
  width: 100%;
  justify-content: space-between;
  gap: 0.5rem;
}
</style>
