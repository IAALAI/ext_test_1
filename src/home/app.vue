<template>
    <div class="app">
        <RouterView v-slot="{ Component }">
            <KeepAlive>
                <component :is="Component" />
            </KeepAlive>
        </RouterView>
    </div>
</template>

<script setup lang="ts">
import { KeepAlive } from "vue";
import { RouterView } from "vue-router";
</script>

<style>
</style>
