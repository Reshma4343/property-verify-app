// script.js

let userData = { name: "", phone: "", email: "", locality: "", budget: "" };
let firebaseConfirmationResult = null;
let selectedAuditFiles = [];
let currentAuditTrackId = null;
let fakeOtp = null;
const USE_FAKE_OTP = true;
let lastFreeInsightDocId = null;

// Embedded sample report PDF (base64, non-editable, opens in all browsers)
const SAMPLE_REPORT_B64 = "JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgaHR0cDovL3d3dy5yZXBvcnRsYWIuY29tCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUgo+PgplbmRvYmoKMiAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjEgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iagozIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhLUJvbGQgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YyIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNCAwIG9iago8PAovQ29udGVudHMgMTAgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgMTEgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovQ29udGVudHMgMTIgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNyAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDkgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9BdXRob3IgKFwoYW5vbnltb3VzXCkpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjA1MTEwNTU3NTArMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjA1MTEwNTU3NTArMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIHd3dy5yZXBvcnRsYWIuY29tKSAKICAvU3ViamVjdCAoXCh1bnNwZWNpZmllZFwpKSAvVGl0bGUgKFwoYW5vbnltb3VzXCkpIC9UcmFwcGVkIC9GYWxzZQo+PgplbmRvYmoKOSAwIG9iago8PAovQ291bnQgMyAvS2lkcyBbIDQgMCBSIDUgMCBSIDYgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iagoxMCAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxNDM3Cj4+CnN0cmVhbQpHYXUwQz5CP04yJjpYQFRvVjYmNyxyNmMpKydsXjlFdFdWWEExTl1TKTlsXCg+WDI2ZXFzRUAqJi8zbUBlZ1coV0QjM3VfckNvWTFpJ2lTKE1gJjtaISV1OCouImJuNjw3YzN0WS8oUS5eSC9hTWU0bTFEIjNuN1oySG8jQDFuY1IvcUltKTs2UT43PSlBamsuNj1ANkJFXFYxQSRGY2hAZE02akVuJ1ZTdWYuY2ZvMVkzMCpfNz1eKW5aS1B1Rzs9M1RHQHNpPXBdbEJ1SkReZVBccV1WXFFlYmRvLC5YIW86XFFRJiw4Z21ZQWJIZGw9WExGai9gT0RzNmBaZU0xaEtbdTFyTjsrajdUaSM3TjFBYkdmSUxKNC49REZoNFNfM3BGZVVKQD5lXVteO19fQWAjZlQ4NUInO1QoV1FjQTlUKGY8ZXFndVhkU05haWZWa0tPQG1uL2MqRjQkWyxRUGpvTD5NVTlZND5rKEw4QztkYjZGYSElIThSISUnPkRdSTAtdVNUWjlfcyJZQEUxWyIxZSI+REwrQ0QqW2FBNVY1VGRBaD9JQlV0QTtAZy43MjE5cVxrc0NAJHRXTHIpVjElNDBTVDxQLjs9PGRedVxKbyk1YFVJYUNmTEMlPDBCR1RBIUJKKGMuamwlUTpALy41SStvTSlVaiRQMmwkU2xHVF9BQVtlYywiSkg5cWVrOio1P10/bis3SCpBcmRLbXAlLVZxKXBMMlpTdEQhMmpha2s6JUdxdElTPHEnYkhzbjRhOT1gdWs5T1w7JFMkVVFsaCkoVldPWGxqayNiOCQ0RlgxJDQ/OFVMOy5bbF5AO2ImVkwqP18jMUdBTFs7ajdSay4oRTZKWTwiSVRfWF5sPnI5cUNrPkhWO2xtUG5bPC0nWUNSYGloRF9WWEhNUDpRPTg3LTEwZyYhZWg/J15IUUQ7SEhfKXRVaSMnZihbYUM3Tj85LmhGOVonUWlvMVsmWEk0IUZxWEM8KVFac109J3I9bV5bQysjRihSUlhcOlA6KlZLYSMxOGMzPExXREhqcTxnbic+YyhnK1UoVUdQcltZW2QrMFxTdC89M0BSY19bI2JmMUVLLzheaVctUSpPR0BLR2ZOUztLOzlXJVRDP0hnXjxVMTNPUCkrQXInUU0yYlNbPmpzOTghLlVWcURVTUhILjgjSWEjbShaP1NQcFhHTmFJNGw1YztTV0VlTDlIL0BgU01NIVMhbkI9VS8nNkxNbEJ0alRUTnFZc2g2VGhuKkVyMHInQFtLU1VUIV1rZjc1I0NCJylSYS5yaTRFbXA4NFoxU1ZsKGU9MkxoKGMuSGUoLDVxIi1xKjBwcDNuIlYiIyVlaHE1b0ZIIkpyW045RihoME5fcjE3YHE0SzZBKlcuVytITzg2VC9gIlY3ZSxhSy5rS1xdITI+MGRYbEJDLkxpV10oUyI3IXFMVk8jbWpRaGJVZTY4MkRuTydMOmYrJ3JtaWZCc3FvaU9hPCpxcjszVi05SVkuWmlCO1pxIU1nQUtCUDs0Xm1lKG8sdUxDR1JBVjYrXWFYU0JEN2VcTUwoYzslRUxaPl8sVCJpTHBnU2ZIPjROZ0xZWScnX05SXylIKm1LVGclNVU3KUtNPnJvOT9OPSY/IjUpViQ/NixfcmZqND80Q2ZZbEVUSl0lI0pAWCxEUTVuZEEvbShvLGdHN01pOT1USGBEVS87OS9PczoiVTZKOzgzNyEqRDgkJ2ozKDAxOlorM0p1IlckZUhRPDdwVWFtTVFfKE1KSjIrWXRaLEtCdD5HN0xEQ0ttUWorYElqMnInQU0tbT1pQF90KyJAUV5Ray9nKjQiWmktbkk+MWBsTzszUTokUjBMRDwnVmZbSnUxa2lhXlNIV1E+c0BMZmBYL0JuVVNvJ0Jjamdmfj5lbmRzdHJlYW0KZW5kb2JqCjExIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDExMjIKPj4Kc3RyZWFtCkdiIi9mPkFvdWInWl0sJi5GKUVeQmRyMmksPkRtOS9JPGw5U0wzYUNVQ050RGNyJjVvaGdXUzRLWCwsO1NodDAwJ0k/bCVrT1NBJFQsZSVBcV1Qa1dYVD9eJFM2ZD0nLmM7VHFJQWQ3PkpxalRnIz1zKyktPFFRZ1p1KmlxJlplQFkqQ1codVoiVFdQITUpcEM8J1dwPDhsX2xaLVdlb2BkM2Y0J0IvO0xBbmRiLjBpOmc3Si8sJVldMFdedEk9Wi4sKmV1Q081PEQsN15GSiNYVDxlXTNWa2RDTzc8ImZUR2JQLVhfQGsqZUg2aGY3OihoT2RiMjxwIms6cTFcJjpQMSxEVGYjKEtPTkU5JjEwVyloXiw7LkBQSCskKl9OTC5RYThMSjI5NjdVRWh1dGFnY2x1VT4mTGlvK0hRQm5naytGJi06KmNpXGQrYEk5T1lKI10oOnUjZWtmXVMpJlpPaUVmRzUia1QvMFk1WSonI0wtUkoiLTVwVUhCODxULVMuSUFNITZwLGRdKE0tOUwkOjQ2LWhjR0JNMSFhOHRtZF5EXClXZXBpPmlfQlVrQ2RPQS90Kyt1JyhiZEhPSExla29pMzouMExda1ktO1RqNC8jL0FnVTNgRythWlZkTWdGU1x1T0lAPlQtJUJlOTxacTFZXjM+NCdUY2YrYkBlVWFGWkw2b0NDVlQkI0VSZFopakFuXyVQWk8wWjpZa25gQS1FJ0RBWmAoN2dcUFpzUzRNJEguci4iQyMtUVwkKU5FIVQ2bE5bMEMvW1o/bERSbWdXSHBJa1h1XkIwcGJhVjBgRj87TFpSIVoqI2xLQW1pJUhlWGdhTzozMzpbMT8uJXJOU3BdaCghOGZIbTNiOFZTSz87R20rZDhMcXNbUERBYmI4NDtEZ1pnNGMnS0ovQVRLI1A4T1t0OT5NKEdSPiNmNSRcbSthYmNMWGRlWzVHU1YtVTBtRWQ3UWZHKF5DJWctMkBaTEs2ZmA2T3JYbz8pY2d0aFZWSEc/SVBRZj1rO081SWtgMy0nNVBQYWlHY21Za24vRm5yUThrOkU6QSkkRk1wczghWG8yc0pLNlRlQmk4ITpwbCU9Pl5hO3FRLWRwSFlscj1pXTQhREpRWDxKdE5eJzxFMERaSUsoOTZvLEJAJDFOLztpP1MpKlQ/ZEMrcG45cXUiWSVzMSZqbDllYllubnFtJiVkKUdjXT1ZWjhFb2BsSjFZLUNGLDAuU3FWNUtnTTAjVCo3OT9BbiI9L205UzEvOmxjUj9udS8zXDFOMXBBZ2gsKzNkI25PRC9XNTljUG5OIi9hdVs/Ul0mWFwzLXMxPSwnIl1gdFpVM2cqVTlqZ1ZVKUdDW0BDZUAzZnROMkhELChxaDwxTlpLUzxXYSElVjtZUyZyK0IjWzRZRThVaTBJYztSXzUrdGVYZDZOZGcxcCNkcVUrP3BmWXJCXVBIYTBvIjxOMWRhTThPNihdbz5eUkJPRUh+PmVuZHN0cmVhbQplbmRvYmoKMTIgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMTUyNgo+PgpzdHJlYW0KR2IhI1w+QkFMWiY6V2VEbHNpZUcnJi9mLmRodEpDbDgpW0NuOHRPZ19BNVV0WXJJbj9MT1wzSEkpNC9ATVlraDEmdD4wXHAxYUstKCluaCZmXUlbZiJhS09xcmxHQiEhSWtRZWdOKC0mXnQ8VCdobHVdImgoSj5HRyxzTEJvTUddLC9ALUluIzNzcD0zPydpYlI0WlY3RWpWWilKJjxQUUotdV45bUtBZTM7JWEvbUQ5VEY+K2xXSkZNalBcQyNVXEdaODRmWjVpYV0yOlAocGFjaSUlQzxTdWNDWWhkVm1KTSJtUiFgJm89bz1xPjM5KzdOWFJycmRPVltoRi1iQGJDbVEiUjEoVTgubmApTSc+Wk1SOjZiKiUnQXJjQTFOQ2Q2UEUhJ19OcCE6V2RsQj0kXSplL1tMLzRTYSZpMi9AYVtES0VrXlZDWUpUQys2UyU0c19KSldeQD1zcTpMbHUzU0VKUk1FQmRsWkReamRWL2E6NmxpNV9XWl8qQmlQPyRfaU1XIUswRSwyMzwzVVQvRi1JNm1rWEUhUD4rakUlSTNrSG9DTSxBLCVyZ0dZZDEwa14ybj1OOTluWHBjUTpTWi4hSzJnViNlXEs1LkJucUcsQihmUGw7WTVTPU8jS2FONTk1ISomJyQuYl5lWFsxUyhvaidQbGpwSDpoYVY9QUFWR1lVXlVmLGtWTjNcVWIoW1FeVDFWVD5rN0pNayImb0krUGgsXmhea1cvJSprJj0qdUNeTjIvbmFIPylXNmRFW2hDVDtJJzFcci1rOCFXTGtNNEdZbmFdclg5IVtpODstXXUtOkNocGo2WjIyXykhbERNR1ohSnAwMTc2JSZvaHN1XFlZY19ra0MlbVBSQTRnTHUrMV9cJTlqOmghRFNAUS0+VFppdC10QGJCcDtZZ3I9SE1vSSZQVGpxLTZMbT5ROT4nVEEtNmpmSlJFKDEpXydoXSM+VWAvcDgwWmFbVD5PPmRMV2wkPydCaFl0PyYoYzJLckxPWkxlPGxfS05MdE1OR25Wa1hVOSNmTyYkSU8mUC88LzAlQV8pXjZxRm4/b1gvPiRROVdJUFJCcj4wK25aSitiJE9jZzZQWmhySmBPZUlqLyZMV25JPD5sdVNZSVIxRTklXl5TOT5bSV4odWlbck8iZXVddHBRPWtJUjRRU1JeWVI0bDgpVC0tVyI+U09SWS1JbE8ibW4rVm1LKlcxKlxfIVQ1PjgjS1JoSilqaXNpc01DKzMlZT1AZExcVFUraEAvQSZYQ0xzSTNZWkRRZCVmPz5LPzZNYyU1LWo9QmNrNlpFOiZxaEBEX0M2QEkuK0E5KyQ6Z0d1JmA8Jl1vL0o9aE4qIk5GIlUzIWhNPjpmTlkkbE5XTlluVmpiZVpmOXRuX1kiRGhLcikiUzFST10jVD1CXkhQWzJrYCxLRCU4NSw/ZUBxUllXcls1SkZtTUVyZV1VK2lESCYkISE7MEhYOV45bWx0KTVAPEZJaiJqXUxydTdCPk0hNXBsR01KKy9ORlZXcjE6b0puUjRuS3NiX0pdLDNMVUFpbCQyYUdvTzJzSTpSbWcpYD5LIzwtOVNMNV0vNDhXLjhFdSlxYUZKRkw2XC8/Il1RJWVEYVonWCcjPzIrYEBPOU8tOis7PVpuZDlyS0JJN0I2dXBzXjdmbk9mLTwrYHIjajN0WyZpOEoqSSRZJFZGOiNTPVEucVE8aDFSMSRXQSpLPCoqPFk/bkM5I3VacionaGJvOWx1JT51JVIlIiZdRlNCaXFHZG9bLXEtLiw7U0RAX2g6aGNYQz4xOUg9Yy1uaCRNZzdbPjo7bCJUIiMpUldyblo2RCpSZFUhN0YrImg8bkMsMyVCJWA0S2ZQJSlvNEdpXGdLSy1GI21PNCpfKGY0KF0mMFlDa2oiXUdyYCNyNCIpc2BLR0FyPVw3STRoYDImbVlaJEY9ITUjSCo/RjgmKXBnYVZALnIjIz9bYSUmaHFmRHBpYWlGVz5HYkRkImwrYDdkVjBEQmAmIlFKbWIsfj5lbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCAxMwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNzMgMDAwMDAgbiAKMDAwMDAwMDExNCAwMDAwMCBuIAowMDAwMDAwMjIxIDAwMDAwIG4gCjAwMDAwMDAzMzMgMDAwMDAgbiAKMDAwMDAwMDUzNyAwMDAwMCBuIAowMDAwMDAwNzQxIDAwMDAwIG4gCjAwMDAwMDA5NDUgMDAwMDAgbiAKMDAwMDAwMTAxMyAwMDAwMCBuIAowMDAwMDAxMjk2IDAwMDAwIG4gCjAwMDAwMDEzNjcgMDAwMDAgbiAKMDAwMDAwMjg5NiAwMDAwMCBuIAowMDAwMDA0MTEwIDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPDNhNTJmNGRhYjI4MTkwM2E0MzFmZjg4M2ViODUyM2ZkPjwzYTUyZjRkYWIyODE5MDNhNDMxZmY4ODNlYjg1MjNmZD5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChodHRwOi8vd3d3LnJlcG9ydGxhYi5jb20pCgovSW5mbyA4IDAgUgovUm9vdCA3IDAgUgovU2l6ZSAxMwo+PgpzdGFydHhyZWYKNTcyOAolJUVPRgo=";

function openSampleReport() {
    const dataUrl = "data:application/pdf;base64," + SAMPLE_REPORT_B64;
    const win = window.open("", "_blank");
    if (win) {
        win.document.write(
            "<html><head><title>PropVerify — Sample Due Diligence Report</title>" +
            "<style>*{margin:0;padding:0;}body,html{height:100%;overflow:hidden;}" +
            "embed{display:block;width:100%;height:100vh;}" +
            ".fallback{display:none;font-family:sans-serif;padding:20px;}" +
            "</style></head><body>" +
            "<embed src='" + dataUrl + "' type='application/pdf' width='100%' height='100%'/>" +
            "<div class='fallback'>" +
            "<p>Your browser cannot display embedded PDFs. " +
            "<a href='" + dataUrl + "' download='PropVerify_Sample_Report.pdf'>Click here to download the report</a>.</p>" +
            "</div>" +
            "</body></html>"
        );
        win.document.close();
    } else {
        // Popup blocked – trigger download as fallback
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "PropVerify_Sample_Report.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const sampleBtn = document.getElementById("btnSampleReport");
    if (sampleBtn) {
        sampleBtn.addEventListener("click", openSampleReport);
    }

    wireDocumentUpload();
});

/* ── Prestige Loader helpers ── */
let _loaderProgressInterval = null;

function startLoaderProgress() {
    stopLoaderProgress();
    const el = document.getElementById("loader-percent-text");
    if (!el) return;
    let pct = 0;
    el.textContent = "0%";
    _loaderProgressInterval = setInterval(() => {
        // Fast to 70%, then slow crawl — mimics real async behaviour
        const step = pct < 70 ? (Math.random() * 3 + 1) : (Math.random() * 0.8 + 0.1);
        pct = Math.min(pct + step, 95);
        el.textContent = Math.round(pct) + "%";
    }, 120);
}

function stopLoaderProgress(complete = false) {
    if (_loaderProgressInterval) {
        clearInterval(_loaderProgressInterval);
        _loaderProgressInterval = null;
    }
    const el = document.getElementById("loader-percent-text");
    if (!el) return;
    if (complete) {
        el.textContent = "100%";
        // Briefly show 100% then clear
        setTimeout(() => { el.textContent = "0%"; }, 400);
    }
}

function showLoader(label = "Analyzing locality…") {
    let loader = document.getElementById("prestige-loader");
    if (!loader) {
        loader = document.createElement("div");
        loader.id = "prestige-loader";
        loader.innerHTML = `
          <div class="svg-stage">
            <div class="ring-track"></div>
            <div class="spin-ring"></div>
            <div class="spin-ring-inner"></div>
            <svg class="buildings-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path class="bld-path bld-main"   d="M30 60V30h20v30"/>
              <path class="bld-path bld-left"   d="M18 60V40h12v20"/>
              <path class="bld-path bld-right"  d="M50 60V40h12v20"/>
              <path class="bld-path bld-accent" d="M35 30V20h10v10"/>
              <path class="bld-path bld-windows"d="M33 36h4m6 0h4M33 43h4m6 0h4M33 50h4m6 0h4"/>
              <path class="bld-path pin-path"   d="M40 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0 0v6"/>
            </svg>
          </div>
          <p class="loader-label" id="loader-label-text">${label}</p>
          <p class="loader-percent" id="loader-percent-text">0%</p>`;
        document.body.appendChild(loader);
    } else {
        const lbl = loader.querySelector("#loader-label-text");
        if (lbl) lbl.textContent = label;
    }
    requestAnimationFrame(() => {
        loader.classList.add("loader-visible");
        startLoaderProgress();
    });
}

function hideLoader() {
    const loader = document.getElementById("prestige-loader");
    if (!loader) return;
    stopLoaderProgress(true);
    loader.classList.remove("loader-visible");
}

async function startAnalysis() {
    const name = document.getElementById("userName").value.trim();
    const phone = document.getElementById("userPhone").value.trim();
    const email = document.getElementById("userEmail").value.trim();
    const budget = document.getElementById("userBudget").value.trim();
    const locRaw = document.getElementById("userLocality").value.trim();
    const loc = toPascalCase(locRaw);

    const missing = [];
    if (!name) missing.push("Name");
    if (!phone) missing.push("Mobile");
    if (!email) missing.push("Email");
    if (!budget) missing.push("Budget");
    if (!locRaw) missing.push("Locality");

    if (missing.length) {
        alert(`Please fill all details: ${missing.join(", ")}`);
        return;
    }

    userData = {
        name,
        phone,
        email,
        locality: loc,
        budget,
    };

    const btnText = document.getElementById("btnText");
    const originalBtnText = btnText?.innerText || "Analyze Locality";
    if (btnText) btnText.innerText = "Analyzing...";

    document.getElementById("resName").innerText = loc;
    document.getElementById("resAnalysisTitle").innerText = `${loc} Locality Profile`;
    document.getElementById("resBudgetPill").innerText = userData.budget ? `Budget: ${userData.budget}` : "Budget: Flexible";

    showLoader("Analyzing locality…");

    try {
        await fetchAI(loc, userData.budget);
    } catch (e) {
        console.error("AI Fetch Error:", e);
        try { updateUI({ price: "Market Data Pending", appreciation: "N/A", go111: "CHECKING", zoning: "Pending", metro: "Pending" }); } catch (_) {}
        showStep(2);
    } finally {
        hideLoader();
        if (btnText) btnText.innerText = originalBtnText;
    }
}

function toPascalCase(input) {
    return String(input)
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function buildPrompt(loc, budget) {
    return `Analyze market intelligence for the locality: ${loc}, Hyderabad. User Budget: ${budget}.
Return ONLY a valid JSON with these keys:
"price" (approx price range per sqft/sqyd),
"appreciation" (3-year growth %),
"go111" (SAFE or AFFECTED),
"zoning" (Master plan zone),
"metro" (nearest metro station and distance),
"hospitals_list" (array of exactly 3-4 top hospitals with distance in KM),
"schools_list" (array of exactly 3-4 top schools with distance in KM),
"malls_list" (array of exactly 3-4 top malls/markets with distance in KM),
"highway" (nearest NH highway connectivity),
"orr_access" (nearest ORR Exit and distance),
"rail_access" (nearest MMTS or Railway station),
"local_transport" (General bus/transit availability)`;
}

async function fetchAI(loc, budget) {
    const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locality: loc, budget }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = result?.error || `HTTP ${response.status}`;
        throw new Error(message);
    }

    const data = result?.data;
    if (!data || typeof data !== "object") throw new Error("Invalid analysis response.");

    updateUI(data);
    saveFreeInsightToFirestore(data);
    showStep(2);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function setHtml(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
}

function firstValue(...values) {
    return values.find((value) => {
        if (Array.isArray(value)) return value.length > 0;
        return value !== undefined && value !== null && value !== "";
    });
}

function normalizeList(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value === "string") {
        return value
            .split(/\n|;|,(?=\s*[A-Z0-9])/)
            .map((item) => item.trim())
            .filter(Boolean);
    }
    if (typeof value === "object") return Object.values(value).flat();
    return [String(value)];
}

function updateUI(data) {
    console.log("[analyze] AI data", data);
    const priceEl = document.getElementById("resPrice");
    if (priceEl) priceEl.innerText = data.price || "₹ Market Rate";
    setText("resApp", data.appreciation || "0%");

    const goEl = document.getElementById("resGoStatus");
    const goVal = data.go111 || "VERIFYING";
    if (goEl) {
        goEl.innerText = goVal;
        goEl.classList.toggle("stat-good", goVal === "SAFE");
        goEl.classList.toggle("stat-bad", goVal !== "SAFE");
    }
    const goDetailsEl = document.getElementById("resGoDetails");
    if (goDetailsEl) {
        const details = data.go111_details;
        goDetailsEl.innerText = details
            ? `${details.name} • Village ${details.villageNo} • ${details.mandal}`
            : "";
    }

    const infra = data.infrastructure || data.social_infrastructure || data.amenities || {};

    setText("resZone", firstValue(data.zoning, data.zone, data.master_plan_zone) || "Loading...");
    setText("resMetro", firstValue(data.metro, data.metro_connectivity, data.nearest_metro) || "Checking Connectivity...");

    const renderInfra = (id, list) => {
        const container = document.getElementById(id);
        if (!container) return;
        if (list && list.length > 0) {
            const toText = (item) => {
                if (item == null) return "";
                if (typeof item === "string") return item;
                if (typeof item === "number" || typeof item === "boolean") return String(item);
                if (typeof item === "object") {
                    const name = item.name ?? item.title ?? item.hospital ?? item.school ?? item.mall ?? item.place ?? "";
                    const distance = item.distance ?? item.dist ?? item.km ?? "";
                    const extra = item.address ?? item.area ?? "";
                    const parts = [name, distance && `(${distance})`, extra].filter(Boolean);
                    if (parts.length) return parts.join(" ");
                    try { return JSON.stringify(item); } catch { return String(item); }
                }
                return String(item);
            };

            container.innerHTML = list.map((item) => `<div class="infra-item">${escapeHtml(toText(item))}</div>`).join("");
        } else {
            container.innerHTML = `<div class="empty-note">No major facilities within 10km radius identified.</div>`;
        }
    };

    renderInfra("resHospitals", normalizeList(firstValue(
        data.hospitals_list,
        data.hospitals,
        data.nearby_hospitals,
        data.top_hospitals,
        infra.hospitals,
        infra.hospitals_list
    )));
    renderInfra("resSchools", normalizeList(firstValue(
        data.schools_list,
        data.schools,
        data.nearby_schools,
        data.top_schools,
        infra.schools,
        infra.schools_list
    )));
    renderInfra("resMalls", normalizeList(firstValue(
        data.malls_list,
        data.malls,
        data.nearby_malls,
        data.shopping_malls,
        data.markets,
        infra.malls,
        infra.malls_list,
        infra.markets
    )));

    const orr = firstValue(data.orr_access, data.orr, data.orr_connectivity, data.outer_ring_road) || "Checking...";
    const highway = firstValue(data.highway, data.highway_connectivity, data.nearest_highway) || "";
    setHtml("resORR", `${escapeHtml(orr)}${highway ? `<br><span class="subnote">${escapeHtml(highway)}</span>` : ""}`);
    setText("resTrain", firstValue(data.rail_access, data.railway, data.mmts, data.nearest_railway) || "Checking Stations...");
    setText("resLocalTrans", firstValue(data.local_transport, data.public_transport, data.bus_connectivity) || "Checking Connectivity...");
}

function normalizeDocPart(value, fallback = "unknown") {
    const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return normalized || fallback;
}

function getFreeInsightDocId() {
    const phone = normalizeDocPart(String(userData.phone || "").replace(/\D/g, ""), "no-phone");
    const locality = normalizeDocPart(userData.locality, "no-locality");
    return `FREE-${phone}-${locality}`;
}

async function saveFreeInsightToFirestore(aiInsights) {
    try {
        const db = getFirestore();
        const FieldValue = window.firebase.firestore.FieldValue;
        const docId = getFreeInsightDocId();

        await db.collection("freeInsights").doc(docId).set({
            name: userData.name || "",
            phone: userData.phone || "",
            email: userData.email || "",
            locality: userData.locality || "",
            budget: userData.budget || "",
            aiInsights: aiInsights || {},
            paymentStatus: "free",
            convertedToPaid: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        lastFreeInsightDocId = docId;
        console.log("[freeInsights] saved", docId);
    } catch (err) {
        console.error("[freeInsights] save failed", err);
    }
}

function escapeHtml(input) {
    return String(input)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showStep(n) {
    document.getElementById("step-1").classList.add("hidden");
    document.getElementById("step-1-continued").classList.add("hidden");
    document.getElementById("how-propverify-works").classList.add("hidden");
    document.getElementById("step-2").classList.add("hidden");
    document.getElementById("tracker-view").classList.add("hidden");

    if (n === 1) { document.getElementById("step-1").classList.remove("hidden"); document.getElementById("step-1-continued").classList.remove("hidden"); document.getElementById("how-propverify-works").classList.remove("hidden"); }
    if (n === 2) document.getElementById("step-2").classList.remove("hidden");
    if (n === 3) document.getElementById("tracker-view").classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function initAuditFlow() {
    if (!userData.phone) {
        alert("Please enter your mobile number first, then click Analyze Locality.");
        return;
    }
    selectedAuditFiles = [];
    currentAuditTrackId = "PV-" + Math.floor(1000 + Math.random() * 9000);
    renderSelectedFiles();
    document.getElementById("modal-container").classList.remove("hidden");
    showModalStage("payment");
}

function showModalStage(stage) {
    ["payment", "details", "success", "coming-soon"].forEach((s) => {
        document.getElementById("modal-" + s).classList.add("hidden");
    });
    document.getElementById("modal-" + stage).classList.remove("hidden");
}

function processPayment() {
    showModalStage("coming-soon");
}

function getFirestore() {
    initFirebaseIfNeeded();
    if (typeof window.firebase?.firestore !== "function") {
        throw new Error("Firestore SDK not loaded. Add firebase-firestore-compat.js to the page.");
    }
    return window.firebase.firestore();
}

async function uploadAuditDocuments(trackId) {
    if (!selectedAuditFiles.length) return [];

    try {
        return await Promise.all(
            selectedAuditFiles.map(async (file, index) => {
                const response = await fetch(`/api/upload-document/${encodeURIComponent(trackId)}?i=${index + 1}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/octet-stream",
                        "x-file-name": encodeURIComponent(file.name || `Document ${index + 1}`),
                        "x-file-type": file.type || "application/octet-stream",
                    },
                    body: file,
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data?.error || `Document upload failed (HTTP ${response.status}).`);
                }
                return data;
            })
        );
    } catch (error) {
        throw new Error(error?.message || "Document upload failed. Please try again.");
    }
}

async function saveAuditOrderToFirestore(trackId, property, notes, documents) {
    const db = getFirestore();
    const FieldValue = window.firebase.firestore.FieldValue;

    const payload = {
        trackId,
        createdAt: FieldValue.serverTimestamp(),
        status: "New Lead",
        paymentStatus: "pending",
        user: { ...userData },
        property: {
            rera: property?.rera || "",
            survey: property?.survey || "",
            village: property?.village || "",
            mandal: property?.mandal || "",
        },
        notes: notes || "",
        documents: documents || [],
        client: {
            userAgent: navigator.userAgent,
            locale: navigator.language,
        },
    };

    console.log("[auditOrders] saving", trackId, payload);
    await db.collection("auditOrders").doc(trackId).set(payload, { merge: true });
    console.log("[auditOrders] saved", trackId);
}

async function submitAudit() {
    const survey = document.getElementById("propSurvey").value.trim();
    if (!survey) { alert("Survey Number is required for verification"); return; }

    const btn = document.querySelector("#modal-details button");
    if (btn?.disabled) return;
    const original = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting...`;
        btn.disabled = true;
    }

    const trackId = currentAuditTrackId || "PV-" + Math.floor(1000 + Math.random() * 9000);
    const property = {
        rera: document.getElementById("propRera").value.trim(),
        survey,
        village: document.getElementById("propVillage").value.trim(),
        mandal: document.getElementById("propMandal").value.trim(),
    };
    const notes = document.getElementById("propNotes")?.value.trim() || "";

    try {
        const documents = await uploadAuditDocuments(trackId);
        await saveAuditOrderToFirestore(trackId, property, notes, documents);
        document.getElementById("finalTrackId").innerText = trackId;
        showModalStage("success");
    } catch (e) {
        console.error(e);
        alert(e?.message || "Failed to submit order. Please try again.");
    } finally {
        if (btn) {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    }
}

function renderSelectedFiles() {
    const fileList = document.getElementById("fileList");
    const dropzoneInner = document.getElementById("dropzone-inner");
    if (!fileList) return;

    fileList.innerHTML = selectedAuditFiles
        .map((file, index) => {
            const sizeMb = file.size ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "";
            return `
                <li class="file-item">
                    <i class="fa-solid fa-file-lines file-icon"></i>
                    <span class="file-name">${escapeHtml(file.name || `Document ${index + 1}`)}</span>
                    <span class="file-size">${escapeHtml(sizeMb)}</span>
                    <button class="file-remove" type="button" onclick="event.stopPropagation(); removeSelectedFile(${index})" aria-label="Remove file">&times;</button>
                </li>
            `;
        })
        .join("");

    if (dropzoneInner) {
        dropzoneInner.classList.toggle("hidden", selectedAuditFiles.length > 0);
    }
}

function removeSelectedFile(index) {
    selectedAuditFiles.splice(index, 1);
    renderSelectedFiles();
}

function handleFileSelect(files) {
    const incoming = Array.from(files || []);
    const maxBytes = 10 * 1024 * 1024;
    const accepted = [];
    const rejected = [];

    incoming.forEach((file) => {
        if (file.size > maxBytes) {
            rejected.push(file.name || "Unnamed file");
        } else {
            accepted.push(file);
        }
    });

    selectedAuditFiles = [...selectedAuditFiles, ...accepted];
    renderSelectedFiles();

    if (rejected.length) {
        alert(`These files are above 10MB and were not added: ${rejected.join(", ")}`);
    }
}

function wireDocumentUpload() {
    const dropzone = document.getElementById("dropzone");
    const input = document.getElementById("propFiles");
    if (!dropzone || !input) return;

    ["dragenter", "dragover"].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            dropzone.classList.add("dropzone-over");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            dropzone.classList.remove("dropzone-over");
        });
    });

    dropzone.addEventListener("drop", (event) => {
        handleFileSelect(event.dataTransfer?.files);
        input.value = "";
    });

    input.addEventListener("change", () => {
        handleFileSelect(input.files);
        input.value = "";
    });
}

function closeModal() { document.getElementById("modal-container").classList.add("hidden"); }
function closeModalAndTrack() { closeModal(); openTracker(); }
function openTracker() { showStep(3); }
function handleTrack() {
    if (document.getElementById("trackInput").value.trim()) {
        document.getElementById("trackResult").classList.remove("hidden");
    }
}

function normalizePhoneE164(phone) {
    const raw = String(phone || "").trim();
    if (!raw) return "";
    if (raw.startsWith("+")) return raw.replace(/\s+/g, "");

    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    return "";
}

function initFirebaseIfNeeded() {
    if (!window.firebase?.apps) throw new Error("Firebase SDK not loaded.");
    if (window.firebase.apps.length) return;

    // TODO: Replace with your Firebase web app config:
    // Firebase Console → Project settings → General → Your apps → Web app → SDK setup & config
    const firebaseConfig = {
        apiKey: "AIzaSyAV2whuhVhfME4oKuTXAlt4v4iOLg_2rIY",
        authDomain: "property-1b194.firebaseapp.com",
        projectId: "property-1b194",
        storageBucket: "property-1b194.firebasestorage.app",
        messagingSenderId: "982652657169",
        appId: "1:982652657169:web:441563b3a3667757401bb0",
        measurementId: "G-73ZL6L3DB9",
    };

    const missing = Object.values(firebaseConfig).some((v) => !v || String(v).includes("PASTE_"));
    if (missing) {
        throw new Error("Firebase config missing. Paste your Firebase web config in `Property Analyzer/script.js`.");
    }

    window.firebase.initializeApp(firebaseConfig);
    try {
        window.firebase.analytics?.();
    } catch {}
}

function ensureRecaptchaVerifier() {
    initFirebaseIfNeeded();

    if (window.recaptchaVerifier) return window.recaptchaVerifier;

    const containerId = "recaptcha-container";
    const el = document.getElementById(containerId);
    if (!el) throw new Error("Missing #recaptcha-container in HTML.");

    window.recaptchaVerifier = new window.firebase.auth.RecaptchaVerifier(containerId, {
        size: "invisible",
    });
    return window.recaptchaVerifier;
}

async function sendOtpWithFirebase(phone) {
    const e164 = normalizePhoneE164(phone);
    if (!e164) throw new Error("Enter a valid mobile number (preferably with +91).");

    const btn = document.querySelector("#modal-otp button");
    const original = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Sending OTP...`;
        btn.disabled = true;
    }

    try {
        const verifier = ensureRecaptchaVerifier();
        firebaseConfirmationResult = await window.firebase.auth().signInWithPhoneNumber(e164, verifier);
        alert(`OTP sent to ${e164}.`);
    } catch (e) {
        // Reset reCAPTCHA on failures so next attempt works
        try {
            window.recaptchaVerifier?.clear();
            window.recaptchaVerifier = null;
        } catch {}
        throw e;
    } finally {
        if (btn) {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    }
}

async function verifyOtpWithFirebase(code) {
    initFirebaseIfNeeded();
    if (!firebaseConfirmationResult) {
        throw new Error("OTP session not found. Please resend OTP.");
    }
    const cred = await firebaseConfirmationResult.confirm(String(code));
    firebaseConfirmationResult = null;
    return cred;
}
