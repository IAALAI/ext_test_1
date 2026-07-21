<template>
    <aside>
        <div class="times">{{hh}} : {{mm}} : {{ss}}</div>
        <div class="date">{{days}} , {{month}} , {{day}}</div>
    </aside>
    <main>
        <div>功能概览</div>
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
                        <div class="label">书签管理</div>
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
            <li><router-link to="/option">
                <div class="item">
                    <div class="label">选项设置</div>
                    <div class="value value--placeholder">0</div>
                </div>
            </router-link></li>
        </ul>
    </main>
</template>

<script setup lang="ts">
import browser from "webextension-polyfill";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { countBookmarks } from "~/common";
let data = ref<any[]>([]),
    tabs_count = ref(0),
    marks_count = ref(0),
    groups_count = ref(0),
    now = new Date();

const hh = ref(""),
    mm = ref(""),
    ss = ref(""),
    day = now.getDate().toString().padStart(2, '0'),
    month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now),
    days = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);

async function updateTime() {
    now = new Date();
    hh.value = now.getHours().toString().padStart(2, '0');
    mm.value = now.getMinutes().toString().padStart(2, '0');
    ss.value = now.getSeconds().toString().padStart(2, '0');
}

async function getCount() {
    const { tabsInfo, groupInfo, bookmarks } = await browser.storage.session.get([
        "tabsInfo",
        "groupInfo",
        "bookmarks"
    ]);
    tabs_count.value = Array.isArray(tabsInfo) ? tabsInfo.length : 0;
    groups_count.value = Array.isArray(groupInfo) ? groupInfo.length : 0;
    marks_count.value = Array.isArray(bookmarks) ? countBookmarks(bookmarks) : 0;
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
    if (changes.groupInfo) {
        const next = changes.groupInfo.newValue;
        groups_count.value = Array.isArray(next) ? next.length : 0;
    }
    if (changes.bookmarks) {
        const next = changes.bookmarks.newValue;
        marks_count.value = Array.isArray(next) ? countBookmarks(next) : 0;
    }
}

onMounted(() => {
    updateTime();
    setInterval(updateTime, 1000);
    getCount();
    browser.storage.onChanged.addListener(onSessionStorageChanged);
});

onBeforeUnmount(() => {
    browser.storage.onChanged.removeListener(onSessionStorageChanged);
});
</script>

<style scoped>
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
    }
    .date {
        font-size: 28px;
    }
}

main {
    > div {
        font-size: 24px;
        margin-bottom: 10px;
        text-align: center;
    }
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

            .value--placeholder {
                visibility: hidden;
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
