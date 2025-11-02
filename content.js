let approvers = [];

// Load approvers from the local file
fetch(chrome.runtime.getURL("approvers.txt"))
  .then(response => response.text())
  .then(text => {
    approvers = text
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);
  })
  .catch(err => console.error("Failed to load approvers.txt:", err));
  
function getPRTitleElement() {
  const el = document.querySelector(".markdown-title");
  if (el) return el;
  return null;
}

function addCopyIcon() {
  const el = getPRTitleElement();
  if (!el) return;
  if (el.nextSibling && el.nextSibling.classList?.contains("copy-link-icon")) return;
  
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icon.png");
  icon.className = "copy-link-icon";
  icon.style.cursor = "pointer";
  icon.style.marginLeft = "8px";
  icon.style.width = "60px";
  icon.style.height = "60px";
  icon.style.verticalAlign = "middle";
  icon.style.transition = "transform 0.2s ease";
  
  icon.addEventListener("mouseenter", () => (icon.style.transform = "scale(1.2)"));
  icon.addEventListener("mouseleave", () => (icon.style.transform = "scale(1)"));
  
  let clickTimer = null;
  
  // Single click - copy with approvers (delayed to detect double-click)
  icon.addEventListener("click", () => {
    if (clickTimer !== null) {
      // This is the second click of a double-click
      clearTimeout(clickTimer);
      clickTimer = null;
      return;
    }
    
    clickTimer = setTimeout(() => {
      clickTimer = null;
      copyElementAsClickableLink(true);
      // Change icon to pressed state
      const originalSrc = icon.src;
      icon.src = chrome.runtime.getURL("iconPressed.png");
      // Optional: revert to original after 1 second
      setTimeout(() => {
        icon.src = originalSrc;
      }, 1000);
    }, 300); // 300ms delay to detect double-click
  });
  
  // Double click - copy without approvers
  icon.addEventListener("dblclick", () => {
    copyElementAsClickableLink(false);
    // Change icon to pressed state
    const originalSrc = icon.src;
    icon.src = chrome.runtime.getURL("iconDoublePressed.png");
    // Optional: revert to original after 1 second
    setTimeout(() => {
      icon.src = originalSrc;
    }, 1000);
  });
  
  el.parentNode.insertBefore(icon, el.nextSibling);
}

function copyElementAsClickableLink(includeApprovers = true) {
  const el = getPRTitleElement();
  if (!el) return;
  
  const text = el.innerText.trim();
  const url = window.location.href;
  
  // Join approvers dynamically only if includeApprovers is true
  const mentions = includeApprovers ? " " + approvers.join(" ") : "";
  
  const temp = document.createElement("div");
  temp.innerHTML = `<a href="${url}">${text}</a>${mentions}`;
  temp.style.position = "absolute";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  
  const range = document.createRange();
  range.selectNodeContents(temp);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  
  try {
    document.execCommand("copy");
    console.log(`✅ Copied clickable link: "${text}"${includeApprovers ? ` with mentions: ${approvers.join(" ")}` : " without mentions"}`);
  } catch (err) {
    console.error("❌ Copy failed:", err);
  }
  
  sel.removeAllRanges();
  document.body.removeChild(temp);
}

// Run on load
addCopyIcon();

// Observe DOM for SPA navigation
const observer = new MutationObserver(addCopyIcon);
observer.observe(document.body, { childList: true, subtree: true });