import browser from "webextension-polyfill";
import { groupApi, queryGroups } from "../groups";

function report(error: unknown) { console.error("New Tabs:", error); }
function debounce(task: () => Promise<void>) {
    let timer: ReturnType<typeof setTimeout>;
    return () => {
        clearTimeout(timer);
        timer = setTimeout(() => { void task().catch(report); }, 100);
    };
}

async function updateTabsInfo() {
    const tabsInfo = await browser.tabs.query({});
    await browser.storage.session.set({ tabsInfo });
    await browser.action.setBadgeText({ text: `${tabsInfo.length}` });
}
async function updateGroupInfo() {
    await browser.storage.session.set({ groupInfo: await queryGroups() });
}
async function updateBookmarksInfo() {
    await browser.storage.session.set({ bookmarks: await browser.bookmarks.getTree() });
}
const refreshTabs = debounce(updateTabsInfo);
const refreshGroups = debounce(updateGroupInfo);
const refreshBookmarks = debounce(updateBookmarksInfo);

for (const event of [browser.tabs.onUpdated, browser.tabs.onCreated, browser.tabs.onRemoved,
    browser.tabs.onActivated, browser.tabs.onMoved, browser.tabs.onAttached, browser.tabs.onDetached]) {
    event.addListener(refreshTabs);
}
if (groupApi) {
    for (const event of [groupApi.onCreated, groupApi.onRemoved, groupApi.onUpdated, groupApi.onMoved]) {
        event.addListener(refreshGroups);
    }
}
for (const event of [browser.bookmarks.onCreated, browser.bookmarks.onRemoved, browser.bookmarks.onChanged, browser.bookmarks.onMoved]) {
    event.addListener(refreshBookmarks);
}

for (const task of [updateTabsInfo, updateGroupInfo, updateBookmarksInfo]) {
    void task().catch(report);
}
