import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createTabSleeper, normalizeSleepSettings, pageNeedsProtection, sleepBlockedReason, sleepCandidates,
    SLEEP_ALARM, SLEEP_SETTINGS_KEY, SLEEP_STATUS_KEY,
} from '../src/tab-sleep.ts';

const now = 2_000_000;
const tab = (id, changes = {}) => ({
    id, windowId: 1, index: id, active: false, pinned: false,
    url: `https://example.org/${id}`, lastAccessed: now - 40 * 60_000,
    discarded: false, status: 'complete', ...changes,
});
function fixture(initialTabs = [tab(1)], initialSettings = { enabled: true, intervalMinutes: 10 }) {
    const tabs = new Map(initialTabs.map(value => [value.id, { ...value }]));
    const storage = { [SLEEP_SETTINGS_KEY]: initialSettings };
    const discarded = [];
    const alarms = new Map();
    let creations = 0;
    const api = {
        storage: { local: {
            async get() { return structuredClone(storage); },
            async set(value) { Object.assign(storage, value); },
        } },
        alarms: {
            async get(name) { return alarms.get(name); },
            async clear(name) { return alarms.delete(name); },
            async create(name, options) { creations++; alarms.set(name, { ...options, scheduledTime: now + options.delayInMinutes * 60_000 }); },
        },
        tabs: {
            async query() { return [...tabs.values()].map(value => ({ ...value })); },
            async get(id) { if (!tabs.has(id)) throw new Error('Tab closed'); return { ...tabs.get(id) }; },
            async discard(id) { discarded.push(id); tabs.get(id).discarded = true; },
        },
        scripting: { async executeScript() { return [{ frameId: 0, result: false }]; } },
    };
    return { api, tabs, storage, discarded, alarms, creations: () => creations, sleeper: createTabSleeper(api, () => now) };
}

test('settings accept only the three intervals and boolean enable flag', () => {
    for (const intervalMinutes of [2, 10, 30]) assert.deepEqual(normalizeSleepSettings({ enabled: false, intervalMinutes }), { enabled: false, intervalMinutes });
    for (const input of [undefined, null, '', { intervalMinutes: 0 }, { intervalMinutes: '2', enabled: 'false' }]) {
        assert.deepEqual(normalizeSleepSettings(input), { enabled: true, intervalMinutes: 10 });
    }
});

test('eligible tabs are selected by inactivity and ordered least recently accessed first', () => {
    const tabs = [tab(1, { lastAccessed: now - 600_000 }), tab(2), tab(3, { lastAccessed: now - 599_999 }), tab(4, { lastAccessed: undefined }), tab(5, { lastAccessed: NaN }), tab(6, { lastAccessed: now + 1 })];
    assert.deepEqual(sleepCandidates(tabs, 10, now).map(tab => tab.id), [2, 1]);
    assert.deepEqual(sleepCandidates(tabs, 30, now).map(tab => tab.id), [2]);
});

test('active, pinned, playing, sharing, protected, loading and internal tabs are excluded', () => {
    const changes = [
        { active: true }, { pinned: true }, { audible: true }, { discarded: true }, { autoDiscardable: false },
        { status: 'loading' }, { sharingState: { camera: true } }, { sharingState: { microphone: true } },
        { sharingState: { screen: 'Screen' } }, { url: 'about:newtab' }, { url: 'moz-extension://id/src/home/index.html' },
        { url: undefined }, { id: undefined }, { id: -1 },
    ];
    for (const change of changes) assert.ok(sleepBlockedReason(tab(1, change)), JSON.stringify(change));
    assert.equal(sleepBlockedReason(tab(1)), '');
    assert.deepEqual(sleepCandidates(changes.map((change, index) => tab(index, change)), 2, now), []);
});

test('alarm uses saved interval, retains deadline on background restart, and is recreated if absent', async () => {
    const f = fixture();
    await f.sleeper.configure();
    const scheduled = f.alarms.get(SLEEP_ALARM);
    assert.equal(scheduled.periodInMinutes, 10);
    await f.sleeper.configure();
    assert.equal(f.creations(), 1);
    f.alarms.clear();
    await createTabSleeper(f.api, () => now).configure();
    assert.equal(f.creations(), 2);
});

test('changing 2 / 10 / 30 minute settings reschedules and disabling clears alarm', async () => {
    const f = fixture();
    for (const intervalMinutes of [2, 10, 30]) {
        f.storage[SLEEP_SETTINGS_KEY] = { enabled: true, intervalMinutes };
        await f.sleeper.configure();
        assert.equal(f.alarms.get(SLEEP_ALARM).periodInMinutes, intervalMinutes);
    }
    f.storage[SLEEP_SETTINGS_KEY].enabled = false;
    await f.sleeper.configure();
    assert.equal(f.alarms.has(SLEEP_ALARM), false);
    await f.sleeper.run();
    assert.deepEqual(f.discarded, []);
});

test('overlapping checks share a run and save actual outcomes in LRU order', async () => {
    const f = fixture([tab(1, { lastAccessed: now - 600_000 }), tab(2), tab(3, { active: true })]);
    const first = f.sleeper.run();
    const second = f.sleeper.run();
    assert.equal(first, second);
    assert.deepEqual(await first, { checkedAt: now, discarded: 2, skipped: 0, failed: 0 });
    assert.deepEqual(f.discarded, [2, 1]);
    assert.equal(f.storage[SLEEP_STATUS_KEY].discarded, 2);
});

test('media, dirty forms or picture-in-picture in any frame prevent discard', async () => {
    const f = fixture();
    f.api.scripting.executeScript = async () => [{ frameId: 0, result: false }, { frameId: 5, result: true }];
    assert.equal((await f.sleeper.run()).skipped, 1);
    assert.deepEqual(f.discarded, []);
});

test('empty or failed frame results never count as safe', async () => {
    for (const result of [[], [{ frameId: 0, result: undefined }], [{ frameId: 0, error: 'Denied' }]]) {
        const f = fixture();
        f.api.scripting.executeScript = async () => result;
        assert.equal((await f.sleeper.run()).skipped, 1);
        assert.deepEqual(f.discarded, []);
    }
});

test('a tab activated while being inspected is retained', async () => {
    const f = fixture();
    f.api.scripting.executeScript = async () => { f.tabs.get(1).active = true; return [{ result: false }]; };
    assert.equal((await f.sleeper.run()).skipped, 1);
    assert.deepEqual(f.discarded, []);
});

test('new recent activity and interval changes during inspection cancel discard', async () => {
    for (const change of [
        f => { f.tabs.get(1).lastAccessed = now; },
        f => { f.storage[SLEEP_SETTINGS_KEY].enabled = false; },
        f => { f.storage[SLEEP_SETTINGS_KEY].intervalMinutes = 30; },
    ]) {
        const f = fixture();
        f.api.scripting.executeScript = async () => { change(f); return [{ result: false }]; };
        assert.equal((await f.sleeper.run()).skipped, 1);
        assert.deepEqual(f.discarded, []);
    }
});

test('one closed or restricted tab does not abort subsequent tabs', async () => {
    const f = fixture([tab(1), tab(2)]);
    f.api.scripting.executeScript = async ({ target }) => { if (target.tabId === 1) throw new Error('Access denied'); return [{ result: false }]; };
    assert.deepEqual(await f.sleeper.run(), { checkedAt: now, discarded: 1, failed: 1, skipped: 0 });
    assert.deepEqual(f.discarded, [2]);
});

test('resolved but refused discard is reported as skipped', async () => {
    const f = fixture();
    f.api.tabs.discard = async () => {};
    assert.deepEqual(await f.sleeper.run(), { checkedAt: now, discarded: 0, failed: 0, skipped: 1 });
});

test('manual sleep ignores inactivity threshold but still honors protection', async () => {
    const f = fixture([tab(1, { lastAccessed: now }), tab(2, { pinned: true })], { enabled: false, intervalMinutes: 30 });
    assert.equal(await f.sleeper.discardOne(1), 'discarded');
    assert.equal(await f.sleeper.discardOne(2), 'skipped');
    assert.deepEqual(f.discarded, [1]);
});

function inspectPage({ media = [], fields = [], pip = null, editable = false, firefox = false } = {}) {
    class Input { constructor(values) { Object.assign(this, values); } }
    class Select { constructor(values) { Object.assign(this, { multiple: false, size: 0 }, values); } }
    class Video { constructor(values) { Object.assign(this, { paused: true, ended: false }, values); } }
    const names = ['document', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLVideoElement'];
    const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
    try {
        globalThis.HTMLInputElement = Input;
        globalThis.HTMLSelectElement = Select;
        globalThis.HTMLVideoElement = Video;
        globalThis.document = {
            ...(!firefox ? { pictureInPictureElement: pip } : {}),
            querySelector() { return editable ? {} : null; },
            querySelectorAll(selector) {
                if (selector === 'audio, video') return media.map(value => new Video(value));
                return fields.map(value => value.options ? new Select(value) : new Input(value));
            },
        };
        return pageNeedsProtection();
    } finally {
        for (const [name, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
}

test('plain pages and unchanged controls can unload, while edited controls are protected', () => {
    assert.equal(inspectPage(), false);
    assert.equal(inspectPage({ fields: [{ value: 'initial', defaultValue: 'initial' }] }), false);
    assert.equal(inspectPage({ fields: [{ value: 'edited', defaultValue: 'initial' }] }), true);
    assert.equal(inspectPage({ fields: [{ type: 'checkbox', checked: true, defaultChecked: false }] }), true);
});

test('implicit first select option is not mistaken for an unsaved edit', () => {
    const options = [{ selected: true, defaultSelected: false }, { selected: false, defaultSelected: false }];
    assert.equal(inspectPage({ fields: [{ options }] }), false);
    assert.equal(inspectPage({ fields: [{ options: options.map(option => ({ ...option, selected: !option.selected })) }] }), true);
});

test('playing media, PiP, editors and Firefox video pages are protected', () => {
    assert.equal(inspectPage({ media: [{ paused: false }] }), true);
    assert.equal(inspectPage({ media: [{}] }), false);
    assert.equal(inspectPage({ pip: {} }), true);
    assert.equal(inspectPage({ editable: true }), true);
    assert.equal(inspectPage({ firefox: true, media: [{}] }), true);
});
