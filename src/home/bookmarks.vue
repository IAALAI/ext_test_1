<template>
    <main class="manager">
        <header><RouterLink to="/home">← 首页</RouterLink><h1>收藏夹管理</h1><span class="muted">{{ total }} 个书签</span></header>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="notice" class="notice" role="status">{{ notice }}</p>
        <div class="toolbar">
            <input v-model="search" type="search" placeholder="搜索全部收藏夹的标题或网址" aria-label="搜索书签" />
            <button :disabled="busy || loading" @click="startCreate(false)">添加书签</button>
            <button :disabled="busy || loading" @click="startCreate(true)">新建文件夹</button>
            <button :disabled="busy" @click="refresh">刷新</button>
        </div>
        <form v-if="editor" class="panel form-grid" @submit.prevent="save">
            <h2>{{ editor.id ? '编辑' : '添加' }}{{ editor.folder ? '文件夹' : '书签' }}</h2>
            <label>名称<input v-model="editor.title" required :disabled="busy" /></label>
            <label v-if="!editor.folder">网址<input v-model="editor.url" type="url" required :disabled="busy" placeholder="https://" /></label>
            <label v-if="!editor.id">保存到
                <select v-model="editor.parentId" required :disabled="busy"><option v-for="folder in folders" :key="folder.id" :value="folder.id">{{ folder.path }}</option></select>
            </label>
            <div class="actions"><button class="primary" :disabled="busy">保存</button><button type="button" :disabled="busy" @click="editor = null">取消</button></div>
        </form>
        <nav class="breadcrumbs" aria-label="收藏夹路径">
            <button @click="openFolder('')">全部收藏夹</button>
            <template v-for="folder in breadcrumbs" :key="folder.id"><span>/</span><button @click="openFolder(folder.id)">{{ folder.title || '未命名文件夹' }}</button></template>
        </nav>
        <p v-if="search.trim()" class="muted">在全部收藏夹中找到 {{ entries.length }} 项</p>
        <p v-if="loading" class="empty">正在读取收藏夹…</p>
        <p v-else-if="!entries.length" class="empty">{{ search.trim() ? '没有找到符合条件的书签。' : '这个收藏夹还是空的。' }}</p>
        <ul v-else class="list bookmark-list">
            <li v-for="node in entries" :key="node.id" class="row">
                <div class="details">
                    <span v-if="node.type === 'separator'" class="muted">────────</span>
                    <button v-else class="title" :title="node.url || node.title" :disabled="busy" @click="node.url ? openBookmark(node) : openFolder(node.id)">{{ node.url ? '↗' : '▸' }} {{ node.title || node.url || '未命名文件夹' }}</button>
                    <div v-if="node.url" class="url muted" :title="node.url">{{ node.url }}</div>
                    <div v-if="search.trim()" class="muted">{{ parentPath(node) }}</div>
                </div>
                <div v-if="canModify(node)" class="actions">
                    <button v-if="node.type !== 'separator'" :disabled="busy" @click="edit(node)">编辑</button>
                    <button class="danger" :disabled="busy" @click="remove(node)">删除</button>
                </div>
            </li>
        </ul>
    </main>
</template>

<script setup lang="ts">
import browser from "webextension-polyfill";
import { computed, ref } from "vue";
import { countBookmarks } from "~/common";
import { useRefresh, useTask } from "./use-manager";

type Bookmark = browser.Bookmarks.BookmarkTreeNode;
type Entry = Bookmark & { path: string };
const tree = ref<Bookmark[]>([]);
const currentFolder = ref("");
const search = ref("");
const editor = ref<{ id?: string; title: string; url: string; folder: boolean; parentId: string } | null>(null);
const { busy, error, notice, run } = useTask();
const total = computed(() => countBookmarks(tree.value));
const root = computed(() => tree.value[0]);
const flattened = computed(() => {
    const result: Entry[] = [];
    function visit(nodes: Bookmark[], parentPath: string) {
        for (const node of nodes) {
            const path = [parentPath, node.title || (node.url ? node.url : '未命名文件夹')].filter(Boolean).join(' / ');
            result.push({ ...node, path });
            if (node.children) visit(node.children, path);
        }
    }
    visit(root.value?.children ?? [], "");
    return result;
});
const byId = computed(() => new Map(flattened.value.map(node => [node.id, node])));
const folders = computed(() => flattened.value.filter(node => !node.url && node.type !== 'separator'));
const entries = computed(() => {
    const query = search.value.trim().toLowerCase();
    if (query) return flattened.value.filter(node => node.type !== 'separator' && `${node.title} ${node.url ?? ''}`.toLowerCase().includes(query));
    return currentFolder.value ? byId.value.get(currentFolder.value)?.children ?? [] : root.value?.children ?? [];
});
const breadcrumbs = computed(() => {
    const path: Entry[] = [];
    let node = byId.value.get(currentFolder.value);
    while (node) { path.unshift(node); node = byId.value.get(node.parentId ?? ''); }
    return path;
});
const parentPath = (node: Bookmark) => byId.value.get(node.parentId ?? '')?.path ?? '全部收藏夹';
const canModify = (node: Bookmark) => !!node.parentId && node.parentId !== root.value?.id && !node.unmodifiable;
async function load() {
    tree.value = await browser.bookmarks.getTree();
    if (currentFolder.value && !byId.value.has(currentFolder.value)) currentFolder.value = "";
}
const { loading, refresh } = useRefresh(load, [browser.bookmarks.onCreated, browser.bookmarks.onRemoved, browser.bookmarks.onChanged, browser.bookmarks.onMoved], cause => { error.value = String(cause); });
function openFolder(id: string) { currentFolder.value = id; search.value = ""; }
function openBookmark(node: Bookmark) {
    return run(async () => {
        if (!node.url || /^(javascript|data):/i.test(node.url)) throw new Error("此类书签不能在管理页直接打开。");
        await browser.tabs.create({ url: node.url });
    });
}
function startCreate(folder: boolean) {
    editor.value = { title: '', url: '', folder, parentId: currentFolder.value || folders.value[0]?.id || '' };
}
function edit(node: Bookmark) {
    editor.value = { id: node.id, title: node.title, url: node.url ?? '', folder: !node.url, parentId: node.parentId ?? '' };
}
function save() {
    return run(async () => {
        if (!editor.value) return;
        const { id, title, url, folder, parentId } = editor.value;
        if (!title.trim()) throw new Error("请输入名称。");
        if (!folder && !/^https?:\/\//i.test(url.trim())) throw new Error("请输入以 http:// 或 https:// 开头的网址。");
        if (id) await browser.bookmarks.update(id, { title: title.trim(), ...(folder ? {} : { url: url.trim() }) });
        else await browser.bookmarks.create({ parentId, title: title.trim(), ...(folder ? {} : { url: url.trim() }) });
        editor.value = null;
        await refresh();
    }, "已保存");
}
function remove(node: Bookmark) {
    const folder = !node.url && node.type !== 'separator';
    if (!window.confirm(`删除“${node.title || '此项'}”${folder ? '及其中所有书签' : ''}？此操作不可撤销。`)) return;
    return run(async () => {
        if (folder) await browser.bookmarks.removeTree(node.id);
        else await browser.bookmarks.remove(node.id);
        if (editor.value?.id === node.id) editor.value = null;
        await refresh();
    }, "已删除");
}
</script>

<style scoped>
.bookmark-list { margin-top: 18px; }
</style>
