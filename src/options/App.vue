<template>
    <main class="manager">
        <header><a :href="homeUrl">← 首页</a><h1>设置</h1></header>
        <SettingsPanel />
    </main>
</template>

<script setup lang="ts">
import browser from "webextension-polyfill";
import SettingsPanel from "../home/SettingsPanel.vue";
import "../home/manager.css";
const homeUrl = browser.runtime.getURL("src/home/index.html");
</script>
