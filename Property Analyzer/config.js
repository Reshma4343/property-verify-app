(function () {
    "use strict";

    const hostname = window.location.hostname;
    const isLocalHost = ["localhost", "127.0.0.1"].includes(hostname);
    const isQaHost = isLocalHost || hostname.includes("property-verify-qa");

    const qaConfig = {
        envName: "qa",
        apiBaseUrl: "https://property-verify-app-2.onrender.com",
        razorpayKeyId: "rzp_live_TAvYZpr6xdIgMU",
        useFakeOtp: true,

        firebase: {
            apiKey: "AIzaSyCxyJ8u_ZO5GwaXrjA6574p3s40gnTgEbE",
            authDomain: "property-verify-qa.firebaseapp.com",
            projectId: "property-verify-qa",
            storageBucket: "property-verify-qa.firebasestorage.app",
            messagingSenderId: "1070288855107",
            appId: "1:1070288855107:web:554994e8b15f5b0b0fb4f6",
            measurementId: "G-HNYGG2NL2D",
        },
    };

    const prodConfig = {
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

    window.APP_CONFIG = {
        ...(window.APP_CONFIG || {}),
        ...(isQaHost ? qaConfig : prodConfig),
        ...(isLocalHost ? { apiBaseUrl: "" } : {}),
    };
})();
