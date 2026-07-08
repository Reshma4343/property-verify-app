(function () {
    "use strict";

    const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

    window.APP_CONFIG = {
        ...(window.APP_CONFIG || {}),
        ...(isLocalHost ? { apiBaseUrl: "" } : {}),
    };
})();
