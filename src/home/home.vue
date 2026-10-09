<template>
    <div class="tab-badge">{{ tabs_count }}</div>
    <aside>
        <div class="times">{{ hh }} : {{ mm }} : {{ ss }}</div>
        <div class="date">{{ days }} , {{ month }} , {{ day }}</div>
    </aside>
    <main>
        <ul>
            <li>
                <router-link to="/tabs">
                    <div class="item">
                        <div class="label">标签页管理</div>
                        <div class="value">{{ tabs_count }}</div>
                    </div>
                </router-link>
            </li>
            <li>
                <router-link to="/bookmarks">
                    <div class="item">
                        <div class="label">收藏夹管理</div>
                        <div class="value">{{ marks_count }}</div>
                    </div>
                </router-link>
            </li>
            <li>
                <router-link to="/groups">
                    <div class="item">
                        <div class="label">分组管理</div>
                        <div class="value">{{ groups_count }}</div>
                    </div>
                </router-link>
            </li>
            <li>
                <router-link to="/settings">
                    <div class="item">
                        <div class="label">设置</div>
                        <div class="value">›</div>
                    </div>
                </router-link>
            </li>
        </ul>
    </main>
</template>

<script setup lang="ts">
import browser from "webextension-polyfill";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { countBookmarks } from "~/common";
import { queryGroups } from "~/groups";

const tabs_count = ref(0);
const marks_count = ref(0);
const groups_count = ref(0);
const hh = ref("");
const mm = ref("");
const ss = ref("");
const days = ref("");
const month = ref("");
const day = ref("");
const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });

let timer: ReturnType<typeof setInterval> | null = null;

function pad2(n: number) {
    return n.toString().padStart(2, "0");
}

function updateTime() {
    const now = new Date();
    hh.value = pad2(now.getHours());
    mm.value = pad2(now.getMinutes());
    ss.value = pad2(now.getSeconds());
    days.value = weekdayFormatter.format(now);
    month.value = monthFormatter.format(now);
    day.value = pad2(now.getDate());
}

function startClock() {
    if (timer != null) return;
    updateTime();
    timer = setInterval(updateTime, 1000);
}

function stopClock() {
    if (timer == null) return;
    clearInterval(timer);
    timer = null;
}

function onVisibilityChange() {
    if (document.hidden) {
        stopClock();
    } else {
        startClock();
    }
}

async function getCount() {
    const [tabsInfo, bookmarks, groupInfo] = await Promise.all([
        browser.tabs.query({}),
        browser.bookmarks.getTree(),
        queryGroups(),
    ]);
    tabs_count.value = Array.isArray(tabsInfo) ? tabsInfo.length : 0;
    marks_count.value = Array.isArray(bookmarks) ? countBookmarks(bookmarks) : 0;
    groups_count.value = groupInfo.length;
}

function onSessionStorageChanged(
    changes: Record<string, browser.Storage.StorageChange>,
    areaName: string
) {
    if (areaName !== "session") return;

    if (changes.tabsInfo) {
        const next = changes.tabsInfo.newValue;
        tabs_count.value = Array.isArray(next) ? next.length : 0;
    }
    if (changes.bookmarks) {
        const next = changes.bookmarks.newValue;
        marks_count.value = Array.isArray(next) ? countBookmarks(next) : 0;
    }
    if (changes.groupInfo) {
        groups_count.value = Array.isArray(changes.groupInfo.newValue) ? changes.groupInfo.newValue.length : 0;
    }
}

onMounted(() => {
    if (!document.hidden) startClock();
    document.addEventListener("visibilitychange", onVisibilityChange);
    void getCount().catch(console.error);
    browser.storage.onChanged.addListener(onSessionStorageChanged);
});

onBeforeUnmount(() => {
    stopClock();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    browser.storage.onChanged.removeListener(onSessionStorageChanged);
});
</script>

<style scoped>
.tab-badge {
    position: fixed;
    top: 12px;
    right: 16px;
    font-size: 12px;
    color: #aaa;
    line-height: 1;
    z-index: 1;
}

aside {
    height: 40vh;
    max-height: 400px;
    display: flex;
    flex-direction: column;
    > div {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }
    .times {
        font-size: 32px;
        font-weight: bold;
        text-align: center;
        padding: 0 16px;
        word-break: break-word;
    }
    .date {
        font-size: 28px;
    }
}

main {
    > ul {
        margin: 24px auto;
        padding: 0;
        max-width: 320px;
        background: #222;
        border-radius: 12px;
        box-shadow: 0 2px 16px 0 rgba(0,0,0,0.15);
        list-style: none;
        > li {
            border-bottom: 1px solid #333;
            > a {
                display: block;
                padding: 12px 16px;
                color: #eee;
                text-decoration: none;
                font-size: 18px;
            }

            .item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }

            .label {
                flex: 1;
            }

            .value {
                min-width: 3ch;
                text-align: right;
                line-height: 1.2;
            }
        }
        > li:last-child {
            border-bottom: none;
        }
        > li:hover {
            background: #333;
        }
    }
}
</style>
