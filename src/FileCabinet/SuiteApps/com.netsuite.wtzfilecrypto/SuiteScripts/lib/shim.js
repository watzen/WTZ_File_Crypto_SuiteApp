define(["./getRandomValuesPolyfill.js", "./base64.js",], function(
    getRandomValuesPolyfill,
    base64,) {
        (function() {
                //this.window = this;
                this.self = this;
                this.navigator = {
                        userAgent: ""
                };
                this.crypto = {
                        getRandomValues: getRandomValuesPolyfill
                };
                this.atob = base64.atob;
                this.btoa = base64.btoa;
        })()
        return {}
})
