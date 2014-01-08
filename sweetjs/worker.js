importScripts('./escodegen.js');
importScripts('../require.js');
var global = this;

requirejs.config({
    shim: {
        'underscore': {
            exports: '_'
        }
    }
});

require({ baseUrl: './' }, ["./sweet", "./syntax", "./underscore"], function(sweet, syn, _) {
    global.onmessage = function(e) {
        if(e.data === '') {
            return;
        }

        try {
            var output = sweet.compile(e.data.src).code;
        }
        catch(e) {
            var error = e.toString();
        }

        global.postMessage({
            editorId: e.data.editorId,
            requestId: e.data.requestId,
            src: output,
            err: error
        });
    };
});
