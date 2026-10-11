(() => {
  const loaderScript = document.currentScript;
  if (!loaderScript) return;

  const footerUrl = new URL("index.html", loaderScript.src);
  const styleUrl = new URL("style.css", footerUrl);
  const stylesheetExists = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some(link => link.href === styleUrl.href);

  if (!stylesheetExists) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = styleUrl.href;
    document.head.append(stylesheet);
  }

  const container = document.getElementById("footer-container");
  if (!container) return;

  function connectFooterLinks() {
    const footer = container.querySelector(".careplus-footer");
    if (!footer) return false;

    footer.querySelectorAll("a[href]").forEach(link => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("http")) return;
      link.href = new URL(href, footerUrl).href;
    });
    return true;
  }

  const observer = new MutationObserver(() => {
    if (connectFooterLinks()) observer.disconnect();
  });
  observer.observe(container, { childList: true, subtree: true });
  connectFooterLinks();

  if (container.hasAttribute("data-footer-autoload") && !container.querySelector(".careplus-footer")) {
    fetch(footerUrl)
      .then(response => {
        if (!response.ok) throw new Error(`Footer request failed: ${response.status}`);
        return response.text();
      })
      .then(markup => {
        const footerDocument = new DOMParser().parseFromString(markup, "text/html");
        const footer = footerDocument.querySelector(".careplus-footer");
        if (!footer) throw new Error("CarePlus footer markup is missing.");
        container.replaceChildren(document.importNode(footer, true));
        connectFooterLinks();
      })
      .catch(error => console.error("Could not load CarePlus footer:", error));
  }
})();
