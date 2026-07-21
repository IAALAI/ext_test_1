import browser from "webextension-polyfill";

let tabsUpdateTimer: number | null = null;
let groupsUpdateTimer: number | null = null;
let bookmarksUpdateTimer: number | null = null;

function debounceTabsUpdate() {
    if (tabsUpdateTimer) clearTimeout(tabsUpdateTimer);
    tabsUpdateTimer = setTimeout(updateTabsInfo, 100);
}

function debounceGroupsUpdate() {
    if (groupsUpdateTimer) clearTimeout(groupsUpdateTimer);
    groupsUpdateTimer = setTimeout(updateGroupInfo, 100);
}

function debounceBookmarksUpdate() {
    if (bookmarksUpdateTimer) clearTimeout(bookmarksUpdateTimer);
    bookmarksUpdateTimer = setTimeout(updateBookmarksInfo, 100);
}

async function updateTabsInfo() {
    const tabsInfo = await browser.tabs.query({});
    await browser.storage.session.set({ tabsInfo });
    await browser.action.setBadgeText({ text: `${tabsInfo.length}` });
}

async function updateGroupInfo() {
    const groupInfo = await chrome.tabGroups.query({});
    await browser.storage.session.set({ groupInfo });
}

async function updateBookmarksInfo() {
    const bookmarks = await browser.bookmarks.getTree();
    await browser.storage.session.set({ bookmarks });
}

browser.tabs.onUpdated.addListener(() => debounceTabsUpdate());
browser.tabs.onCreated.addListener(() => debounceTabsUpdate());
browser.tabs.onRemoved.addListener(() => debounceTabsUpdate());
browser.tabs.onActivated.addListener(() => debounceTabsUpdate());
chrome.tabGroups.onCreated.addListener(() => debounceGroupsUpdate());
chrome.tabGroups.onRemoved.addListener(() => debounceGroupsUpdate());
chrome.tabGroups.onUpdated.addListener(() => debounceGroupsUpdate());
browser.bookmarks.onCreated.addListener(() => debounceBookmarksUpdate());
browser.bookmarks.onRemoved.addListener(() => debounceBookmarksUpdate());
browser.bookmarks.onChanged.addListener(() => debounceBookmarksUpdate());
browser.bookmarks.onMoved.addListener(() => debounceBookmarksUpdate());

updateTabsInfo();
updateGroupInfo();
updateBookmarksInfo();