(function () {
    "use strict";

    const hostname = window.location.hostname;
    const isLocalHost = ["localhost", "127.0.0.1"].includes(hostname);
    const isProductionHost = [
        "asliproperty.in",
        "www.asliproperty.in",
        "property-1b194.web.app",
        "property-1b194.firebaseapp.com",
    ].includes(hostname);

    const productionConfig = {
        envName: "production",
        apiBaseUrl: "https://property-verify-app-1.onrender.com",
        razorpayKeyId: "rzp_live_TAvYZpr6xdIgMU",
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
        ...(isProductionHost ? productionConfig : {}),
        ...(isLocalHost ? { apiBaseUrl: "" } : {}),
    };
})();
