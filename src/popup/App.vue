<template>
    <img src="https://examplefile.com/storage/file/file_icons/svg.png" height="45" alt="" />
    <div>now work tabs: {{ tabs_count }}</div>
    <div>now bookmarks: {{ bookmarks_count }}</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

let tabs_count = ref(0);
let bookmarks_count = ref(0);

chrome.tabs.query({}, (tabs) => {
    tabs_count.value = tabs.length;
});

chrome.bookmarks.getTree((bookmarkTreeNodes) => {
    function countBookmarks(nodes: chrome.bookmarks.BookmarkTreeNode[]): number {
        let count = 0;
        for (const node of nodes) {
            if (node.url) {
                count += 1;
            }
            if (node.children) {
                count += countBookmarks(node.children);
            }
        }
        return count;
    }
    bookmarks_count.value = countBookmarks(bookmarkTreeNodes);
});
</script>

<style>
main {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

h1 {
  margin: 5px;
}

button {
  margin-top: 10px;
}
</style>
