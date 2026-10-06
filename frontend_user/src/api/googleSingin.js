function getState() {
  if (!window.__cmmGoogleSignIn) {
    window.__cmmGoogleSignIn = {
      initialized: false,
      clientId: null,
      callback: null,
    }
  }

  return window.__cmmGoogleSignIn
}

export function renderGoogleSignIn(element, clientId, callback) {
  const google = window.google

  if (!google?.accounts?.id) {
    throw new Error('Google sign-in library has not loaded.')
  }

  if (!element || !clientId) {
    throw new Error('Google button or Client ID is missing.')
  }

  const state = getState()

  if (state.initialized && state.clientId !== clientId) {
    throw new Error('Google Client ID changed. Refresh the browser.')
  }

  if (!state.initialized) {
    google.accounts.id.initialize({
      client_id: clientId,

      callback: response => {
        state.callback?.(response)
      },

      auto_select: false,
      ux_mode: 'popup',
    })

    state.clientId = clientId
    state.initialized = true
  }

  state.callback = callback

  element.replaceChildren()

  google.accounts.id.renderButton(element, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    width: Math.min(400, element.clientWidth || 280),
  })

  return () => {
    if (state.callback === callback) {
      state.callback = null
    }
  }
}