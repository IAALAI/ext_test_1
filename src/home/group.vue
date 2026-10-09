<template>
    <main class="manager">
        <header><RouterLink to="/home">← 首页</RouterLink><h1>分组管理</h1><span class="muted">{{ groups.length }} 个分组</span></header>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="notice" class="notice" role="status">{{ notice }}</p>
        <p v-if="!groupsSupported" class="panel">当前浏览器未提供原生标签页分组功能。请使用 Firefox 139 或更新版本；其他管理功能仍可使用。</p>
        <template v-else>
            <section class="panel">
                <h2>整理标签页</h2>
                <div class="toolbar">
                    <select v-model.number="selectedWindow" aria-label="选择窗口" @change="selected = []; targetGroup = ''"><option v-for="id in windowIds" :key="id" :value="id">窗口 {{ id }}</option></select>
                    <input v-model="search" type="search" placeholder="搜索要分组的标签页" aria-label="搜索要分组的标签页" />
                </div>
                <div class="tab-picker">
                    <label v-for="tab in availableTabs" :key="tab.id" class="check-label"><input v-model="selected" type="checkbox" :value="tab.id" :disabled="busy" /><span class="picker-title" :title="tab.url">{{ tab.title || tab.url }}</span><span v-if="tab.groupId != null && tab.groupId >= 0" class="muted">已分组</span></label>
                    <p v-if="!availableTabs.length" class="muted">没有可分组的标签页。固定标签页无法加入分组。</p>
                </div>
                <form class="toolbar create-group" @submit.prevent="applyGroup">
                    <select v-model="targetGroup" aria-label="目标分组" :disabled="busy"><option value="">创建新分组</option><option v-for="group in windowGroups" :key="group.id" :value="String(group.id)">{{ group.title || '未命名分组' }}</option></select>
                    <input v-if="!targetGroup" v-model="newTitle" placeholder="分组名称" aria-label="分组名称" required :disabled="busy" />
                    <select v-if="!targetGroup" v-model="newColor" aria-label="新分组颜色" :disabled="busy"><option v-for="color in groupColors" :key="color.value" :value="color.value">{{ color.label }}</option></select>
                    <button class="primary" :disabled="busy || !selected.length">{{ targetGroup ? '加入分组' : '创建分组' }}（{{ selected.length }}）</button>
                </form>
                <p class="muted">一次整理同一个窗口的标签页；从原分组移出的标签页会加入目标分组。</p>
            </section>
            <p v-if="loading" class="empty">正在读取分组…</p>
            <p v-else-if="!groups.length" class="empty">还没有分组，选择上方标签页即可创建。</p>
            <section v-for="group in groups" :key="group.id" class="panel group-panel" :style="{ borderLeftColor: groupColors.find(color => color.value === group.color)?.hex }">
                <form v-if="editing?.id === group.id" class="toolbar" @submit.prevent="saveGroup">
                    <input v-model="editing.title" aria-label="修改分组名称" required :disabled="busy" />
                    <select v-model="editing.color" aria-label="修改分组颜色" :disabled="busy"><option v-for="color in groupColors" :key="color.value" :value="color.value">{{ color.label }}</option></select>
                    <button class="primary" :disabled="busy">保存</button><button type="button" :disabled="busy" @click="editing = null">取消</button>
                </form>
                <div v-else class="toolbar">
                    <h2 class="group-title">{{ group.title || '未命名分组' }} <span class="muted">窗口 {{ group.windowId }} · {{ members(group.id).length }} 个标签页</span></h2>
                    <button :disabled="busy" @click="editing = { id: group.id, title: group.title || '', color: group.color }">编辑</button>
                    <button :disabled="busy" @click="toggle(group)">{{ group.collapsed ? '展开分组' : '折叠分组' }}</button>
                    <button :disabled="busy" @click="dissolve(group)">解散分组</button>
                </div>
                <ul class="list">
                    <li v-for="tab in members(group.id)" :key="tab.id" class="row">
                        <div class="details"><button class="title" :disabled="busy" @click="activate(tab)">{{ tab.title || tab.url }}</button><div class="url muted">{{ tab.url }}</div></div>
                        <span v-if="tab.discarded" class="tag">已休眠</span>
                        <button :disabled="busy" @click="removeTab(tab)">移出分组</button>
                    </li>
                </ul>
            </section>
        </template>
    </main>
</template>

<script setup lang="ts">
import browser from "webextension-polyfill";
import { computed, ref } from "vue";
import { groupApi, groupColors, groupsSupported, groupTabs, queryGroups, ungroupTabs, type Group, type GroupColor, type GroupTab } from "~/groups";
import { useRefresh, useTask } from "./use-manager";

const tabs = ref<GroupTab[]>([]);
const groups = ref<Group[]>([]);
const selectedWindow = ref<number>();
const selected = ref<number[]>([]);
const search = ref("");
const targetGroup = ref("");
const newTitle = ref("");
const newColor = ref<GroupColor>("blue");
const editing = ref<{ id: number; title: string; color: GroupColor } | null>(null);
const { busy, error, notice, run } = useTask();
const windowIds = computed(() => [...new Set(tabs.value.map(tab => tab.windowId).filter((id): id is number => id != null))]);
const windowGroups = computed(() => groups.value.filter(group => group.windowId === selectedWindow.value));
const availableTabs = computed(() => tabs.value.filter(tab => tab.windowId === selectedWindow.value && !tab.pinned && tab.id != null
    && `${tab.title} ${tab.url}`.toLowerCase().includes(search.value.trim().toLowerCase())));
const members = (id: number) => tabs.value.filter(tab => tab.groupId === id).sort((a, b) => a.index - b.index);
async function load() {
    if (!groupsSupported) return;
    const [nextTabs, nextGroups] = await Promise.all([browser.tabs.query({}), queryGroups()]);
    tabs.value = nextTabs;
    groups.value = nextGroups;
    if (!windowIds.value.includes(selectedWindow.value!)) selectedWindow.value = windowIds.value[0];
    selected.value = selected.value.filter(id => tabs.value.some(tab => tab.id === id && tab.windowId === selectedWindow.value && !tab.pinned));
    if (targetGroup.value && !windowGroups.value.some(group => group.id === Number(targetGroup.value))) targetGroup.value = "";
}
const { loading, refresh } = useRefresh(load, [browser.tabs.onUpdated, browser.tabs.onCreated, browser.tabs.onRemoved,
    browser.tabs.onMoved, browser.tabs.onAttached, browser.tabs.onDetached,
    ...(groupApi ? [groupApi.onCreated, groupApi.onRemoved, groupApi.onUpdated, groupApi.onMoved] : [])], cause => { error.value = String(cause); });
function applyGroup() {
    return run(async () => {
        if (!selected.value.length) return;
        if (!targetGroup.value && !newTitle.value.trim()) throw new Error("请输入分组名称。");
        const id = await groupTabs([...selected.value], targetGroup.value ? Number(targetGroup.value) : undefined);
        if (!targetGroup.value) await groupApi!.update(id, { title: newTitle.value.trim(), color: newColor.value });
        selected.value = [];
        newTitle.value = "";
        await refresh();
    }, "分组已更新");
}
function saveGroup() {
    return run(async () => {
        if (!editing.value) return;
        if (!editing.value.title.trim()) throw new Error("请输入分组名称。");
        await groupApi!.update(editing.value.id, { title: editing.value.title.trim(), color: editing.value.color });
        editing.value = null;
        await refresh();
    }, "分组已保存");
}
function toggle(group: Group) {
    return run(async () => { await groupApi!.update(group.id, { collapsed: !group.collapsed }); await refresh(); });
}
function dissolve(group: Group) {
    if (!window.confirm(`解散“${group.title || '未命名分组'}”？标签页将保留。`)) return;
    return run(async () => {
        const currentTabs = await browser.tabs.query({}) as GroupTab[];
        const ids = currentTabs.filter(tab => tab.groupId === group.id && tab.id != null).map(tab => tab.id!);
        if (ids.length) await ungroupTabs(ids);
        await refresh();
    }, "分组已解散，标签页已保留");
}
function removeTab(tab: GroupTab) { return run(async () => { await ungroupTabs([tab.id!]); await refresh(); }); }
function activate(tab: GroupTab) {
    return run(async () => {
        await browser.tabs.update(tab.id!, { active: true });
        if (tab.windowId != null) await browser.windows.update(tab.windowId, { focused: true });
    });
}
</script>

<style scoped>
.tab-picker { display: grid; gap: 12px; max-height: 240px; overflow-y: auto; padding: 8px 0; }
.picker-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.create-group { margin: 20px 0 0; }
.group-panel { border-left-width: 5px; }
.group-title { flex: 1; }
</style>
