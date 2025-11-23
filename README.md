
<img src="icon.png" width="100" height="100">

# GitHub QoL Extensions

A Chrome extension that adds quality-of-life improvements to GitHub, including a PR link copier and workflows filter.

---

## 🚀 Features

### PR Link Copier
- 🖱️ **One-click copy:** Copies the PR title as a clickable link.  
- 🧍‍♂️🧍‍♀️ **Optional approvers:** Single-click includes approvers, double-click skips them.  
- 🔄 **Works on dynamic pages:** Auto-detects PR pages and the Pull Requests list page in GitHub.  
- 🎨 **Subtle UI:** Adds a small, animated icon next to the PR title.

### Workflows Filter
- 🔍 **Quick search:** Filter GitHub Actions workflows by name with a searchable dropdown.  
- ⚡ **Fast loading:** Caches workflows for instant access on subsequent visits.  
- 🎯 **Smart detection:** Automatically appears on Actions pages (`/owner/repo/actions` and workflow detail pages).  
- ⌨️ **Keyboard navigation:** Navigate workflows with arrow keys and Enter.

---

## ⚙️ Installation

1. Clone or download this repository.  
2. Open **Chrome** and go to `chrome://extensions/`.  
3. Enable **Developer mode** (top right).  
4. Click **Load unpacked** and select the extension’s folder.
5. Edit approvers.txt as described in the [Configuration section](#-configuration)
6. The PR link copier icon will appear next to PR titles on both individual PR pages and the Pull Requests list page.
7. The workflows filter will automatically appear on GitHub Actions pages.

---

## 🧩 Usage

### PR Link Copier

#### Single-click → copy with approvers  
Copies a Slack-ready message like:  
#### [Add New Sloth icon]() @approver1 @approver2


#### Double-click → copy without approvers  
Copies just the link:  
#### [Add ANOTHER Sloth icon]()


The copied content can be pasted directly into Slack, Teams, or anywhere that supports clickable links.

### Workflows Filter

When you visit a GitHub Actions page (`/owner/repo/actions` or any workflow detail page), a searchable dropdown will appear below the page header.

- **Type to filter:** Start typing in the search box to filter workflows by name
- **Click to navigate:** Click any workflow in the filtered list to navigate to it
- **Keyboard shortcuts:** 
  - Use `↑`/`↓` arrow keys to navigate
  - Press `Enter` to select
  - Press `Escape` to close the dropdown

Workflows are automatically cached for faster loading on subsequent visits. The cache is cleared when you refresh the page.

---

## 🧾 Configuration

Approvers are read from a simple text file named `approvers.txt`.

Each line should contain one Slack handle (with `@`):

@Deni Avdija  
@LeBron James  
@Luka Dončić  


You can update this file without reloading the extension.


---

## 🧠 Behind the Scenes

### PR Link Copier
- Injects a small icon (`icon.png`) next to PR titles on both individual PR pages and the Pull Requests list page.  
- Observes DOM changes to reattach the icon on navigation.  
- Copies formatted HTML for clickable links using `document.execCommand("copy")`.  
- Replaces the icon briefly on click to indicate success.

### Workflows Filter
- Fetches all workflows from GitHub's Actions API by paginating through workflow pages.
- Caches workflow data in sessionStorage for performance.
- Creates a custom dropdown UI that integrates seamlessly with GitHub's design.
- Listens for Turbo navigation events to reinitialize on page changes.

---
## 🤝 Contribute

Pull requests are welcome!  
If you’ve got an idea to make the extension smarter, prettier, or even lazier — go for it.  

- Fork and Clone the repo
- Create a branch on your fork and work on your changes  
- Open a PR to this repository with a clear description  

We’ll review it (lazily but lovingly) 🧡

---

## 🧑‍💻 Credits

Built by the **Growth Core** team to make sharing PRs just a *little bit* lazier.  
Internal use encouraged. External judgment tolerated.

---

## 📄 License

MIT — use it, tweak it, or improve it.

---

> _“Efficiency is doing better what is already being done. Laziness is making it automatic.”_
