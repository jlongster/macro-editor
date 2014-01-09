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

            if(e.data.maxExpands != null) {
                if(e.data.maxExpands === 0) {
                    output = e.data.src;
                }
                else {
                    output = syn.prettyPrint(
                        sweet.expand(e.data.src, '', e.data.maxExpands),
                        false
                    );
                }
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
