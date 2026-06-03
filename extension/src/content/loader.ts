// Content scripts are loaded as classic scripts. Use dynamic import to load the module entry.
void import(chrome.runtime.getURL('content/content.js')).catch((error) => {
  console.error('FocusTube: failed to load module content script', error);
});
