import { onBeforeUnmount, onMounted, ref } from "vue";

export function useTask() {
    const busy = ref(false);
    const error = ref("");
    const notice = ref("");
    async function run(task: () => Promise<unknown>, success = "") {
        if (busy.value) return;
        busy.value = true;
        error.value = "";
        notice.value = "";
        try {
            await task();
            if (success) notice.value = success;
        } catch (cause) {
            error.value = cause instanceof Error ? cause.message : String(cause);
        } finally {
            busy.value = false;
        }
    }
    return { busy, error, notice, run };
}

interface ChangeEvent {
    addListener(listener: () => void): void;
    removeListener(listener: () => void): void;
}
export function useRefresh(load: () => Promise<void>, events: ChangeEvent[], onError: (error: unknown) => void) {
    const loading = ref(true);
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    let pending = false;
    let refreshing = false;
    async function refresh() {
        if (disposed) return;
        if (refreshing) { pending = true; return; }
        refreshing = true;
        try { await load(); } catch (error) { onError(error); }
        finally {
            loading.value = false;
            refreshing = false;
            if (pending) { pending = false; void refresh(); }
        }
    }
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(() => { void refresh(); }, 100);
    }
    onMounted(() => {
        events.forEach(event => event.addListener(schedule));
        void refresh();
    });
    onBeforeUnmount(() => {
        disposed = true;
        clearTimeout(timer);
        events.forEach(event => event.removeListener(schedule));
    });
    return { loading, refresh };
}
