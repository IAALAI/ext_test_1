import pkg from "../package.json" with { type: "json" };

const sharedManifest: Partial<chrome.runtime.ManifestBase> = {
    "browser_specific_settings": {
        "gecko": {
            "id": "@iaalai_tabs",
            "strict_min_version": "115.0",
            "data_collection_permissions": {
                "required": [ "none" ],
            }
        }
    },
    icons: {
        16: "icon/logo_16.png",
        32: "icon/logo_32.png",
        48: "icon/logo_48.png",
        128: "icon/logo_128.png",
    },
    content_scripts: [
        {
            js: ["src/contentScript/primary/main.ts"],
            matches: ["*://*/*"],
        },
    ],
    permissions: ["tabs", "tabGroups", "bookmarks", "storage", "sessions"],
    chrome_url_overrides: {
        newtab: "src/home/index.html",
    },
};

const browserAction = {
    default_icon: {
        16: "icon/logo_16.png",
        32: "icon/logo_32.png",
        48: "icon/logo_48.png",
        128: "icon/logo_128.png",
    },
    default_popup: "src/popup/index.html",
};

const ManifestV2 = {
    ...sharedManifest,
    background: {
        scripts: ["src/background/script.ts"],
        persistent: true,
    },
    browser_action: browserAction,
    permissions: [...sharedManifest.permissions, "*://*/*"],
};

const ManifestV3 = {
    ...sharedManifest,
    action: browserAction,
    background: {
        scripts: ["src/background/serviceWorker.ts"],
        service_worker: "src/background/serviceWorker.ts",
    },
    host_permissions: ["*://*/*"],
};

export function getManifest(manifestVersion: number): chrome.runtime.ManifestV2 | chrome.runtime.ManifestV3 {
    const manifest = {
        author: pkg.author,
        description: pkg.description,
        name: pkg.displayName ?? pkg.name,
        version: pkg.version,
    };

    if (manifestVersion === 2) {
        return {
            ...manifest,
            ...ManifestV2,
            manifest_version: manifestVersion,
        };
    }

    if (manifestVersion === 3) {
        return {
            ...manifest,
            ...ManifestV3,
            manifest_version: manifestVersion,
        };
    }

    throw new Error(
        `Missing manifest definition for manifestVersion ${manifestVersion}`
    );
}
