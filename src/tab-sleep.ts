import type browser from "webextension-polyfill";

export const SLEEP_ALARM = "auto-sleep-tabs";
export const SLEEP_SETTINGS_KEY = "sleepSettings";
export const SLEEP_STATUS_KEY = "sleepStatus";
export const SLEEP_INTERVALS = [2, 10, 30] as const;
export interface SleepSettings {
    enabled: boolean;
    intervalMinutes: 2 | 10 | 30;
}
export interface SleepStatus {
    checkedAt: number;
    discarded: number;
    skipped: number;
    failed: number;
}
export const DEFAULT_SLEEP_SETTINGS: SleepSettings = { enabled: true, intervalMinutes: 10 };

export function normalizeSleepSettings(value: unknown): SleepSettings {
    const candidate = (value && typeof value === "object" ? value : {}) as Partial<SleepSettings>;
    return {
        enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_SLEEP_SETTINGS.enabled,
        intervalMinutes: SLEEP_INTERVALS.includes(candidate.intervalMinutes as SleepSettings["intervalMinutes"])
            ? candidate.intervalMinutes! : DEFAULT_SLEEP_SETTINGS.intervalMinutes,
    };
}

export function sleepBlockedReason(tab: browser.Tabs.Tab): string {
    if (tab.id == null || tab.id < 0) return "标签页不可用";
    if (tab.active) return "正在使用";
    if (tab.discarded) return "已休眠";
    if (tab.pinned) return "已固定";
    if (tab.audible) return "正在播放声音";
    if (tab.autoDiscardable === false) return "已保护";
    if (tab.status === "loading") return "正在加载";
    if (tab.sharingState?.camera || tab.sharingState?.microphone || tab.sharingState?.screen) return "正在共享媒体";
    if (!/^https?:\/\//i.test(tab.url ?? "")) return "浏览器或扩展页面";
    return "";
}

export function sleepCandidates(tabs: browser.Tabs.Tab[], minutes: number, now: number) {
    return tabs.filter(tab => !sleepBlockedReason(tab)
        && typeof tab.lastAccessed === "number" && Number.isFinite(tab.lastAccessed)
        && now - tab.lastAccessed >= minutes * 60_000)
        .sort((a, b) => a.lastAccessed! - b.lastAccessed!);
}

// Injected into every frame; keep this function self-contained.
export function pageNeedsProtection(): boolean {
    if (document.pictureInPictureElement) return true;
    if (Array.from(document.querySelectorAll<HTMLMediaElement>("audio, video"))
        .some(media => (!media.paused && !media.ended)
            // Firefox's native PiP is not exposed through the standard API.
            || (media instanceof HTMLVideoElement && !("pictureInPictureElement" in document)))) return true;
    if (document.querySelector('[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]')) return true;
    return Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"))
        .some(field => {
            if (field instanceof HTMLSelectElement) {
                const options = Array.from(field.options);
                const defaults = options.flatMap((option, index) => option.defaultSelected ? [index] : []);
                const first = options.findIndex(option => !option.disabled && !option.parentElement?.matches("optgroup[disabled]"));
                const initial = field.multiple ? defaults
                    : defaults.length ? [defaults[defaults.length - 1]] : field.size > 1 ? [] : [first];
                return options.some((option, index) => option.selected !== initial.includes(index));
            }
            if (field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type)) return field.checked !== field.defaultChecked;
            return field.value !== field.defaultValue;
        });
}

type SleepBrowser = Pick<typeof browser, "tabs" | "storage" | "alarms" | "scripting">;

export function createTabSleeper(api: SleepBrowser, now = Date.now) {
    let running: Promise<SleepStatus> | undefined;
    let configurationQueue = Promise.resolve();

    async function readSettings() {
        const stored = await api.storage.local.get(SLEEP_SETTINGS_KEY);
        return normalizeSleepSettings(stored[SLEEP_SETTINGS_KEY]);
    }

    function configure() {
        // Serialize changes so a late startup read cannot overwrite a newer setting.
        configurationQueue = configurationQueue.catch(() => {}).then(async () => {
            const settings = await readSettings();
            const alarm = await api.alarms.get(SLEEP_ALARM);
            if (!settings.enabled) {
                await api.alarms.clear(SLEEP_ALARM);
            } else if (!alarm || alarm.periodInMinutes !== settings.intervalMinutes) {
                await api.alarms.create(SLEEP_ALARM, {
                    delayInMinutes: settings.intervalMinutes,
                    periodInMinutes: settings.intervalMinutes,
                });
            }
        });
        return configurationQueue;
    }

    async function discardOne(tabId: number, minutes = 0): Promise<"discarded" | "skipped"> {
        let tab = await api.tabs.get(tabId);
        if (sleepBlockedReason(tab)) return "skipped";
        if (minutes > 0 && !sleepCandidates([tab], minutes, now()).length) return "skipped";
        // Unknown/restricted page state must never be treated as safe to unload.
        const frames = await api.scripting.executeScript({ target: { tabId, allFrames: true }, func: pageNeedsProtection });
        if (!frames.length || frames.some(frame => frame.result !== false)) return "skipped";
        // The user may have switched tabs during asynchronous inspection.
        tab = await api.tabs.get(tabId);
        if (sleepBlockedReason(tab)) return "skipped";
        if (minutes > 0) {
            const latest = await readSettings();
            if (!latest.enabled || latest.intervalMinutes !== minutes || !sleepCandidates([tab], minutes, now()).length) return "skipped";
        }
        await api.tabs.discard(tabId);
        // Firefox may resolve without discarding, e.g. for a beforeunload prompt.
        return (await api.tabs.get(tabId)).discarded ? "discarded" : "skipped";
    }

    function run() {
        if (running) return running;
        running = (async () => {
            const settings = await readSettings();
            const status: SleepStatus = { checkedAt: now(), discarded: 0, skipped: 0, failed: 0 };
            if (!settings.enabled) return status;
            const candidates = sleepCandidates(await api.tabs.query({}), settings.intervalMinutes, now());
            for (const tab of candidates) {
                try {
                    status[await discardOne(tab.id!, settings.intervalMinutes)]++;
                } catch {
                    // A closed/restricted tab must not abort the remaining queue.
                    status.failed++;
                }
            }
            await api.storage.local.set({ [SLEEP_STATUS_KEY]: status });
            return status;
        })().finally(() => { running = undefined; });
        return running;
    }

    return { configure, run, discardOne };
}
