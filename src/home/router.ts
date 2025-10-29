import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';

import Home from './home.vue';

const routes: RouteRecordRaw[] = [
    {
        path: "/",
        name: "index",
        redirect: "/home",
    },
    {
        path: '/home',
        name: 'Home',
        component: Home,
    },{
        path: '/tabs',
        name: 'Tabs',
        component: () => import('./tabs.vue'),
    },{
        path: '/bookmarks',
        name: 'Bookmarks',
        component: () => import('./bookmarks.vue'),
    },{
        path: '/groups',
        name: 'Groups',
        component: () => import('./group.vue'),
    },{
        path: '/option',
        name: 'Option',
        component: () => import('./option.vue'),
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes,
})

export default router;