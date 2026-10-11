// Shim for 'electron' module in mobile (WebView) context
const noop = () => undefined;

// On mobile there is no separate main process: "host" and "guest" both live in the
// WebView. This is a minimal in-process IPC bus so flows like the ad coordinator's
// request-send-ad -> grant-send-ad round-trip actually complete (without it the shared
// posting throat deadlocks and the send button stops responding).
const rendererListeners = {}; // channel -> Set of callbacks
const mainHandlers = {};      // channel -> handler(event, ...args)

function emitToRenderer(channel) {
    const set = rendererListeners[channel];
    if (!set) return;
    const args = Array.prototype.slice.call(arguments, 1);
    // first listener arg is the unused IpcRendererEvent
    set.forEach(fn => fn.apply(null, [{}].concat(args)));
}

const mainEvent = {
    reply: function (channel) {
        emitToRenderer.apply(null, arguments);
    },
};

module.exports = {
    app: {
        getLocale: () => 'en-GB',
        getPath: () => '/',
        getVersion: () => '',
        getLocaleCountryCode: () => '',
    },
    shell: { openExternal: noop, openPath: noop },
    clipboard: { writeText: noop, readText: () => '' },
    ipcRenderer: {
        on: (channel, fn) => {
            if (!rendererListeners[channel]) rendererListeners[channel] = new Set();
            rendererListeners[channel].add(fn);
        },
        removeListener: (channel, fn) => {
            if (rendererListeners[channel]) rendererListeners[channel].delete(fn);
        },
        send: (channel, ...args) => {
            if (channel === 'general-settings-update' && window.__setGeneralSettings) {
                window.__setGeneralSettings(args[0]);
                return;
            }
            const handler = mainHandlers[channel];
            if (handler) handler.apply(null, [mainEvent].concat(args));
        },
        invoke: () => Promise.resolve(),
    },
    ipcMain: {
        on: (channel, fn) => { mainHandlers[channel] = fn; },
        // Electron's ipcMain is an EventEmitter, so emit() is a main-local dispatch with the args
        // passed as-is (no event object). Shared code reaches it through @electron/remote: the eicon
        // store announces 'eicons.reload' after every save, and without emit() that call threw and
        // left the eicon picker's refresh spinning forever (issue 23).
        emit: (channel, ...args) => {
            const handler = mainHandlers[channel];
            if (handler) handler.apply(null, args);
            return !!handler;
        },
    },
};
