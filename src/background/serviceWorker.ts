import browser from "webextension-polyfill";
import { groupApi, queryGroups } from "../groups";
import { createTabSleeper, SLEEP_ALARM, SLEEP_SETTINGS_KEY } from "../tab-sleep";

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

const sleeper = createTabSleeper(browser);
browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === SLEEP_ALARM) void sleeper.run().then(refreshTabs).catch(report);
});
browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SLEEP_SETTINGS_KEY]) void sleeper.configure().catch(report);
});
// Recreate alarms after browser restart, but keep a still-valid alarm's deadline.
browser.runtime.onStartup.addListener(() => { void sleeper.configure().catch(report); });
browser.runtime.onInstalled.addListener(() => { void sleeper.configure().catch(report); });
browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id || !sender.url?.startsWith(browser.runtime.getURL(""))) return;
    if (message?.type === "SLEEP_TAB" && Number.isInteger(message.tabId)) {
        return sleeper.discardOne(message.tabId).then(result => { refreshTabs(); return { result }; });
    }
    if (message?.type === "CHECK_SLEEP_TABS") {
        return sleeper.run().then(status => { refreshTabs(); return status; });
    }
});

for (const task of [updateTabsInfo, updateGroupInfo, updateBookmarksInfo, sleeper.configure]) {
    void task().catch(report);
}
