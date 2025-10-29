<template>
    <main @click="router.back()">
        <div></div>
        <h1>option</h1>
        <div></div>
    </main>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import MessageType from '../messages.type';
import Browser from 'webextension-polyfill';
import { onMounted, ref } from 'vue';

const router = useRouter();

const configData = ref({});

async function getConfig() {
    try {
        const response = await Browser.runtime.sendMessage({ type: MessageType.GET_CONFIG });
        if (response) {
            configData.value = response.config;
        }
    } catch (error) {
        console.error("Failed to get config:", error);
    }
};

onMounted(() => {
    getConfig();

    Browser.runtime.onMessage.addListener((request) => {
        if (request.type === MessageType.CONFIG_UPDATE) {
            configData.value = request.config;
        }
    })
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
</style>
