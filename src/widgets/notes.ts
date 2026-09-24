import { WidgetBase, registerWidget } from "./widgets.js";

const SAVE_DEBOUNCE_MS = 400;
const CONFIRM_RESET_MS = 3000;

class NotesWidget extends WidgetBase {
  #saveTimeout: ReturnType<typeof setTimeout> | undefined;
  #confirmTimeout: ReturnType<typeof setTimeout> | undefined;

  override get category() {
    return "other";
  }

  override get name() {
    return "NotesWidget";
  }

  override defaultSettings() {
    return { text: "" };
  }

  #scheduleSave(text: string) {
    clearTimeout(this.#saveTimeout);
    this.#saveTimeout = setTimeout(() => {
      this.setSetting("text", text);
    }, SAVE_DEBOUNCE_MS);
  }

  #download(text: string) {
    const date = new Date();
    const dateText =
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notities-${dateText}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  override async createContent() {
    const container = document.createElement("div");
    container.classList.add("notes-widget");

    const header = document.createElement("div");
    header.classList.add("notes-header");
    container.appendChild(header);

    const title = document.createElement("div");
    title.classList.add("notes-title");
    title.innerText = "Notities";
    header.appendChild(title);

    const buttons = document.createElement("div");
    buttons.classList.add("notes-buttons");
    header.appendChild(buttons);

    const newButton = document.createElement("button");
    newButton.classList.add("notes-button", "notes-new-button");
    newButton.innerText = "Nieuw";
    buttons.appendChild(newButton);

    const downloadButton = document.createElement("button");
    downloadButton.classList.add("notes-button");
    downloadButton.innerText = "Download";
    buttons.appendChild(downloadButton);

    const textarea = document.createElement("textarea");
    textarea.classList.add("notes-textarea");
    textarea.placeholder = "Typ hier je notities...";
    textarea.spellcheck = false;
    textarea.value = await this.getSetting("text");
    container.appendChild(textarea);

    textarea.addEventListener("input", () => {
      this.#scheduleSave(textarea.value);
    });

    downloadButton.addEventListener("click", () => {
      this.#download(textarea.value);
    });
    
    newButton.addEventListener("click", () => {
      if (!newButton.classList.contains("notes-confirm")) {
        newButton.classList.add("notes-confirm");
        newButton.innerText = "Zeker?";
        this.#confirmTimeout = setTimeout(() => {
          newButton.classList.remove("notes-confirm");
          newButton.innerText = "Nieuw";
        }, CONFIRM_RESET_MS);
        return;
      }

      clearTimeout(this.#confirmTimeout);
      newButton.classList.remove("notes-confirm");
      newButton.innerText = "Nieuw";

      textarea.value = "";
      clearTimeout(this.#saveTimeout);
      this.setSetting("text", "");
      textarea.focus();
    });

    return container;
  }

  override async createPreview() {
    const container = document.createElement("div");
    container.classList.add("notes-widget-preview");

    const title = document.createElement("div");
    title.classList.add("notes-preview-title");
    title.innerText = "Notities";
    container.appendChild(title);

    const lines = document.createElement("div");
    lines.classList.add("notes-preview-lines");
    for (let i = 0; i < 4; i++) {
      const line = document.createElement("div");
      line.classList.add("notes-preview-line");
      lines.appendChild(line);
    }
    container.appendChild(lines);

    return container;
  }

  override async onRemove() {
    clearTimeout(this.#saveTimeout);
    clearTimeout(this.#confirmTimeout);
  }
}

registerWidget(new NotesWidget());
