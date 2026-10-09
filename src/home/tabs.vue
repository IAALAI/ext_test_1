<template>
    <main class="manager">
        <header><RouterLink to="/home">← 首页</RouterLink><h1>标签页管理</h1><span class="muted">{{ tabs.length }} 个标签页 · {{ sleepingCount }} 个已休眠</span></header>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="notice" class="notice" role="status">{{ notice }}</p>
        <div class="toolbar">
            <input v-model="search" type="search" placeholder="搜索标题或网址" aria-label="搜索标签页" />
            <select v-model="filter" aria-label="标签页状态"><option value="all">全部状态</option><option value="awake">运行中</option><option value="sleeping">已休眠</option></select>
            <button :disabled="busy" @click="refresh">刷新</button>
        </div>
        <p class="muted">休眠后标签页仍保留，点击标题即可唤醒。重要通话或编辑页面可以设为“保护”。</p>
        <p v-if="loading" class="empty">正在读取标签页…</p>
        <p v-else-if="!filtered.length" class="empty">没有符合条件的标签页。</p>
        <template v-else v-for="window in windows" :key="window.id">
            <h2>窗口 {{ window.id }} <span class="muted">{{ window.tabs.length }} 个标签页</span></h2>
            <ul class="list window-list">
                <li v-for="tab in window.tabs" :key="tab.id" class="row">
                    <div class="details">
                        <button class="title" :title="tab.url" :disabled="busy" @click="activate(tab)">{{ tab.title || tab.url || '新标签页' }}</button>
                        <div class="url muted" :title="tab.url">{{ tab.url }}</div>
                        <span v-if="tab.active" class="tag">当前</span><span v-if="tab.discarded" class="tag">已休眠</span>
                        <span v-if="tab.pinned" class="tag">固定</span><span v-if="tab.audible" class="tag">有声音</span>
                        <span v-if="tab.autoDiscardable === false" class="tag">已保护</span>
                        <span v-if="tab.groupId != null && tab.groupId >= 0" class="tag">{{ groupNames[tab.groupId] || '未命名分组' }}</span>
                    </div>
                    <div class="actions">
                        <button v-if="tab.discarded" :disabled="busy" @click="activate(tab)">唤醒</button>
                        <button v-else :disabled="busy || !!sleepBlockedReason(tab)" :title="sleepBlockedReason(tab) || '休眠此标签页'" @click="sleep(tab)">休眠</button>
                        <button :disabled="busy || tab.discarded" @click="protect(tab)">{{ tab.autoDiscardable === false ? '取消保护' : '保护' }}</button>
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
import { sleepBlockedReason } from "~/tab-sleep";
import { useRefresh, useTask } from "./use-manager";

const tabs = ref<GroupTab[]>([]);
const groupNames = ref<Record<number, string>>({});
const search = ref("");
const filter = ref("all");
const { busy, error, notice, run } = useTask();
const sleepingCount = computed(() => tabs.value.filter(tab => tab.discarded).length);
const filtered = computed(() => tabs.value.filter(tab => {
    const matches = `${tab.title} ${tab.url}`.toLowerCase().includes(search.value.trim().toLowerCase());
    return matches && (filter.value === "all" || (filter.value === "sleeping" ? tab.discarded : !tab.discarded));
}));
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
function sleep(tab: GroupTab) {
    return run(async () => {
        const response = await browser.runtime.sendMessage({ type: "SLEEP_TAB", tabId: tab.id });
        if (!response) throw new Error("后台未响应，请重新加载扩展。");
        notice.value = response.result === "discarded" ? "标签页已休眠" : "此页面当前不适合休眠，已保留。可能正在播放媒体、编辑表单或被浏览器保护。";
        await refresh();
    });
}
function protect(tab: GroupTab) {
    return run(async () => { await browser.tabs.update(tab.id!, { autoDiscardable: tab.autoDiscardable === false }); await refresh(); });
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
