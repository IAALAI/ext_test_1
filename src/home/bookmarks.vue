<template>
    <aside>
        <nav>
            <div @click="router.back()">back</div>
            <div @click="router.push('/')">bookmarks</div>
            <div>aa</div>
        </nav>
    </aside>
    <main>
        <div class="table">

        </div>
    </main>
</template>

<script setup lang="ts">
import browser from "webextension-polyfill";
import { onMounted, ref } from 'vue';
import router from './router';
const bookmarksInfo = ref<browser.Bookmarks.BookmarkTreeNode[] | null>(null);

async function fetchBookmarksInfo() {
    bookmarksInfo.value = await browser.bookmarks.getTree();
}

onMounted(() => {
    fetchBookmarksInfo();
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
