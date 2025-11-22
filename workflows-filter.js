/**
 * Finds the targeted GitHub Actions top pane div.
 * GitHub loads pages dynamically, so we wait until the element appears.
 */
function waitForActionsTopPane(retries = 30) {
    return new Promise(resolve => {
        let attempts = 0;

        const interval = setInterval(() => {
            attempts++;

            const targetDiv = document.querySelector(
                'div[data-target="split-page-layout.pane"].PageLayout-pane'
            );

            if (targetDiv) {
                clearInterval(interval);
                resolve(targetDiv);
            }

            if (attempts >= retries) {
                clearInterval(interval);
                resolve(null);
            }
        }, 300);
    });
}

/**
 * Extract owner/repo from the URL path like /owner/repo/actions
 */
function getOwnerRepo() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Fetch one page of the workflow runs HTML, parse the page,
 * and return a list of { name, href } for each run's workflow.
 */
async function fetchWorkflowsPageHtml(page) {
  const info = getOwnerRepo();
  if (!info) return null;

  const url = `https://github.com/${info.owner}/${info.repo}/actions/workflows_partial?page=${page}`;
  const resp = await fetch(url, { credentials: "include" });

  if (!resp.ok) {
    // GitHub returns 404 or empty when no more pages → stop
    return null;
  }

  const text = await resp.text();
  return text;
}

async function fetchAllWorkflows() {
  let results = '';
  let page = 1;

  while (true) {
    const workflowsPageHtml = await fetchWorkflowsPageHtml(page);

    if (workflowsPageHtml === null) break;             // no more pages (non-200)
    if (workflowsPageHtml.length === 0) break;         // empty list → no more pages

    results += workflowsPageHtml;

    page++;
    if (page > 50) break; // safety guard
  }

  return results;
}

function htmlToWorkflowOptions(htmlString) {
    const doc = new DOMParser().parseFromString(htmlString, "text/html");

    // Select all <a> elements that point to a workflow file
    const links = doc.querySelectorAll(
        'a[href*="/actions/workflows/"]'
    );

    const fragment = document.createDocumentFragment();

    links.forEach(link => {
        const name = link.textContent.trim();
        const href = link.href;

        const option = document.createElement("option");
        option.value = href;
        option.textContent = name;

        fragment.appendChild(option);
    });

    return fragment;
}

/**
 * Creates a filterable dropdown option element.
 */
function createDropdownOption(name, href) {
    const option = document.createElement("div");
    option.className = "ga-dropdown-option";
    option.textContent = name;
    option.dataset.href = href;
    option.setAttribute("role", "option");
    option.setAttribute("tabindex", "0");
    
    const navigate = (e) => {
        if (!href) return;
        
        // Create a temporary anchor element that PJAX will intercept
        const link = document.createElement("a");
        link.href = href;
        link.style.display = "none";
        document.body.appendChild(link);
        
        // Trigger click which PJAX will intercept
        link.click();
        
        // Clean up
        document.body.removeChild(link);
    };
    
    option.addEventListener("click", navigate);
    
    option.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(e);
        }
    });
    
    return option;
}

// Cache key prefix for sessionStorage
const CACHE_PREFIX = 'ga-workflows-cache-';

/**
 * Get cached workflows for a repository
 */
function getCachedWorkflows(repoKey) {
    try {
        const cached = sessionStorage.getItem(CACHE_PREFIX + repoKey);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (e) {
        console.warn('Failed to read workflows cache:', e);
    }
    return null;
}

/**
 * Cache workflows for a repository
 */
function setCachedWorkflows(repoKey, workflows) {
    try {
        sessionStorage.setItem(CACHE_PREFIX + repoKey, JSON.stringify(workflows));
    } catch (e) {
        console.warn('Failed to cache workflows:', e);
    }
}

/**
 * Clear cached workflows for a repository
 */
function clearCachedWorkflows(repoKey) {
    try {
        sessionStorage.removeItem(CACHE_PREFIX + repoKey);
    } catch (e) {
        console.warn('Failed to clear workflows cache:', e);
    }
}

/**
 * Check if the page was loaded via refresh
 */
function isPageRefresh() {
    // Modern API
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
        return navEntries[0].type === 'reload';
    }
    // Fallback for older browsers
    if (performance.navigation) {
        return performance.navigation.type === performance.navigation.TYPE_RELOAD;
    }
    return false;
}

/**
 * Check if the current URL matches the Actions page patterns using regex
 * Matches: /owner/repo/actions or /owner/repo/actions/workflows/*
 */
function isActionsPage() {
    const pathname = window.location.pathname;
    // Matches: /*/*/actions or /*/*/actions/workflows/*
    const actionsPageRegex = /^\/[^/]+\/[^/]+\/actions$|^\/[^/]+\/[^/]+\/actions\/workflows\/.+$/;
    return actionsPageRegex.test(pathname);
}

/**
 * Inserts a filterable dropdown adjacent to the Actions header.
 */
async function insertDropdown() {
    // Only run on Actions pages
    if (!isActionsPage()) {
        return;
    }
    
    const container = await waitForActionsTopPane();

    if (!container) {
        console.warn("GitHub Actions dropdown extension: Target container not found.");
        return;
    }

    // Remove existing dropdown if it exists (more reliable than just checking)
    const existingDropdown = document.querySelector("#ga-custom-dropdown");
    if (existingDropdown) return;

    const headerRow = container.querySelector(".d-flex.flex-justify-between");
    if (!headerRow) return;
    
    
    // Create dropdown container immediately
    const dropdownContainer = document.createElement("div");
    dropdownContainer.id = "ga-custom-dropdown";
    dropdownContainer.className = "ga-custom-dropdown";

    // Create input wrapper for spinner
    const inputWrapper = document.createElement("div");
    inputWrapper.className = "ga-dropdown-input-wrapper";

    // Create input for filtering
    const input = document.createElement("input");
    input.type = "text";
    input.className = "ga-dropdown-input";
    input.placeholder = "Filter workflows...";
    input.setAttribute("autocomplete", "off");
    input.disabled = true; // Disable until workflows are loaded

    // Create loading spinner
    const spinner = document.createElement("div");
    spinner.className = "ga-dropdown-spinner";
    spinner.innerHTML = `
        <svg class="ga-spinner-svg" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="28.27" stroke-dashoffset="28.27" opacity="0.2"/>
            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="28.27" stroke-dashoffset="21.2">
                <animate attributeName="stroke-dashoffset" dur="1.5s" values="28.27;0" repeatCount="indefinite"/>
            </circle>
        </svg>
    `;

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(spinner);

    // Create dropdown panel
    const dropdownPanel = document.createElement("div");
    dropdownPanel.className = "ga-dropdown-panel";
    dropdownPanel.setAttribute("role", "listbox");

    // Create options container
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "ga-dropdown-options";

    dropdownPanel.appendChild(optionsContainer);
    dropdownContainer.appendChild(inputWrapper);
    dropdownContainer.appendChild(dropdownPanel);

    // Insert immediately before fetching workflows
    headerRow.parentNode.insertBefore(dropdownContainer, headerRow.nextSibling);

    // Get repo identifier for caching
    const repoInfo = getOwnerRepo();
    const cacheKey = repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : null;
    
    // Clear cache if page was loaded via refresh
    if (cacheKey && isPageRefresh()) {
        clearCachedWorkflows(cacheKey);
    }
    
    // Check if workflows are already cached
    let workflows = cacheKey ? getCachedWorkflows(cacheKey) : null;
    
    if (workflows) {
        // Use cached workflows - no need to show spinner or fetch
        spinner.remove();
        input.disabled = false;
    } else {
        // Fetch workflows asynchronously
        const workflowsHtml = await fetchAllWorkflows();
        const doc = new DOMParser().parseFromString(workflowsHtml, "text/html");
        const links = doc.querySelectorAll('a[href*="/actions/workflows/"]');
        
        // Store workflow data
        workflows = Array.from(links).map(link => ({
            name: link.textContent.trim(),
            href: link.getAttribute('href') // Use getAttribute for relative paths
        }));

        // Cache workflows for this repo
        if (cacheKey) {
            setCachedWorkflows(cacheKey, workflows);
        }

        // Remove spinner and enable input
        spinner.remove();
        input.disabled = false;
    }

    // Populate initial options
    workflows.forEach(workflow => {
        const option = createDropdownOption(workflow.name, workflow.href);
        optionsContainer.appendChild(option);
    });

    // Filter functionality
    let filteredWorkflows = workflows;
    input.addEventListener("input", (e) => {
        const filterText = e.target.value.toLowerCase().trim();
        
        // Clear existing options
        optionsContainer.innerHTML = "";
        
        // Filter workflows
        filteredWorkflows = workflows.filter(workflow =>
            workflow.name.toLowerCase().includes(filterText)
        );
        
        // Show filtered options or "No results" message
        if (filteredWorkflows.length === 0) {
            const noResults = document.createElement("div");
            noResults.className = "ga-dropdown-option ga-dropdown-option-no-results";
            noResults.textContent = "No workflows found";
            optionsContainer.appendChild(noResults);
        } else {
            filteredWorkflows.forEach(workflow => {
                const option = createDropdownOption(workflow.name, workflow.href);
                optionsContainer.appendChild(option);
            });
        }
        
        // Show panel if input has focus
        if (document.activeElement === input) {
            dropdownPanel.classList.add("ga-dropdown-panel-visible");
        }
    });

    // Show/hide dropdown panel
    input.addEventListener("focus", () => {
        dropdownPanel.classList.add("ga-dropdown-panel-visible");
    });

    input.addEventListener("blur", (e) => {
        // Delay to allow click events on options to fire
        setTimeout(() => {
            if (!dropdownContainer.contains(document.activeElement)) {
                dropdownPanel.classList.remove("ga-dropdown-panel-visible");
            }
        }, 200);
    });

    // Keyboard navigation
    let selectedIndex = -1;
    input.addEventListener("keydown", (e) => {
        const options = Array.from(optionsContainer.querySelectorAll(".ga-dropdown-option:not(.ga-dropdown-option-no-results)"));
        
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
            options[selectedIndex]?.focus();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            if (selectedIndex === -1) {
                input.focus();
            } else {
                options[selectedIndex]?.focus();
            }
        } else if (e.key === "Enter" && selectedIndex >= 0 && options[selectedIndex]) {
            e.preventDefault();
            options[selectedIndex].click();
        } else if (e.key === "Escape") {
            dropdownPanel.classList.remove("ga-dropdown-panel-visible");
            input.blur();
        }
    });
}

// Listen to turbo:load events
document.addEventListener("turbo:load", insertDropdown);
