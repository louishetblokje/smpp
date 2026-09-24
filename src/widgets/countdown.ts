import { WidgetBase, registerWidget } from "./widgets.js";

const DAY_MS = 1000 * 60 * 60 * 24;
const HOUR_MS = 1000 * 60 * 60;
const MINUTE_MS = 1000 * 60;

class CountdownWidget extends WidgetBase {
  #root: HTMLElement | null = null;
  #tickInterval: ReturnType<typeof setInterval> | undefined;

  override get category() {
    return "other";
  }

  override get name() {
    return "CountdownWidget";
  }

  override defaultSettings() {
    return { date: "", label: "" };
  }

  #stopTicking() {
    if (this.#tickInterval !== undefined) {
      clearInterval(this.#tickInterval);
      this.#tickInterval = undefined;
    }
  }

  #renderSetup() {
    this.#stopTicking();
    const root = this.#root;
    if (!root) {
      return;
    }
    root.replaceChildren();

    const title = document.createElement("div");
    title.classList.add("countdown-title");
    title.innerText = "Countdown";
    root.appendChild(title);

    const hint = document.createElement("div");
    hint.classList.add("countdown-hint");
    hint.innerText = "Pick a moment to count down to:";
    root.appendChild(hint);

    const dateInput = document.createElement("input");
    dateInput.type = "datetime-local";
    dateInput.classList.add("countdown-input");
    root.appendChild(dateInput);

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.classList.add("countdown-input");
    labelInput.placeholder = "Label (optional)";
    labelInput.spellcheck = false;
    labelInput.value = this.settings.label;
    root.appendChild(labelInput);

    const startButton = document.createElement("button");
    startButton.classList.add("countdown-button");
    startButton.innerText = "Start countdown";
    startButton.addEventListener("click", () => {
      void this.#saveTarget(dateInput.value, labelInput.value.trim());
    });
    root.appendChild(startButton);

    const onEnter = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void this.#saveTarget(dateInput.value, labelInput.value.trim());
      }
    };
    dateInput.addEventListener("keydown", onEnter);
    labelInput.addEventListener("keydown", onEnter);
  }

  #createUnit(label: string): { element: HTMLElement; value: HTMLElement } {
    const unit = document.createElement("div");
    unit.classList.add("countdown-unit");

    const value = document.createElement("div");
    value.classList.add("countdown-unit-value");
    value.innerText = "00";
    unit.appendChild(value);

    const unitLabel = document.createElement("div");
    unitLabel.classList.add("countdown-unit-label");
    unitLabel.innerText = label;
    unit.appendChild(unitLabel);

    return { element: unit, value };
  }

  #renderCountdown(target: Date, label: string) {
    this.#stopTicking();
    const root = this.#root;
    if (!root) {
      return;
    }
    root.replaceChildren();

    const header = document.createElement("div");
    header.classList.add("countdown-header");
    root.appendChild(header);

    const title = document.createElement("div");
    title.classList.add("countdown-title");
    title.innerText = label || "Countdown";
    header.appendChild(title);

    const editButton = document.createElement("button");
    editButton.classList.add("countdown-edit-button");
    editButton.innerText = "Edit";
    editButton.title = "Change the countdown target";
    editButton.addEventListener("click", () => {
      void this.setSetting("date", "");
    });
    header.appendChild(editButton);

    const grid = document.createElement("div");
    grid.classList.add("countdown-grid");
    root.appendChild(grid);

    const days = this.#createUnit("Days");
    const hours = this.#createUnit("Hours");
    const minutes = this.#createUnit("Minutes");
    const seconds = this.#createUnit("Seconds");
    grid.append(days.element, hours.element, minutes.element, seconds.element);

    const doneMessage = document.createElement("div");
    doneMessage.classList.add("countdown-done-message");
    doneMessage.innerText = "Time's up!";
    root.appendChild(doneMessage);

    const update = () => {
      const diff = target.getTime() - Date.now();

      if (diff <= 0) {
        this.#stopTicking();
        days.value.innerText = "00";
        hours.value.innerText = "00";
        minutes.value.innerText = "00";
        seconds.value.innerText = "00";
        doneMessage.classList.add("visible");
        return;
      }

      days.value.innerText = String(Math.floor(diff / DAY_MS));
      hours.value.innerText = String(
        Math.floor((diff % DAY_MS) / HOUR_MS)
      ).padStart(2, "0");
      minutes.value.innerText = String(
        Math.floor((diff % HOUR_MS) / MINUTE_MS)
      ).padStart(2, "0");
      seconds.value.innerText = String(
        Math.floor((diff % MINUTE_MS) / 1000)
      ).padStart(2, "0");
    };

    update();
    this.#tickInterval = setInterval(update, 1000);
  }

  #render() {
    const dateValue: string = this.settings.date;
    if (!dateValue) {
      this.#renderSetup();
      return;
    }

    const target = new Date(dateValue);
    if (isNaN(target.getTime())) {
      this.#saveTarget("", this.settings.label);
      this.#renderSetup();
      return;
    }

    this.#renderCountdown(target, this.settings.label);
  }

  async #saveTarget(dateValue: string, label: string) {
    await this.setSetting("label", label);
    await this.setSetting("date", dateValue);
  }

  override async createContent() {
    const root = document.createElement("div");
    root.classList.add("countdown-widget");
    this.#root = root;
    this.#render();
    return root;
  }

  override async createPreview() {
    const container = document.createElement("div");
    container.classList.add("countdown-preview");

    const title = document.createElement("div");
    title.classList.add("countdown-preview-title");
    title.innerText = "Countdown";
    container.appendChild(title);

    const grid = document.createElement("div");
    grid.classList.add("countdown-preview-grid");

    const sample = [
      ["67", "Days"],
      ["08", "Hours"],
      ["46", "Minutes"],
      ["32", "Seconds"],
    ] as const;
    for (const [value, unitLabel] of sample) {
      const unit = document.createElement("div");
      unit.classList.add("countdown-unit");

      const unitValue = document.createElement("div");
      unitValue.classList.add("countdown-unit-value");
      unitValue.innerText = value;
      unit.appendChild(unitValue);

      const label = document.createElement("div");
      label.classList.add("countdown-unit-label");
      label.innerText = unitLabel;
      unit.appendChild(label);

      grid.appendChild(unit);
    }
    container.appendChild(grid);

    return container;
  }

  override async onSettingsChange() {
    this.#render();
  }

  override async onRemove() {
    this.#stopTicking();
  }
}

registerWidget(new CountdownWidget());