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
    global.postMessage({
        type: 'ready'
    });

    global.onmessage = function(e) {
        try {
            var output;

            if(e.data.maxExpands) {
                output = sweet.expand(e.data.src, '', e.data.maxExpands);
            }
            else {
                output = sweet.compile(e.data.src, {
                    sourceMap: false
                }).code;
            }
        }
        catch(e) {
            var error = e.toString();
        }

        global.postMessage({
            type: 'result',
            editorId: e.data.editorId,
            requestId: e.data.requestId,
            src: output,
            err: error
        });
    };
});
