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
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            // Prevent default scrolling, but let the event bubble to container
            e.preventDefault();
            // Don't stop propagation - let it bubble to container handler
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

    // Skip insertion if dropdown already exists
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
    let selectedIndex = -1;
    
    const updateOptions = () => {
        // Clear existing options
        optionsContainer.innerHTML = "";
        
        // Filter workflows
        filteredWorkflows = workflows.filter(workflow =>
            workflow.name.toLowerCase().includes(input.value.toLowerCase().trim())
        );
        
        // Reset selected index when filtering
        selectedIndex = -1;
        
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
    };
    
    input.addEventListener("input", (e) => {
        updateOptions();
        
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
        // Delay to allow click events on options to fire and keyboard navigation
        setTimeout(() => {
            if (!dropdownContainer.contains(document.activeElement)) {
                dropdownPanel.classList.remove("ga-dropdown-panel-visible");
                // Reset selection when panel closes
                optionsContainer.querySelectorAll(".ga-dropdown-option-selected").forEach(opt => {
                    opt.classList.remove("ga-dropdown-option-selected");
                });
                selectedIndex = -1;
            }
        }, 200);
    });
    
    // Keep panel visible when options are focused
    optionsContainer.addEventListener("focusin", (e) => {
        if (e.target.classList.contains("ga-dropdown-option")) {
            dropdownPanel.classList.add("ga-dropdown-panel-visible");
        }
    });

    // Keyboard navigation - handle on both input and container
    const handleArrowNavigation = (e) => {
        // Only handle arrow keys, Enter, and Escape
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter" && e.key !== "Escape") {
            return;
        }
        
        // Get fresh options list each time
        const options = Array.from(optionsContainer.querySelectorAll(".ga-dropdown-option:not(.ga-dropdown-option-no-results)"));
        
        if (options.length === 0) {
            return; // No options to navigate
        }
        
        if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            
            // Ensure panel is visible
            dropdownPanel.classList.add("ga-dropdown-panel-visible");
            
            // Sync selectedIndex with currently focused option if applicable
            const activeEl = document.activeElement;
            if (activeEl && activeEl.classList.contains("ga-dropdown-option")) {
                const currentIndex = options.indexOf(activeEl);
                if (currentIndex >= 0) {
                    selectedIndex = currentIndex;
                }
            }
            
            // Move to next option
            selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
            
            // Remove all selection highlights
            options.forEach(opt => opt.classList.remove("ga-dropdown-option-selected"));
            
            // Highlight and focus the selected option
            if (selectedIndex >= 0 && selectedIndex < options.length) {
                const selectedOption = options[selectedIndex];
                if (selectedOption) {
                    selectedOption.classList.add("ga-dropdown-option-selected");
                    selectedOption.focus();
                    selectedOption.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            
            // Ensure panel is visible
            dropdownPanel.classList.add("ga-dropdown-panel-visible");
            
            // Sync selectedIndex with currently focused option if applicable
            const activeEl = document.activeElement;
            if (activeEl && activeEl.classList.contains("ga-dropdown-option")) {
                const currentIndex = options.indexOf(activeEl);
                if (currentIndex >= 0) {
                    selectedIndex = currentIndex;
                }
            }
            
            // Move to previous option
            selectedIndex = Math.max(selectedIndex - 1, -1);
            
            // Remove all selection highlights
            options.forEach(opt => opt.classList.remove("ga-dropdown-option-selected"));
            
            if (selectedIndex === -1) {
                input.focus();
            } else if (selectedIndex >= 0 && selectedIndex < options.length) {
                const selectedOption = options[selectedIndex];
                if (selectedOption) {
                    selectedOption.classList.add("ga-dropdown-option-selected");
                    selectedOption.focus();
                    selectedOption.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }
            }
        } else if (e.key === "Enter") {
            if (selectedIndex >= 0 && selectedIndex < options.length && options[selectedIndex]) {
                e.preventDefault();
                e.stopPropagation();
                options[selectedIndex].click();
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            dropdownPanel.classList.remove("ga-dropdown-panel-visible");
            input.focus();
            // Reset selection
            options.forEach(opt => opt.classList.remove("ga-dropdown-option-selected"));
            selectedIndex = -1;
        }
    };
    
    // Add keyboard navigation to input
    input.addEventListener("keydown", handleArrowNavigation);
    
    // Add keyboard navigation to options container (for when focus is on an option)
    // Use capture phase to ensure we handle it before the option element
    optionsContainer.addEventListener("keydown", handleArrowNavigation, true);
}

// Listen to turbo:load events
document.addEventListener("turbo:load", insertDropdown);
