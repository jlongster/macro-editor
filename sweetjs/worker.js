importScripts('./estraverse.js');
importScripts('./escope.js');
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
      var maxExpanded = null;

      if(e.data.maxExpands != null) {
        if(e.data.maxExpands === 0) {
          output = e.data.src;
        }
        else {
          output = syn.prettyPrint(
            sweet.expand(e.data.src, '', e.data.maxExpands),
            false
          );

          var nextOutput = syn.prettyPrint(
            sweet.expand(e.data.src, '', e.data.maxExpands + 1),
            false
          );

          maxExpanded = output === nextOutput;
        }
      }
      else {
        output = sweet.compile(e.data.src, {
          sourceMap: false,
          readableNames: true
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
      err: error,
      maxExpanded: maxExpanded
    });
  };
});
