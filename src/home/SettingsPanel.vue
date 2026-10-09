<template>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="loading" class="empty">正在读取设置…</p>
    <template v-else>
        <form class="panel form-grid" @submit.prevent="save">
            <h2>标签页自动休眠</h2>
            <div class="check-label">
                <input id="sleep-enabled" v-model="settings.enabled" type="checkbox" :disabled="busy" @change="notice = ''" />
                <label for="sleep-enabled">启用自动休眠</label>
            </div>
            <label for="sleep-interval">检查间隔与未使用时长
                <select id="sleep-interval" v-model.number="settings.intervalMinutes" :disabled="busy" @change="notice = ''">
                    <option v-for="minutes in SLEEP_INTERVALS" :key="minutes" :value="minutes">{{ minutes }} 分钟</option>
                </select>
            </label>
            <p class="muted">每隔 {{ settings.intervalMinutes }} 分钟检查一次，将至少 {{ settings.intervalMinutes }} 分钟未访问的后台网页按最久未访问的顺序休眠。标签页会保留，切换回来时重新加载。</p>
            <div class="actions">
                <button class="primary" type="submit" :disabled="busy">{{ busy ? '处理中…' : '保存设置' }}</button>
                <button type="button" :disabled="busy || !settings.enabled" @click="checkNow">保存并立即检查</button>
            </div>
        </form>
        <section class="panel">
            <h2>运行状态</h2>
            <p>{{ saved.enabled ? `已启用，每 ${saved.intervalMinutes} 分钟检查` : '自动休眠已关闭' }}</p>
            <p v-if="nextCheck" class="muted">下次检查：{{ formatTime(nextCheck) }}（浏览器繁忙或设备休眠时可能延后）</p>
            <p v-if="status" class="muted">上次检查：{{ formatTime(status.checkedAt) }}<br />已休眠 {{ status.discarded }} 个，跳过 {{ status.skipped }} 个，未能处理 {{ status.failed }} 个。</p>
            <p v-else class="muted">尚未运行自动检查。</p>
        </section>
        <section class="panel">
            <h2>保留正在使用的页面</h2>
            <p class="muted">自动跳过当前标签页、固定标签页、有声音的页面、媒体共享页面和已标记为“保护”的标签页。检查到播放中的音视频、画中画或表单改动时也会跳过；无法检查的页面保持打开。</p>
            <p class="muted">重要通话、编辑器或画中画页面，建议在标签页管理中点击“保护”。保护状态由浏览器维护；重启后请确认。</p>
        </section>
    </template>
</template>

<script setup lang="ts">
import browser from "webextension-polyfill";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { DEFAULT_SLEEP_SETTINGS, normalizeSleepSettings, SLEEP_ALARM, SLEEP_INTERVALS, SLEEP_SETTINGS_KEY, SLEEP_STATUS_KEY, type SleepStatus } from "~/tab-sleep";
import { useTask } from "./use-manager";

const settings = ref({ ...DEFAULT_SLEEP_SETTINGS });
const saved = ref({ ...DEFAULT_SLEEP_SETTINGS });
const status = ref<SleepStatus>();
const nextCheck = ref<number>();
const loading = ref(true);
const { busy, error, notice, run } = useTask();
const formatTime = (time: number) => new Date(time).toLocaleString();
async function loadStatus() {
    nextCheck.value = (await browser.alarms.get(SLEEP_ALARM))?.scheduledTime;
}
async function persist() {
    const value = normalizeSleepSettings(settings.value);
    await browser.storage.local.set({ [SLEEP_SETTINGS_KEY]: value });
    saved.value = value;
}
function save() { return run(persist, "设置已保存"); }
function checkNow() {
    return run(async () => {
        await persist();
        status.value = await browser.runtime.sendMessage({ type: "CHECK_SLEEP_TABS" });
    }, "检查完成");
}
function onChanged(changes: Record<string, browser.Storage.StorageChange>, area: string) {
    if (area !== "local") return;
    if (changes[SLEEP_STATUS_KEY]) status.value = changes[SLEEP_STATUS_KEY].newValue;
    if (changes[SLEEP_SETTINGS_KEY]) {
        const wasClean = settings.value.enabled === saved.value.enabled && settings.value.intervalMinutes === saved.value.intervalMinutes;
        saved.value = normalizeSleepSettings(changes[SLEEP_SETTINGS_KEY].newValue);
        if (wasClean) settings.value = { ...saved.value };
    }
}
let timer: ReturnType<typeof setInterval>;
onMounted(async () => {
    browser.storage.onChanged.addListener(onChanged);
    await run(async () => {
        const stored = await browser.storage.local.get([SLEEP_SETTINGS_KEY, SLEEP_STATUS_KEY]);
        settings.value = normalizeSleepSettings(stored[SLEEP_SETTINGS_KEY]);
        saved.value = { ...settings.value };
        status.value = stored[SLEEP_STATUS_KEY];
        await loadStatus();
    });
    loading.value = false;
});
onMounted(() => { timer = setInterval(() => { void loadStatus().catch(() => {}); }, 2000); });
onBeforeUnmount(() => {
    clearInterval(timer);
    browser.storage.onChanged.removeListener(onChanged);
});
</script>
