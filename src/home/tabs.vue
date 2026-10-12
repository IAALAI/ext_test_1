<template>
    <main class="manager">
        <header><RouterLink to="/home">← 首页</RouterLink><h1>标签页管理</h1><span class="muted">{{ tabs.length }} 个标签页</span></header>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="notice" class="notice" role="status">{{ notice }}</p>
        <div class="toolbar">
            <input v-model="search" type="search" placeholder="搜索标题或网址" aria-label="搜索标签页" />
            <button :disabled="busy" @click="refresh">刷新</button>
        </div>
        <p v-if="loading" class="empty">正在读取标签页…</p>
        <p v-else-if="!filtered.length" class="empty">没有符合条件的标签页。</p>
        <template v-else v-for="window in windows" :key="window.id">
            <h2>窗口 {{ window.id }} <span class="muted">{{ window.tabs.length }} 个标签页</span></h2>
            <ul class="list window-list">
                <li v-for="tab in window.tabs" :key="tab.id" class="row">
                    <div class="details">
                        <button class="title" :title="tab.url" :disabled="busy" @click="activate(tab)">{{ tab.title || tab.url || '新标签页' }}</button>
                        <div class="url muted" :title="tab.url">{{ tab.url }}</div>
                        <span v-if="tab.active" class="tag">当前</span>
                        <span v-if="tab.pinned" class="tag">固定</span><span v-if="tab.audible" class="tag">有声音</span>
                        <span v-if="tab.groupId != null && tab.groupId >= 0" class="tag">{{ groupNames[tab.groupId] || '未命名分组' }}</span>
                    </div>
                    <div class="actions">
                        <button :disabled="busy" @click="pin(tab)">{{ tab.pinned ? '取消固定' : '固定' }}</button>
                        <button class="danger" :disabled="busy" @click="close(tab)">关闭</button>
                    </div>
                </li>
            </ul>
        </template>
    </main>
</template>

<script setup lang="ts">
import browser from "webextension-polyfill";
import { computed, ref } from "vue";
import { queryGroups, groupApi, type GroupTab } from "~/groups";
import { useRefresh, useTask } from "./use-manager";

const tabs = ref<GroupTab[]>([]);
const groupNames = ref<Record<number, string>>({});
const search = ref("");
const { busy, error, notice, run } = useTask();
const filtered = computed(() => tabs.value.filter(tab =>
    `${tab.title} ${tab.url}`.toLowerCase().includes(search.value.trim().toLowerCase())
));
const windows = computed(() => [...new Set(filtered.value.map(tab => tab.windowId))].map(id => ({
    id, tabs: filtered.value.filter(tab => tab.windowId === id).sort((a, b) => a.index - b.index),
})));
async function load() {
    const [nextTabs, groups] = await Promise.all([browser.tabs.query({}), queryGroups()]);
    tabs.value = nextTabs;
    groupNames.value = Object.fromEntries(groups.map(group => [group.id, group.title ?? '未命名分组']));
}
const events = [browser.tabs.onUpdated, browser.tabs.onCreated, browser.tabs.onRemoved, browser.tabs.onActivated,
    browser.tabs.onMoved, browser.tabs.onAttached, browser.tabs.onDetached];
const { loading, refresh } = useRefresh(load, [...events, ...(groupApi ? [groupApi.onUpdated] : [])], cause => { error.value = String(cause); });
function activate(tab: GroupTab) {
    return run(async () => {
        await browser.tabs.update(tab.id!, { active: true });
        if (tab.windowId != null) await browser.windows.update(tab.windowId, { focused: true });
    });
}
function pin(tab: GroupTab) {
    return run(async () => { await browser.tabs.update(tab.id!, { pinned: !tab.pinned }); await refresh(); });
}
function close(tab: GroupTab) {
    if (!window.confirm(`关闭标签页“${tab.title || tab.url}”？`)) return;
    return run(async () => { await browser.tabs.remove(tab.id!); await refresh(); });
}
</script>

<style scoped>
.window-list { margin-bottom: 24px; }
</style>
