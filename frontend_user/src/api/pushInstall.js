export function configurePushInstallMetadata(basePath = '/') {
  const base = new URL(basePath, window.location.origin + '/')

  function link(rel, href) {
    if (document.querySelector('link[rel="' + rel + '"]')) return
    const element = document.createElement('link')
    element.rel = rel
    element.href = new URL(href, base).href
    document.head.appendChild(element)
  }

  function meta(name, content) {
    if (document.querySelector('meta[name="' + name + '"]')) return
    const element = document.createElement('meta')
    element.name = name
    element.content = content
    document.head.appendChild(element)
  }

  link('manifest', 'cmm-push.webmanifest')
  link('apple-touch-icon', 'cmm-push-180.png?v=5c6e6e55fc')
  meta('apple-mobile-web-app-capable', 'yes')
  meta('mobile-web-app-capable', 'yes')
  meta('apple-mobile-web-app-title', 'CMM-FT')
}
