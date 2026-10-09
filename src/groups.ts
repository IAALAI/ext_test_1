import type browser from "webextension-polyfill";

export type Group = chrome.tabGroups.TabGroup;
export type GroupColor = chrome.tabGroups.ColorEnum;
export type GroupTab = browser.Tabs.Tab & { groupId?: number };

// The installed polyfill predates tabGroups. Use native promise-based APIs.
interface NativeGroups {
    tabGroups?: {
        query(query: object): Promise<Group[]>;
        update(id: number, changes: { title?: string; color?: GroupColor; collapsed?: boolean }): Promise<Group>;
        onCreated: browser.Events.Event<() => void>;
        onRemoved: browser.Events.Event<() => void>;
        onUpdated: browser.Events.Event<() => void>;
        onMoved: browser.Events.Event<() => void>;
    };
    tabs: {
        group?: (options: { tabIds: number[]; groupId?: number }) => Promise<number>;
        ungroup?: (tabIds: number[]) => Promise<void>;
    };
}
const native = ((globalThis as typeof globalThis & { browser?: NativeGroups }).browser
    ?? globalThis.chrome) as unknown as NativeGroups;
export const groupApi = native.tabGroups;
export const groupsSupported = !!(groupApi && native.tabs.group && native.tabs.ungroup);
export const groupColors: { value: GroupColor; label: string; hex: string }[] = [
    { value: "blue", label: "蓝色", hex: "#80b5ff" },
    { value: "green", label: "绿色", hex: "#83d5a0" },
    { value: "red", label: "红色", hex: "#f28b82" },
    { value: "yellow", label: "黄色", hex: "#fdd663" },
    { value: "purple", label: "紫色", hex: "#c6a0ee" },
    { value: "pink", label: "粉色", hex: "#ffb1d0" },
    { value: "cyan", label: "青色", hex: "#78d9ec" },
    { value: "orange", label: "橙色", hex: "#ffb66b" },
    { value: "grey", label: "灰色", hex: "#a8adb5" },
];
export const queryGroups = () => groupsSupported ? groupApi!.query({}) : Promise.resolve([]);
export const groupTabs = (tabIds: number[], groupId?: number) => {
    if (!groupsSupported) throw new Error("当前浏览器不支持原生分组，请使用 Firefox 139 或更新版本。");
    return native.tabs.group!({ tabIds, ...(groupId == null ? {} : { groupId }) });
};
export const ungroupTabs = (tabIds: number[]) => {
    if (!groupsSupported) throw new Error("当前浏览器不支持原生分组。");
    return native.tabs.ungroup!(tabIds);
};
