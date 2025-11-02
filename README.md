
<img src="icon.png" width="100" height="100">

# PR Link Copier

A Chrome extension that adds a small copy icon to pull request pages, letting you instantly copy a formatted, clickable link for Slack — with or without approvers.  

Because typing PR links (and tagging people) is overrated 😎.

---

## 🚀 Features

- 🖱️ **One-click copy:** Copies the PR title as a clickable link.  
- 🧍‍♂️🧍‍♀️ **Optional approvers:** Single-click includes approvers, double-click skips them.  
- 🔄 **Works on dynamic pages:** Auto-detects PR pages in GitHub.  
- 🎨 **Subtle UI:** Adds a small, animated icon next to the PR title.

---

## ⚙️ Installation

1. Clone or download this repository.  
2. Open **Chrome** and go to `chrome://extensions/`.  
3. Enable **Developer mode** (top right).  
4. Click **Load unpacked** and select the extension’s folder.
5. Edit approvers.txt as described in the [configuraion section](#-configuration)
6. The icon will appear next to the PR title when you open a PR page.

---

## 🧩 Usage

### Single-click → copy with approvers  
Copies a Slack-ready message like:  
#### [Add New Sloth icon]() @approver1 @approver2


### Double-click → copy without approvers  
Copies just the link:  
#### [Add ANOTHER Sloth icon]()


The copied content can be pasted directly into Slack, Teams, or anywhere that supports clickable links.

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

The extension:
- Injects a small icon (`icon.png`) next to the PR title.  
- Observes DOM changes to reattach the icon on navigation.  
- Copies formatted HTML for clickable links using `document.execCommand("copy")`.  
- Replaces the icon briefly on click to indicate success.

---

## 🧑‍💻 Credits

Built by the **Growth Core** team to make sharing PRs just a *little bit* lazier.  
Internal use encouraged. External judgment tolerated.

---

## 📄 License

MIT — use it, tweak it, or improve it.

---

> _“Efficiency is doing better what is already being done. Laziness is making it automatic.”_
