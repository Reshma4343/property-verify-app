(function () {
    "use strict";

    window.APP_CONFIG = {
        ...(window.APP_CONFIG || {}),
        envName: "production",
        apiBaseUrl: "https://property-verify-app-2.onrender.com",
        useFakeOtp: false,

        firebase: {
            apiKey: "AIzaSyAV2whuhVhfME4oKuTXAlt4v4iOLg_2rIY",
            authDomain: "property-1b194.firebaseapp.com",
            projectId: "property-1b194",
            storageBucket: "property-1b194.firebasestorage.app",
            messagingSenderId: "982652657169",
            appId: "1:982652657169:web:441563b3a3667757401bb0",
            measurementId: "G-73ZL6L3DB9",
        },
    };
})();
