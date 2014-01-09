
document.addEventListener('DOMContentLoaded', function() {
    var worker = new Worker('/s/macro-editor/sweetjs/worker.js');
    var receivers = {};
    var baseid = 1;

    worker.addEventListener('message', function(e) {
        if(e.data.type === 'ready') {
            // compile the first one immediately so it's already there
            $('.macro-editor')[0].compile();
        }
        else {
            var id = e.data.editorId;
            var reqId = e.data.requestId;

            if(receivers[id] && receivers[id].requestId === reqId) {
                receivers[id].handler(e.data.err, e.data.src);
                delete receivers[id];
            }
        }
    });

    var compile = _.debounce(function(id, inst, out, status, opts) {
        opts = opts || {};
        status.removeClass('error').show().text('compiling...');
        var reqId = baseid++;

        worker.postMessage({ 
            editorId: id,
            requestId: reqId,
            src: inst.getValue(),
            maxExpands: opts.maxExpands
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
        var el = $(this);
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

        var h = el.find('.CodeMirror').height();
        inputMirror.setSize(width / 2, h);
        outputMirror.setSize(width / 2, h);

        var status = $('<div class="status"></div>');
        el.append(status);
        el.append(
            '<div class="controls">' +
            '  <button class="step">Step</button>' +
            '  <button class="reset">Reset</button>' +
            '</div>'
        );

        el.find('button.step').on('click', function() {
            this.compile({ maxExpands: 1 });
        }.bind(this));

        el.find('button.reset').on('click', function() {
            inputMirror.setValue(content);
        });

        inputMirror.on('change', function() {
            this.compile();
        }.bind(this));

        this.compile = function(opts) {
            this.hasCompiled = true;
            compile(this.uid, inputMirror, outputMirror, status, opts);
        }.bind(this);

        this.focus = function() {
            this.hasFocused = true;
            inputMirror.focus();
        };

        this.setValue = function(val) {
            inputMirror.setValue(val);
        };

        this.uid = baseid++;
    });

    $('a[data-editor-change]').each(function() {
        // find the first editor above this link. zepto doesn't have
        // prevAll, which is stupid
        var node = $(this).parents('p');
        while(node.length && !node.is('.macro-editor')) {
            node = node.prev();
        }
        var editor = node[0];

        if(editor) {
            $(this).on('click', function(e) {
                e.preventDefault();
                editor.setValue(getChange(this.dataset.editorChange));
            });
        }
        else {
            var err = Error('WARNING: could not find editor: ' + this);
            err.link = this;
            throw err;
        }
    });

    // all the editors are compiled lazily, when the user scrolls an
    // editor into view. it also focuses the editor in the view to
    // emphasize that it's editable text
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

    // changes

    function getChange(id) {
        if(!CHANGES[id]) {
            throw new Error('changeset not found: ' + id);
        }
        return CHANGES[id];
    }

    var CHANGES = {
        // first example
        1: 'macro foo {\n' +
            '  rule { x } => { $x + \'rule1\' }\n' +
            '}\n\n' +
            'foo 5;\n' +
            'foo bar;',
        2: 'macro foo {\n' +
            '  rule { x } => { \'rule1\' }\n' +
            '}\n\n' +
            'foo x;',

        // second example
        3: 'macro foo {\n' +
            '  rule { =*> $x } => { $x + \'rule1\' }\n' +
            '  rule { [$x] } => { $x + \'rule2\' }\n' +
            '  rule { $x } => { $x + \'rule3\' }\n' +
            '}\n\n' +
            'foo =*> baller;\n' +
            'foo 6;\n' +
            'foo [bar];',

        4: 'macro foo {\n' +
            '  rule { => $x } => { $x + \'rule1\' }\n' +
            '  rule { $x } => { $x + \'rule3\' }\n' +
            '  rule { [$x] } => { $x + \'rule2\' }\n' +
            '}\n\n' +
            'foo => 5;\n' +
            'foo 6;\n' +
            'foo [bar];'

    };
});
