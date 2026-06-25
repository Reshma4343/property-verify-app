(function () {
    "use strict";

    window.APP_CONFIG = {
        ...(window.APP_CONFIG || {}),
        envName: "qa",
        apiBaseUrl: "https://property-verify-app-2.onrender.com",
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
})();
