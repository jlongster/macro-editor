
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
        receivers[id].handler(e.data.err, e.data.src, e.data.maxExpanded);
        delete receivers[id];
      }
    }
  });

  var compile = _.debounce(function(id, inst, out, container, opts) {
    opts = opts || {};
    var msgTimer = setTimeout(function() {
      out.setValue('compiling...');
    }, 200);
    var reqId = baseid++;

    worker.postMessage({
      editorId: id,
      requestId: reqId,
      src: inst.getValue(),
      maxExpands: opts.maxExpands
    });

    receivers[id] = {
      requestId: reqId,
      handler: function(err, src, maxExpanded) {
        var status = container.find('.status');
        status.hide();
        clearTimeout(msgTimer);

        if(err) {
          status.show().text(err);
        }
        else {
          clearTimeout(msgTimer);
          out.setValue(src);

          if(maxExpanded) {
            // this is very leaky abstraction, but meh
            container.find('.title span').text('done!');
            container.find('button.step')
              .removeClass('working').addClass('disabled')
              .text('Done!');
          }
          else if(opts.maxExpands) {
            container.find('.title span').text('step ' + opts.maxExpands);
            container.find('button.step').removeClass('working');
          }
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

    el.append('<div class="title"><strong>stepping</strong>: <span></span></div>');
    el.append('<div class="content"></div>');
    var innerEl = el.find('.content');

    var inputMirror = CodeMirror(innerEl[0], {
      value: content,
      mode:  'javascript',
      theme: 'ambiance'
    });

    var outputMirror = CodeMirror(innerEl[0], {
      mode:  'javascript',
      theme: 'ambiance',
      readOnly: true
    });

    var h = el.find('.CodeMirror:first-child').height();
    inputMirror.setSize('500px', null);
    outputMirror.setSize('500px', h);

    var both = el.find('.CodeMirror');
    $(both[0]).addClass('input');
    $(both[1]).addClass('output');

    var status = $('<div class="status error"></div>');
    el.append(status);

    innerEl.append(
      '<div class="controls">' +
        '  <button class="reset">Revert to Original</button>' +
        '  <button class="open-stepper">Open Stepper</button>' +
        '</div>'
    );
    
    if(el.attr('id')) {
      innerEl.find('.controls').append(
        '  <a href="#' + el.attr('id') + '" class="permalink">' +
        '    <img src="/img/permalink-grey.png" />' +
        '  </a>'
      );
    }

    innerEl.append(
      '<div class="stepper">' +
        '<div class="content"></div>' +
        '<div class="controls">' +
        '  <button class="step">Step</button>' +
        '  <button class="close-stepper">Close</button>' +
        '</div>' +
        '</div>');

    var maxExpands = 1;
    var stepMirror = null;

    el.find('button.open-stepper').on('click', function(e) {
      maxExpands = 1;
      var container = $(e.target).parents('.macro-editor').addClass('stepping');
      var inner = container.find('.stepper .content');

      var h = el.find('.CodeMirror:first-child').height();
      inner.height(h);

      var srcMirror = CodeMirror(inner[0], {
        mode:  'javascript',
        theme: 'ambiance',
        readOnly: true
      });
      srcMirror.setSize('50%', '100%');
      srcMirror.setValue(inputMirror.getValue());

      stepMirror = CodeMirror(inner[0], {
        mode:  'javascript',
        theme: 'ambiance',
        readOnly: true
      });
      stepMirror.setSize('50%', '100%');
      stepMirror.setValue('// step once to see output');
      container.find('.title span').text('step 0');
      inner.find('.CodeMirror:last-child').addClass('expanded');

      if(el.is('#tutorial')) {
        $(document.body).addClass('tutorial-stepping');
      }
    }.bind(this));

    el.find('button.close-stepper').on('click', function(e) {
      var container = el.removeClass('stepping');
      stepMirror = null;
      var stepper = container.find('.stepper');
      stepper.find('.content').html('');
      container.find('button.step')
        .removeClass('working').removeClass('disabled')
        .text('Step');

      stepper.on('transitionend', function() {
        if(!container.is('.stepping')) {
          stepper.find('.content').height(0);
        }
        stepper.off('transitionend');
      });
      this.compile();

      if(el.is('#tutorial')) {
        $(document.body).removeClass('tutorial-stepping');
      }
    }.bind(this));

    el.find('button.step').on('click', function(e) {
      var container = $(e.target).parents('.macro-editor').addClass('stepping');
      var numEl = container.find('.title span');
      el.find('button.step').addClass('working');
      if(numEl.text() !== 'done!') {
        compile(this.uid, inputMirror, stepMirror, container, { maxExpands: maxExpands++ });
      }
    }.bind(this));

    el.find('button.reset').on('click', function() {
      maxExpands = 1;
      inputMirror.setValue(content);
    });

    inputMirror.on('change', function() {
      var h = el.find('.CodeMirror.input').height();
      outputMirror.setSize(width / 2, h);
      this.compile();
    }.bind(this));

    this.compile = function(opts) {
      this.hasCompiled = true;
      compile(this.uid, inputMirror, outputMirror, el, opts);
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
        var href = e.target.href;
        if(href[href.length - 1] === '#') {
          e.preventDefault();
        }
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

  $('.sweet-version').text('commit 7f445802e0da9eb3a0468aaf927cfbf8c89f1c46 on Jan 21');

  // changes

  function getChange(id) {
    if(!CHANGES[id]) {
      throw new Error('changeset not found: ' + id);
    }
    return CHANGES[id];
  }

  var CHANGES = {
    // tutorial
    tutorial: 'macro bar {\n' +
      '  rule { $x } => { $x }\n' +
      '}\n\n' +
      'bar "This text is different!";\n' +
      'bar "The macro name changed too";',

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
