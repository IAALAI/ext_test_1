import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import webExtension from "@samrum/vite-plugin-web-extension";
import path from "path";
import { getManifest } from "./src/manifest";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const isDev = mode === "development";
    return {
        plugins: [
            vue(),
            webExtension({
                manifest: getManifest(Number(env.MANIFEST_VERSION)),
            }),
        ],
        server: isDev
            ? {
                  cors: true,
                  headers: {
                      "Access-Control-Allow-Origin": "*",
                      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                      "Access-Control-Allow-Headers": "*",
                  },
              }
            : undefined,
        resolve: {
            alias: {
                "~": path.resolve(__dirname, "./src"),
            },
        },
    };
});
