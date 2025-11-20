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
  
function getPRTitleElements() {
  const el = document.querySelectorAll(".markdown-title");
  if (el) return el;
  return null;
}

function isPRPage(path) {
	const regex = /^\/[^\/]+\/[^\/]+\/pull\/\d+\/?$/;
	return regex.test(path);
}

function isPullsPage(path) {
	const regex = /^\/[^\/]+\/[^\/]+\/pulls\/?$/;
	return regex.test(path);
}

function addCopyIcon() {
	const path = window.location.pathname;
	if (isPRPage(path)) {
		addSingleCopyIcon();
	}
	else if (isPullsPage(path)) {
		addAllCopyIcons();
	}
}

function addSingleCopyIcon() {
	const elAll = getPRTitleElements();
	if (!elAll) return;
	addCopyIconToElement(elAll[0], 1);
}

function addAllCopyIcons() {
	const elAll = getPRTitleElements();
	if (!elAll) return;
	elAll.forEach(el => { addCopyIconToElement(el, 0.5) });
}

function addCopyIconToElement(el, sizeScale) {
  if (!el) return;
  if (el.nextSibling && el.nextSibling.classList?.contains("copy-link-icon")) return;
  
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icon.png");
  icon.className = "copy-link-icon";
  icon.style.cursor = "pointer";
  icon.style.marginLeft = (8 * sizeScale) + "px";
  icon.style.width = (60 * sizeScale) + "px";
  icon.style.height = (60 * sizeScale) + "px";
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
      copyElementAsClickableLink(el, true);
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
    copyElementAsClickableLink(el, false);
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

function copyElementAsClickableLink(el, includeApprovers = true) {
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

// Run on load/navigation
document.addEventListener("turbo:load", addCopyIcon);