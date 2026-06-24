(function () {
    "use strict";

    window.APP_CONFIG = {
        ...(window.APP_CONFIG || {}),
        envName: "qa",
        apiBaseUrl: "http://localhost:4243",
        useFakeOtp: true,

        firebase: {
            apiKey: "YOUR_QA_API_KEY",
            authDomain: "property-verify-qa.firebaseapp.com",
            projectId: "property-verify-qa",
            storageBucket: "property-verify-qa.firebasestorage.app",
            messagingSenderId: "1070288855107",
            appId: "1:1070288855107:web:554994e8b15f5b0b0fb4f6",
            measurementId: "G-HNYGG2NL2D",
        },
    };
})();