<template>
    <aside>
        <div class="date">{{hh}} : {{mm}} : {{ss}}</div>
    </aside>
    <main>
        <div>功能概览</div>
        <ul>
            <li><router-link to="/tabs">标签页管理</router-link></li>
            <li><router-link to="/bookmarks">书签管理</router-link></li>
            <li><router-link to="/groups">分组管理</router-link></li>
            <li><router-link to="/option">配置选项</router-link></li>
        </ul>
    </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
let data = ref<any[]>([]);
const hh = ref(""),mm = ref(""),ss = ref("");

async function updateTime() {
    const now = new Date();
    hh.value = now.getHours().toString().padStart(2, '0');
    mm.value = now.getMinutes().toString().padStart(2, '0');
    ss.value = now.getSeconds().toString().padStart(2, '0');
}

onMounted(() => {
    updateTime();
    setInterval(updateTime, 1000);
});
</script>

<style>
aside {
    height: 200px;
    font-size: 28px;
    > div {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
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
