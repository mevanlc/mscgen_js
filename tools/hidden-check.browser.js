/* global mscgenjs */
;(async function () {
  const results = []
  function assert (value, message) { if (!value) throw new Error(message) }
  const source = `xu { wordwraparcs=true, wordwrapentities=true, wordwrapboxes=true;
    a [label="Tall\\nentity\\nheader"],b,c;
    a loop c [label="Outer"] {
      a => b [hidden=inherit,label="A long call label that needs to wrap over several lines",url="https://example.com",id="1"];
      b => b [label="self"], a note c [label="Several\\nlines\\nin a note"];
      a => * [label="broadcast"];
      --- [label="divider"]; ... [label="omitted"]; ||| [label="space"];
      a alt c [hidden=false,label="Inner"] { b => a [label="revealed"]; a => b [hidden=true,label="re-hidden"]; };
    };
    a => c [arcskip="1",label="skip"]; a abox c; a rbox c; a box c;
  }`
  function draw (ast, style, mirrored) {
    document.getElementById('chart').innerHTML = ''
    let failure
    mscgenjs.renderMsc(JSON.stringify(ast), {
      elementId: 'chart', inputType: 'json', additionalTemplate: style,
      mirrorEntitiesOnBottom: mirrored, includeSource: false
    }, error => { failure = error })
    if (failure) throw failure
    return document.querySelector('#chart svg')
  }
  function bounds (svg) {
    return [...svg.querySelectorAll('g,text,rect,path,line')].map(element => {
      const box = element.getBBox()
      return [box.x, box.y, box.width, box.height]
    })
  }
  function normalized (svg) {
    const copy = svg.cloneNode(true)
    copy.querySelectorAll('[aria-hidden="true"]').forEach(element => {
      element.style.removeProperty('visibility'); element.style.removeProperty('pointer-events')
      if (!element.getAttribute('style')) element.removeAttribute('style')
      element.removeAttribute('aria-hidden')
    })
    return copy.outerHTML
  }
  async function raster (svg, type) {
    const copy = svg.cloneNode(true)
    const image = new Image()
    const loaded = new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject })
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy))
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = image.width; canvas.height = image.height
    canvas.getContext('2d').drawImage(image, 0, 0)
    return canvas.toDataURL(type)
  }
  try {
    const ast = JSON.parse(mscgenjs.translateMsc(source, { inputType: 'xu', outputType: 'json' }))
    for (const style of [null, 'lazy', 'classic', 'inverted', 'grayscaled']) {
      for (const mirrored of [false, true]) {
        const before = draw(ast, style, mirrored)
        const geometry = JSON.stringify(bounds(before))
        const baseline = normalized(before)
        const hidden = structuredClone(ast)
        hidden.entities[0].hidden = true
        hidden.arcs[0][0].hidden = true
        const after = draw(hidden, style, mirrored)
        assert(normalized(after) === baseline, 'Changed SVG geometry: ' + style)
        assert(JSON.stringify(bounds(after)) === geometry, 'Changed native bounds: ' + style)
        const text = label => [...after.querySelectorAll('text')].find(el => el.textContent === label)
        assert(getComputedStyle(text('revealed')).visibility === 'visible', 'Descendant was not revealed')
        assert(getComputedStyle(text('broadcast')).visibility === 'hidden', 'Broadcast label visible')
        assert(getComputedStyle(text('re-hidden')).visibility === 'hidden', 'Grandchild was not hidden')
        assert(after.querySelectorAll('[aria-hidden="true"]').length > 15, 'Missing hidden components')
        if (!style && !mirrored) {
          const expected = after.cloneNode(true)
          expected.querySelectorAll('[aria-hidden="true"]').forEach(el => el.remove())
          const png = await raster(after, 'image/png')
          assert(png === await raster(expected, 'image/png'), 'Hidden components painted into PNG')
          assert((await raster(after, 'image/jpeg')).startsWith('data:image/jpeg;'), 'JPEG failed')
        }
        assert(normalized(draw(ast, style, mirrored)) === baseline, 'Reveal changed geometry')
        results.push({ style: style || 'default', mirrored, geometry: 'identical', nativeBounds: 'identical' })
      }
    }

    const frame = document.createElement('iframe')
    frame.width = '1200'; frame.height = '900'
    const loaded = new Promise(resolve => { frame.onload = resolve })
    frame.src = '/index.html?debug=true&lang=xu&msc=' + encodeURIComponent(source)
    document.body.appendChild(frame)
    await loaded
    const win = frame.contentWindow
    const wait = async condition => {
      for (let i = 0; i < 200; i++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 25)) }
      throw new Error('Editor did not settle')
    }
    await wait(() => win.document.querySelector('.CodeMirror') && win.document.querySelector('#__svg svg'))
    const editor = win.document.querySelector('.CodeMirror').CodeMirror
    const lines = editor.getValue().split('\n')
    const attributeLine = lines.findIndex(line => line.includes('hidden=inherit'))
    assert(editor.getTokenAt({ line: attributeLine, ch: lines[attributeLine].indexOf('hidden') + 3 }).type === 'attribute', 'Missing hidden highlighting')
    assert(editor.getTokenAt({ line: attributeLine, ch: lines[attributeLine].indexOf('inherit') + 3 }).type === 'variable', 'Missing inherit highlighting')
    const savedSource = editor.getValue()
    const savedChart = win.__svg.innerHTML
    win.__language_msgenny.click()
    assert(editor.getValue() === savedSource, 'Blocked conversion replaced source')
    assert(win.__svg.innerHTML === savedChart, 'Blocked conversion replaced chart')
    assert(win.__language_mscgen.checked && !win.__language_msgenny.checked, 'Blocked conversion changed language')
    assert(win.__error_output.textContent.includes('cannot preserve hidden'), 'Missing conversion explanation')
    let opened = 0
    win.open = () => { opened++ }
    for (const id of ['__show_dot', '__show_vanilla', '__show_doxygen', '__show_html']) {
      const button = win.document.getElementById(id)
      assert(button, 'Missing export control ' + id)
      button.click()
      assert(opened === 0 && win.__error_output.textContent.includes('cannot preserve hidden'), 'Lossy export was allowed: ' + id)
    }
    results.push({ editor: 'source, chart and selected language retained on blocked conversions' })
    win.__language_json.click()
    await wait(() => win.__language_json.checked && editor.getValue().trim().startsWith('{'))
    const roundtrip = JSON.parse(editor.getValue())
    assert(roundtrip.arcs[0][0].arcs[0][0].hidden === 'inherit', 'JSON lost explicit inherit')
    assert(roundtrip.arcs[0][0].arcs[6][0].hidden === false, 'JSON lost explicit false')
    win.__language_mscgen.click()
    await wait(() => win.__language_mscgen.checked && editor.getValue().includes('hidden=false'))
    win.__show_save_as.click()
    await wait(() => win.__save_as_png.href.startsWith('data:image/png') && win.__save_as_jpeg.href.startsWith('data:image/jpeg'))
    assert(decodeURIComponent(win.__save_as_svg.href).includes('visibility: hidden'), 'SVG export lost visibility')
    results.push({ exports: 'Xu/JSON round trip and editor SVG/PNG/JPEG downloads verified' })
    document.getElementById('result').textContent = JSON.stringify({ ok: true, results })
  } catch (error) {
    document.getElementById('result').textContent = JSON.stringify({ ok: false, results, error: error.stack || String(error) })
  }
})()
