
document.addEventListener('DOMContentLoaded', function() {
    var worker = new Worker('/macro-editor/sweetjs/worker.js');
    var receivers = {};
    var baseid = 1;

    worker.addEventListener('message', function(e) {
        var id = e.data.editorId;
        var reqId = e.data.requestId;

        if(receivers[id] && receivers[id].requestId === reqId) {
            receivers[id].handler(e.data.err, e.data.src);
            delete receivers[id];
        }
    });

    var compile = _.debounce(function(id, inst, out, status) {
        status.removeClass('error').show().text('compiling...');
        var reqId = baseid++;

        worker.postMessage({ 
            editorId: id,
            requestId: reqId,
            src: inst.getValue()
        });

        receivers[id] = {
            requestId: reqId,
            handler: function(err, src) {
                status.hide();

                if(err) {
                    status.show().addClass('error').text(err);
                }
                else {
                    out.setValue(src);
                }
            }
        };
    }, 250);

    var editors = $('.macro-editor');
    editors.each(function() {
        var width = this.getBoundingClientRect().width;
        var content = this.textContent;
        this.textContent = '';

        var inputMirror = CodeMirror(this, {
            value: content,
            mode:  'javascript',
            theme: 'ambiance'
        });

        var outputMirror = CodeMirror(this, {
            mode:  'javascript',
            theme: 'ambiance',
            readOnly: true
        });

        var h = $(this).find('.CodeMirror').height();
        inputMirror.setSize(width / 2, h);
        outputMirror.setSize(width / 2, h);

        var status = $('<div class="status"></div>');
        $(this).append(status);

        inputMirror.on('change', function() {
            this.compile();
        }.bind(this));

        this.compile = function() {
            this.hasCompiled = true;
            compile(this.uid, inputMirror, outputMirror, status);
        }.bind(this);

        this.focus = function() {
            this.hasFocused = true;
            inputMirror.focus();
        };

        this.uid = baseid++;
    });

    // This is the wonky part. If I do this immediately the worker
    // just doesn't respond, but if I wait a little bit it responds
    // fine.
    setTimeout(function() {
        editors[0].compile();
    }, 1000);

    // Since a scroll event is initially triggered if you bind to it
    // immediately, wait a little bit as well. We won't have to do
    // this once we fix the web workers situation.
    setTimeout(function() {
        $(window).on('scroll', function(e) {
            var win = {
                width: (window.innerWidth ||
                        document.documentElement.clientWidth),
                height: (window.innerHeight ||
                         document.documentElement.clientHeight)
            };

            editors.each(function() {
                var rect = this.getBoundingClientRect();

                if(rect.top + rect.height > 0 && rect.top < win.height) {
                    if(!this.hasCompiled) {
                        this.compile();
                    }

                    if(!this.hasFocused) {
                        this.focus();
                    }
                }
            });
        }.bind(this));
    }.bind(this), 1000);
});
