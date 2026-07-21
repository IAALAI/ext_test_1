
<template>
    <aside>
        <nav>
            <div @click="router.back()">back</div>
            <div @click="router.push('/')">Groups</div>
            <div>aa</div>
        </nav>
    </aside>
    <main>
        <div id="app">
            <div class="content">
                <ul class="group_enum">
                    <li class="group_item"  v-for="item in groupInfo" :key="item.id" :style="{ backgroundColor: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), ${item.color}` }">
                        <div class="title">{{ item.title }}</div>
                        <div>{{ tabs_count[item.id] }}</div>
                    </li>
                </ul>
            </div>
        </div>
    </main>
</template>

<script setup lang="ts">
import browser from "webextension-polyfill";
import { onMounted, ref } from 'vue';
import router from './router';
import MessageType from "~/messages.type";

type TabWithGroupId = browser.Tabs.Tab & {
    groupId?: number;
};

const _tabsInfo_ = ref<browser.Tabs.Tab[]>();
const tabsInfo = ref<browser.Tabs.Tab[]>([]);
const groupInfo = ref<chrome.tabGroups.TabGroup[]>([]);
const tabs_count = ref<Record<number, number>>({});

const getTabsInfo = () => browser.tabs.query({});

const getGroupsInfo = () => chrome.tabGroups.query({});

async function fetchTabsInfo() {
    const tabs = await browser.tabs.query({});
    _tabsInfo_.value = tabs;
}

browser.runtime.onMessage.addListener((message) => {
    switch (message.type) {
        case MessageType.update_tabs_info: fetchTabsInfo(); break;
    }
});

onMounted(async () => {
    fetchTabsInfo();
    tabsInfo.value = await getTabsInfo();
    groupInfo.value = await getGroupsInfo();
    for (const group of groupInfo.value) {
        tabs_count.value[group.id] = 0;
    }
    for (const tab of tabsInfo.value as TabWithGroupId[]) {
        if (typeof tab.groupId === 'number' && tab.groupId >= 0) {
            tabs_count.value[tab.groupId] = (tabs_count.value[tab.groupId] ?? 0) + 1;
        }
    }
});
</script>

<style scoped>
aside {
    height: 10vh;
    max-height: 100px;
    width: 100vw;
    > nav {
        font-size: 24px;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        margin: 24px;
    }
}

main {
    height: 90vh;
    overflow-y: auto;
}

#app {
    .content {
        > ul {
            max-width: 900px;

            margin: 12px auto;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: clamp(8px, 1.2vw, 14px);
            list-style: none;
            > li {
                padding: 12px 16px;
                border: 3px solid white;
                border-radius: 12px;
                /* background: blur(12px); */
                box-shadow: 0 2px 16px 0 rgba(0,0,0,0.15);
                color: white;
                .title {
                    font-size: 18px;
                    text-shadow:
                        0 1px 0 rgba(0, 0, 0, 0.9),
                        1px 0 0 rgba(0, 0, 0, 0.9),
                        0 -1px 0 rgba(0, 0, 0, 0.9),
                        -1px 0 0 rgba(0, 0, 0, 0.9);
                }
            }
        }
    }
}
</style>
