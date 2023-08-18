import { createCursor } from "ghost-cursor";
import puppeteer, { Page } from "puppeteer";

type Config = {
  TW_USERNAME: string;
  TW_PASSWORD: string;
  TW_SEARCH: string;
  CHROME_PATH: string;
};

class App {
  public page: Page;
  public config: Config;
  public cursor: ReturnType<typeof createCursor>;

  constructor(config: Config) {
    this.config = config;
  }

  async delay(seconds: number) {
    const rnd = Math.random() * (seconds / 15);
    const total = (seconds = seconds + rnd) * 1000;

    return new Promise((r) => setTimeout(r, total));
  }

  async init() {
    if (!this.config.CHROME_PATH) {
      throw new Error("No se encontro la ruta de Chrome");
    }

    console.log(`Chrome: ${this.config.CHROME_PATH}`);

    const browser = await puppeteer.launch({
      headless: false,
      executablePath: this.config.CHROME_PATH,
      args: ["--lang=es-ES,es"],
    });

    this.page = await browser.newPage();

    await this.page.setExtraHTTPHeaders({
      "Accept-Language": "es",
    });

    await installMouseHelper(this.page);

    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "language", {
        get: function () {
          return "es-ES";
        },
      });
      Object.defineProperty(navigator, "languages", {
        get: function () {
          return ["es-ES", "es"];
        },
      });
    });

    this.cursor = createCursor(this.page);
  }

  async findByText(selector: string, text: string[]) {
    console.log(`Buscando elementos ${selector}`);

    const elements = await this.page.$$(selector);

    console.log(`Buscando elemento ${selector} con texto ${text}`);

    const elementsWithText = await Promise.all(
      elements.map(async (b) => ({
        element: b,
        text: await b.evaluate((e) => e.textContent),
      }))
    );

    const element = elementsWithText.find((b) => text.includes(b.text));

    if (!element) {
      throw new Error(
        `No se consiguio el elemento ${selector} con texto: ${text}`
      );
    }

    return element;
  }

  async type(selector: string, text: string) {
    const handle = await this.page.waitForSelector(selector);

    if (null) {
      throw new Error(`No se encontro el elemento: ${selector}`);
    }

    await handle!.scrollIntoView();

    this.cursor.click(handle!);
    await handle.focus();

    await this.delay(1);

    await handle!.type(text, { delay: 100 + Math.random() * 100 });
  }
}

export default App;

export async function installMouseHelper(page: Page) {
  await page.evaluateOnNewDocument(() => {
    // Install mouse helper only for top-level frame.
    if (window !== window.parent) return;
    window.addEventListener(
      "DOMContentLoaded",
      () => {
        const box = document.createElement("puppeteer-mouse-pointer");
        const styleElement = document.createElement("style");
        styleElement.innerHTML = `
        puppeteer-mouse-pointer {
          pointer-events: none;
          position: absolute;
          top: 0;
          z-index: 10000;
          left: 0;
          width: 20px;
          height: 20px;
          background: rgba(0,0,0,.4);
          border: 1px solid white;
          border-radius: 10px;
          margin: -10px 0 0 -10px;
          padding: 0;
          transition: background .2s, border-radius .2s, border-color .2s;
        }
        puppeteer-mouse-pointer.button-1 {
          transition: none;
          background: rgba(0,0,0,0.9);
        }
        puppeteer-mouse-pointer.button-2 {
          transition: none;
          border-color: rgba(0,0,255,0.9);
        }
        puppeteer-mouse-pointer.button-3 {
          transition: none;
          border-radius: 4px;
        }
        puppeteer-mouse-pointer.button-4 {
          transition: none;
          border-color: rgba(255,0,0,0.9);
        }
        puppeteer-mouse-pointer.button-5 {
          transition: none;
          border-color: rgba(0,255,0,0.9);
        }
      `;
        document.head.appendChild(styleElement);
        document.body.appendChild(box);
        document.addEventListener(
          "mousemove",
          (event) => {
            box.style.left = event.pageX + "px";
            box.style.top = event.pageY + "px";
            updateButtons(event.buttons);
          },
          true
        );
        document.addEventListener(
          "mousedown",
          (event) => {
            updateButtons(event.buttons);
            box.classList.add("button-" + event.which);
          },
          true
        );
        document.addEventListener(
          "mouseup",
          (event) => {
            updateButtons(event.buttons);
            box.classList.remove("button-" + event.which);
          },
          true
        );

        function updateButtons(buttons: number) {
          for (let i = 0; i < 5; i++)
            box.classList.toggle("button-" + i, Boolean(buttons & (1 << i)));
        }
      },
      false
    );
  });
}
