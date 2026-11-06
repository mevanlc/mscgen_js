// Extend the packaged mode without modifying CodeMirror's installation.
var CodeMirror = require('codemirror')
require('codemirror/mode/mscgen/mscgen')

CodeMirror.defineMode('xu-local', function (config) {
  var mode = CodeMirror.getMode(config, { name: 'mscgen', language: 'xu' })
  var token = mode.token
  mode.token = function (stream, state) {
    if (!state.inComment && !state.inString && state.inAttributeList) {
      if (stream.match(/^hidden\b/i)) return 'attribute'
      if (stream.match(/^inherit\b/i)) return 'variable'
    }
    var style = token(stream, state)
    // The packaged mode tracks attribute lists on its shared configuration;
    // keep our extension's state per editor and copy it with CodeMirror's state.
    if (style !== 'comment' && style !== 'string') {
      if (stream.current() === '[') state.inAttributeList = true
      if (stream.current() === ']') state.inAttributeList = false
    }
    return style
  }
  return mode
})
CodeMirror.defineMIME('text/x-xu', 'xu-local')
