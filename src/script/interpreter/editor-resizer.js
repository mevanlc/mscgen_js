function init (pInput, pHandle, pRefreshEditor) {
  const lContainer = pInput.parentElement
  const lWideLayout = window.matchMedia('(orientation: landscape) and (min-width: 769px)')
  let lPointerId = null
  let lStartX = 0
  let lStartWidth = 0

  function limits () {
    const lStyle = window.getComputedStyle(lContainer)
    const lMin = parseFloat(lStyle.getPropertyValue('--editor-min-width'))
    const lOutputMin = parseFloat(lStyle.getPropertyValue('--output-min-width'))
    const lAvailable = lContainer.clientWidth - parseFloat(lStyle.paddingLeft) - parseFloat(lStyle.paddingRight)
    return {
      min: lMin,
      max: Math.max(lMin, Math.floor(lAvailable - pHandle.getBoundingClientRect().width - lOutputMin))
    }
  }

  function updateHandle () {
    if (lWideLayout.matches) {
      const lLimits = limits()
      const lWidth = Math.min(lLimits.max, Math.max(lLimits.min, Math.round(pInput.getBoundingClientRect().width)))
      pHandle.setAttribute('aria-valuemin', lLimits.min)
      pHandle.setAttribute('aria-valuemax', lLimits.max)
      pHandle.setAttribute('aria-valuenow', lWidth)
      pHandle.setAttribute('aria-valuetext', `${lWidth} pixels`)
    } else {
      stopDragging()
    }
  }

  function setWidth (pWidth) {
    const lLimits = limits()
    const lWidth = Math.min(lLimits.max, Math.max(lLimits.min, Math.round(pWidth)))
    pInput.style.setProperty('--editor-width', `${lWidth}px`)
    updateHandle()
  }

  function stopDragging (pEvent) {
    if (lPointerId !== null && (!pEvent || pEvent.pointerId === lPointerId)) {
      const lId = lPointerId
      lPointerId = null
      if (pHandle.hasPointerCapture(lId)) {
        pHandle.releasePointerCapture(lId)
      }
      lContainer.classList.remove('is-resizing')
    }
  }

  pHandle.addEventListener('pointerdown', function (pEvent) {
    if (pEvent.button !== 0 || !pEvent.isPrimary || !lWideLayout.matches) {
      return
    }
    pEvent.preventDefault()
    pHandle.focus()
    lPointerId = pEvent.pointerId
    lStartX = pEvent.clientX
    lStartWidth = pInput.getBoundingClientRect().width
    pHandle.setPointerCapture(lPointerId)
    lContainer.classList.add('is-resizing')
  })
  pHandle.addEventListener('pointermove', function (pEvent) {
    if (pEvent.pointerId === lPointerId) {
      setWidth(lStartWidth + pEvent.clientX - lStartX)
    }
  })
  pHandle.addEventListener('pointerup', stopDragging)
  pHandle.addEventListener('pointercancel', stopDragging)
  pHandle.addEventListener('lostpointercapture', stopDragging)
  pHandle.addEventListener('dblclick', function () {
    pInput.style.removeProperty('--editor-width')
    updateHandle()
  })
  pHandle.addEventListener('keydown', function (pEvent) {
    if (!lWideLayout.matches || pEvent.altKey || pEvent.ctrlKey || pEvent.metaKey) {
      return
    }
    const lStep = pEvent.shiftKey ? 64 : 16
    const lWidth = pInput.getBoundingClientRect().width
    switch (pEvent.key) {
      case 'ArrowLeft': setWidth(lWidth - lStep); break
      case 'ArrowRight': setWidth(lWidth + lStep); break
      case 'Home': setWidth(limits().min); break
      case 'End': setWidth(limits().max); break
      default: return
    }
    pEvent.preventDefault()
  })

  const lObserver = new window.ResizeObserver(function () {
    updateHandle()
    pRefreshEditor()
  })
  lObserver.observe(pInput)
  window.addEventListener('resize', updateHandle)
  lWideLayout.addEventListener('change', updateHandle)
  updateHandle()
}

module.exports = { init }
