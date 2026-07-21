<template>
    <aside>
        <nav>
            <div @click="router.back()">back</div>
            <div @click="router.push('/')">Tabs</div>
            <div>aa</div>
        </nav>
    </aside>
    <main>
        <div class="table_head">

        </div>
        <div class="table">

        </div>
    </main>
</template>

<script setup lang="ts">
import browser from "webextension-polyfill";
import { onMounted, ref } from 'vue';
import router from './router';
import MessageType from "~/messages.type";

const tabsInfo = ref<browser.Tabs.Tab[]>();

async function fetchTabsInfo() {
    const tabs = await browser.tabs.query({});
    tabsInfo.value = tabs;
}

browser.runtime.onMessage.addListener((message) => {
    switch (message.type) {
        case MessageType.update_tabs_info: fetchTabsInfo(); break;
    }
});

onMounted(() => {
    fetchTabsInfo();
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

}
</style>
