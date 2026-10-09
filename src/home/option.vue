<template>
    <main class="manager">
        <header><RouterLink to="/home">← 首页</RouterLink><h1>设置</h1></header>
        <SettingsPanel />
    </main>
</template>

<script setup lang="ts">
import SettingsPanel from "./SettingsPanel.vue";
</script>
