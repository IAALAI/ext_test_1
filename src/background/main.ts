import browser from "webextension-polyfill";
import MessageType from "~/messages.type";

async function updateCounterBadge() {
    browser.tabs.query({}).then((tabs) => browser.action.setBadgeText({ text: `${tabs.length}` }));
}

browser.tabs.onUpdated.addListener(() => { updateCounterBadge()});
browser.tabs.onCreated.addListener(() => { updateCounterBadge()});
browser.tabs.onRemoved.addListener(() => { updateCounterBadge()});
browser.tabs.onActivated.addListener(() => updateCounterBadge());

function updateConfigNotification() {

}

browser.runtime.onMessage.addListener((request: { type: string; config?: any }, sender, sendResponse: ({}) => void) => {
    switch (request.type) {
        case MessageType.GET_CONFIG: browser.storage.local.get("config").then((data) => {
            sendResponse({ config: data.config });
        }); break;
        case MessageType.SET_CONFIG: if (request.config) {
            browser.storage.local.set({ config: request.config }).then(() => {
                sendResponse({});
            });
            updateConfigNotification();
        } break;
    }
});