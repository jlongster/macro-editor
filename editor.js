
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
                    if(opts.maxExpands != null) {
                        status.show().text('step: ' + opts.maxExpands);
                    }
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

        var maxExpands = 0;
        el.find('button.step').on('click', function() {
            this.compile({ maxExpands: maxExpands++ });
        }.bind(this));

        el.find('button.reset').on('click', function() {
            maxExpands = 0;
            inputMirror.setValue(content);
        });

        inputMirror.on('change', function() {
            this.compile();
        }.bind(this));

        this.compile = function(opts) {
            this.hasCompiled = true;
            compile(this.uid, inputMirror, outputMirror, status, opts);
        }.bind(this);

        this.setValue = function(val) {
            inputMirror.setValue(val);
        };

        this.setSize = function(w, h) {
            inputMirror.setSize(w, h);
            outputMirror.setSize(w, h);
        };

        this.focus = function() {
            inputMirror.focus();
        };

        this.uid = baseid++;
    });

    $('a[data-editor-change]').each(function() {
        // find the first editor above this link. start by finding the
        // first parent right under the article
        var parent = $(this);
        do {
            parent = parent.parent();
        } while(!parent.parent().is('article'));

        // zepto doesn't have prevAll, which is stupid
        var node = parent;
        while(node.length && !node.is('.macro-editor')) {
            node = node.prev();
        }
        var editor = node[0];

        if(editor) {
            $(this).on('click', function(e) {
                e.preventDefault();
                editor.setValue(getChange(this.dataset.editorChange));

                if(this.dataset.editorBig) {
                    editor.setSize(null, '15em');
                }
            });
        }
        else {
            var err = Error('WARNING: could not find editor: ' + this);
            err.link = this;
            throw err;
        }
    });

    // all the editors are compiled lazily, when the user scrolls an
    // editor into view
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
            }
        });
    }.bind(this));

    // display sweet.js version

    $('.sweet-version').text('commit c33199a80dafaf25ed0ae0ebab570298da0260f7 on Jan 8');

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

        fun1: 'macro ^ {\n' +
            '  rule { { $x } } => { wrapped($x) }\n' +
            '}\n\n' +
            '^{x};\n' +
            'foo(x, y, ^{z})\n',

        fun2: 'let var = macro {\n' +
            '  rule { [$x, $y] = $arr } => {\n' +
            '    var $x = $arr[0];\n' +
            '    var $y = $arr[1];\n' +
            '  }\n' +
            '}\n\n' +
            'var [foo, bar] = arr;\n',

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
            'foo [bar];',

        // third example
        5: 'macro foo {\n' +
        '  rule { $x } => { $x + \'any\' }\n' +
        '  rule { $x:expr } => { $x + \'expr\' }\n' +
        '}\n\n' +
        'foo baz();',

        6: 'macro foo {\n' +
        '  rule { $x:expr } => { $x + \'expr\' }\n' +
        '  rule { $x } => { $x + \'any\' }\n' +
        '}\n\n' +
        'foo baz();',

        // fourth example
        7: 'macro tag {\n' +
            '  rule { $name [$el ...] } => {\n' +
            '    [$name, $el]\n' +
            '  }\n\n' +
            '  rule { $name $id:ident } => {\n' +
            '    ($id.unshift($name), $id)\n' +
            '  }\n' +
            '}\n\n' +
            'tag "foo" [1, 2, 3];\n' +
            'tag "bar" arr;\n'
    };
});
