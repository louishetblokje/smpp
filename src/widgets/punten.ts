import { WidgetBase, registerWidget } from "./widgets.js";
import { getSchoolName } from "../fixes-utils/utils.js";
import { DEBUG, sendDebug, getExtensionImage } from "../common/utils.js";

interface EvaluationCourse {
  name?: string;
}

interface Evaluation {
  graphic?: { value?: number | string } | null;
  courses?: EvaluationCourse[];
}

interface VakTotaal {
  name: string;
  total: number;
  count: number;
}

const ONVOLDOENDE_GRENS = 0;
const VOLDOENDE_GRENS = 50;
const GOED_BEZIG_GRENS = 70;
const UITSTEKEND_GRENS = 80;

class PuntenWidget extends WidgetBase {
  body: HTMLElement | null = null;

  override get category() {
    return "other";
  }

  override get name() {
    return "PuntenWidget";
  }

  override defaultSettings() {
    return {
      monochrome: false,
    };
  }

  override async onSettingsChange() {
    if (this.body) {
      this.loadPunten(this.body);
    }
  }

  async fetchEvaluaties(): Promise<Evaluation[]> {
    const schoolName = getSchoolName();
    if (!schoolName) {
      throw new Error("Schoolnaam kon niet bepaald worden.");
    }
    const url = `https://${schoolName}.smartschool.be/results/api/v1/evaluations/?itemsOnPage=1000`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (DEBUG) sendDebug("[PT]", "Evaluations fetched:", data);
    return Array.isArray(data) ? data : [];
  }

  berekenGemiddeldes(evaluaties: Evaluation[]) {
    const perVak = new Map<string, VakTotaal>();
    let totaal = 0;
    let aantal = 0;

    for (const evaluatie of evaluaties) {
      const raw = evaluatie?.graphic?.value;
      const waarde = typeof raw === "string" ? parseFloat(raw) : raw;
      if (typeof waarde !== "number" || Number.isNaN(waarde)) continue;

      const vakNaam = evaluatie.courses?.[0]?.name || "Onbekend vak";
      const vak = perVak.get(vakNaam) || { name: vakNaam, total: 0, count: 0 };
      vak.total += waarde;
      vak.count += 1;
      perVak.set(vakNaam, vak);

      totaal += waarde;
      aantal += 1;
    }

    const vakken = Array.from(perVak.values())
      .map((vak) => ({ name: vak.name, average: vak.total / vak.count }))
      .sort((a, b) => a.average - b.average);

    const overallAverage = aantal > 0 ? totaal / aantal : null;

    return { vakken, overallAverage };
  }

  kleurVoorWaarde(waarde: number): string {
    if (waarde >= UITSTEKEND_GRENS) return "var(--color-green)";
    if (waarde >= GOED_BEZIG_GRENS) return "var(--color-accent)";
    if (waarde >= VOLDOENDE_GRENS) return "var(--color-orange)";
    return "var(--color-red)";
  }

  override async createContent() {
    const container = document.createElement("div");
    container.classList.add("punten-widget");

    const title = document.createElement("h2");
    title.classList.add("punten-title");
    title.innerText = "Mijn Punten";
    container.appendChild(title);

    const body = document.createElement("div");
    body.classList.add("punten-body");
    container.appendChild(body);
    this.body = body;

    this.loadPunten(body);

    return container;
  }

  maakVakRij(
    vak: { name: string; average: number },
    monochrome: boolean
  ): HTMLElement {
    const row = document.createElement("div");
    row.classList.add("punten-vak-row");

    const naam = document.createElement("span");
    naam.classList.add("punten-vak-name");
    naam.innerText = vak.name;
    naam.title = vak.name;

    const barContainer = document.createElement("div");
    barContainer.classList.add("punten-vak-bar-container");

    const bar = document.createElement("div");
    bar.classList.add("punten-vak-bar");
    const clampedWidth = Math.max(0, Math.min(100, vak.average));
    bar.style.width = `${clampedWidth}%`;
    if (!monochrome) {
      const barKleur =
        vak.average >= GOED_BEZIG_GRENS
          ? "#5cc951"
          : vak.average >= VOLDOENDE_GRENS
            ? "#ffd353"
            : "#e14448";
      bar.style.setProperty("background-color", barKleur, "important");
    }
    barContainer.appendChild(bar);

    const waarde = document.createElement("span");
    waarde.classList.add("punten-vak-value");
    waarde.innerText = `${vak.average.toFixed(1)}%`;
    if (!monochrome) {
      waarde.style.color = this.kleurVoorWaarde(vak.average);
    }

    row.append(naam, barContainer, waarde);
    return row;
  }

  loadPunten(body: HTMLElement) {
    body.innerText = "Bezig met laden...";
    const monochrome = Boolean(this.settings.monochrome);

    this.fetchEvaluaties()
      .then((evaluaties) => {
        const { vakken, overallAverage } = this.berekenGemiddeldes(evaluaties);
        body.innerHTML = "";

        if (overallAverage === null) {
          const geen = document.createElement("div");
          geen.classList.add("punten-geen-data");
          geen.innerText = "Nog geen resultaten gevonden.";
          body.appendChild(geen);
          return;
        }

        const overallDiv = document.createElement("div");
        overallDiv.classList.add("punten-overall");

        const overallValue = document.createElement("div");
        overallValue.classList.add("punten-overall-value");
        overallValue.innerText = `${overallAverage.toFixed(1)}%`;
        if (!monochrome) {
          overallValue.style.color = this.kleurVoorWaarde(overallAverage);
        }
        overallDiv.appendChild(overallValue);

        body.appendChild(overallDiv);

        const groepen = [
          {
            titel: "Onvoldoende",
            vakken: vakken.filter((v) => v.average < VOLDOENDE_GRENS),
          },
          {
            titel: "Kan beter",
            vakken: vakken.filter(
              (v) =>
                v.average >= VOLDOENDE_GRENS && v.average < GOED_BEZIG_GRENS
            ),
          },
          {
            titel: "Goed",
            vakken: vakken.filter((v) => v.average >= GOED_BEZIG_GRENS),
          },
        ];

        for (const groep of groepen) {
          if (groep.vakken.length === 0) continue;

          const groepTitel = document.createElement("div");
          groepTitel.classList.add("punten-groep-titel");
          groepTitel.innerText = groep.titel;
          body.appendChild(groepTitel);

          const list = document.createElement("div");
          list.classList.add("punten-vakken-list");

          groep.vakken.forEach((vak) => {
            list.appendChild(this.maakVakRij(vak, monochrome));
          });

          body.appendChild(list);
        }
      })
      .catch((error) => {
        console.error("SMPP: Kon punten niet ophalen:", error);
        body.innerHTML = "";
        const fout = document.createElement("div");
        fout.classList.add("punten-geen-data");
        fout.innerText = "Kon je punten niet ophalen.";
        body.appendChild(fout);
      });
  }

  override async createPreview() {
    const previewContainer = document.createElement("div");
    previewContainer.classList.add("punten-widget-preview");

    const title = document.createElement("div");
    title.classList.add("punten-preview-title");
    title.innerText = "Punten";
    previewContainer.appendChild(title);

    const image = document.createElement("div");
    image.classList.add("results-icon-128");
    image.style.marginTop = "1rem";
    previewContainer.appendChild(image);

    return previewContainer;
  }
}

registerWidget(new PuntenWidget());
