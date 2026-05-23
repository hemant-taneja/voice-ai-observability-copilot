;(function () {
  'use strict'

  function getLocationId() {
    try {
      return window.location.hostname.split('.')[0]
        || new URLSearchParams(window.location.search).get('locationId')
        || 'unknown'
    } catch {
      return 'unknown'
    }
  }

  function injectCopilot() {
    if (document.getElementById('voice-ai-copilot-widget')) return

    const locationId = getLocationId()

    const container = document.createElement('div')
    container.id = 'voice-ai-copilot-widget'
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 420px;
      height: 600px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
      z-index: 99999;
      display: none;
    `

    const iframe = document.createElement('iframe')
    iframe.src = `https://your-copilot-domain.com?locationId=${encodeURIComponent(locationId)}`
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
    iframe.allow = 'clipboard-write'

    const toggleBtn = document.createElement('button')
    toggleBtn.id = 'voice-ai-copilot-toggle'
    toggleBtn.textContent = '⚡ Voice AI'
    toggleBtn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #F59E0B;
      color: #000;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      z-index: 99999;
      font-family: 'DM Sans', sans-serif;
      box-shadow: 0 4px 16px rgba(245,158,11,0.4);
    `

    let open = false
    toggleBtn.addEventListener('click', () => {
      open = !open
      container.style.display = open ? 'block' : 'none'
      toggleBtn.style.display = open ? 'none' : 'block'
    })

    container.appendChild(iframe)
    document.body.appendChild(container)
    document.body.appendChild(toggleBtn)

    iframe.addEventListener('load', () => {
      iframe.contentWindow?.postMessage({ type: 'ghl-context', locationId }, '*')
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCopilot)
  } else {
    injectCopilot()
  }
})()
