<script setup>
defineProps({
    title: {
        type: String,
        required: true,
    },
})
</script>

<template>
    <div class="dashboard-section-header">
        <span>{{ title }}</span>
    </div>
</template>

<style scoped>
.dashboard-section-header {
    display: flex;
    align-items: center;
    min-height: 2rem;
    padding: 0.35rem 0.65rem;
    border: 1px solid #8ea9db;
    background: #00b0f0;
    color: #ffffff;
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
}

.dashboard-section-header span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
