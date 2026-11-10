// Attach show/hide password toggles to all password inputs on the page.
// If an existing toggle button is present (button.toggle-pw), it will be wired as well.
(function () {
  function createEyeIcon(isVisible) {
    if (isVisible) {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
        '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
        '<path d="M1 1l22 22"/>' +
        '</svg>';
    }
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
      '<circle cx="12" cy="12" r="3"/>' +
      '</svg>';
  }

  function attachToggle(input) {
    if (!input || input.dataset.pwToggleAttached) return;
    input.dataset.pwToggleAttached = 'true';
    // ensure parent is positioned
    const parent = input.parentElement;
    if (parent) {
      const style = window.getComputedStyle(parent);
      if (style.position === 'static') parent.style.position = 'relative';
    }

    // check for existing button with class toggle-pw inside parent
    let btn = parent.querySelector('button.toggle-pw');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toggle-pw';
      btn.title = 'Show/hide password';
      btn.style.position = 'absolute';
      btn.style.right = '10px';
      btn.style.top = '50%';
      btn.style.transform = 'translateY(-50%)';
      btn.style.border = 'none';
      btn.style.background = 'none';
      btn.style.padding = '4px';
      btn.style.cursor = 'pointer';
      btn.style.color = '#666';
      btn.setAttribute('aria-label', 'Toggle password visibility');
      parent.appendChild(btn);
    }

    function updateIcon() {
      btn.innerHTML = createEyeIcon(input.type === 'text');
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (input.type === 'password') input.type = 'text';
      else input.type = 'password';
      updateIcon();
    });

    // Initialize icon state
    updateIcon();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[type="password"]').forEach(attachToggle);
  });

  // Also observe DOM for dynamically added password inputs
  const obs = new MutationObserver(function (mutations) {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches && node.matches('input[type="password"]')) attachToggle(node);
        node.querySelectorAll && node.querySelectorAll('input[type="password"]').forEach(attachToggle);
      }
    }
  });
  obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
})();
