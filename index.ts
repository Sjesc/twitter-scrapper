import App from "./App";
import * as fs from "fs";
import { execSync } from 'child_process';
import * as inquirer from "@inquirer/prompts";
import { list } from "regedit";
const regedit = require('regedit').promisified

const config = {
  TW_USERNAME: process.env.TW_USERNAME,
  TW_PASSWORD: process.env.TW_PASSWORD,
  TW_SEARCH: process.env.TW_SEARCH,
  CHROME_PATH: process.env.CHROME_PATH,
};


async function searchChrome() {
  try {
    const registry = "HKCR\\ChromeHTML\\shell\\open\\command"
    const chromeBin = (await regedit.list(registry))[registry]?.values?.['']?.value?.split("\"")[1]

    if (chromeBin) {
      return chromeBin
    }
  } catch {
  }

  const possiblePaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];

  for (const path of possiblePaths) {
      try {
        fs.statSync(path)
        return path;
      } catch {
      }
  }

  return null; // Chrome not found
}


const login = async (app: App) => {
  await app.page.goto("https://twitter.com/i/flow/login");

  await app.type(
    "input[autocomplete=username]",
    config.TW_USERNAME.toString() ?? "LlenaElEnv"
  );

  await app.delay(1);

  const nextButton = await app.findByText("span", ["Next", "Siguiente"]);
  await app.cursor.click(nextButton.element);

  await app.delay(1.5);


  await app.type(
    "input[autocomplete=current-password]",
    config.TW_PASSWORD?.toString() ?? "LlenaElEnv"
  );

  await app.delay(1);

  await app.page.click('button[aria-label="Mostrar contraseña"]');

  await app.delay(1);

  const loginButton = await app.findByText("span", [
    "Log in",
    "Iniciar sesión",
  ]);

  await app.cursor.click(loginButton.element);

  await app.page.waitForSelector('a[href="/explore"]');
};

const search = async (app: App) => {
  await app.cursor.click('a[href="/explore"]');

  await app.delay(1);

  await app.type('input[aria-label="Search query"]', app.config.TW_SEARCH);

  await app.delay(0.5);

  await app.page.keyboard.press("Enter");

  console.log("Esperando por resultados...");
  await app.page.waitForSelector("[data-testid=tweetText]");

  await app.delay(2);

  let tweets: { text: string; tag: string; username: string; time: string, comment: number, like: number, view: number, retweet: number }[] =
    [];

  while (true) {
    console.log("Guardando tweets...");

    const elements = await app.page.$$("[data-testid=tweet]");

    if (elements.length === 0) {
      throw new Error("No se encontraron tweets");
    }

    try {
      const users = await Promise.all(
        elements.map((e) =>
          e.evaluate(
            (t) => t.querySelector("[data-testid=User-Name]").textContent
          )
        )
      );

      const texts = await Promise.all(
        elements.map((e) =>
          e.evaluate(
            (t) => t.querySelector("[data-testid=tweetText]").textContent
          )
        )
      );

      const comments = await Promise.all(
        elements.map((e) =>
          e.evaluate(
            (t) => t.querySelector("[data-testid=reply]").textContent ?? "0"
          )
        )
      )

      const retweets = await Promise.all(
        elements.map((e) =>
          e.evaluate(
            (t) => t.querySelector("[data-testid=retweet]").textContent ?? "0"
          )
        )
      )

      const likes = await Promise.all(
        elements.map((e) =>
          e.evaluate(
            (t) => t.querySelector("[data-testid=like]").textContent ?? "0"
          )
        )
      )

      const views = await Promise.all(
        elements.map((e) =>
          e.evaluate(
            (t) => t.querySelector("a[href*=analytics]").textContent ?? "0"
          )
        )
      )

      users.forEach((user, i) => {
        const text = texts[i];
        const comment = +getDefaultValue(comments[i], "0")
        const retweet = +getDefaultValue(retweets[i], "0")
        const like = +getDefaultValue(likes[i], "0")
        const view = +getDefaultValue(views[i], "0")

        if (tweets.some((t) => t.text === text)) {
          return;
        }

        const [username, rest] = user.split("@");
        const [tag, time] = rest.split("·");

        tweets.push({ username, tag, time, text, comment, retweet, like, view });
      });

      await fs.promises.writeFile(
        `tweets-${config.TW_SEARCH.toLowerCase()}.json`,
        JSON.stringify(tweets)
      );
    } catch (error) {
      console.log(`Error guardando tweets: ${error}`);
    } finally {
      const lastTweet = elements[elements.length - 1];

      await lastTweet.scrollIntoView();

      await app.delay(5);
    }
  }
};

(async () => {
  const configFileName = "./twitter-config.json";

  const configExists = await fs.promises
    .access(configFileName)
    .then(() => true)
    .catch(() => false);

  if (configExists) {
    const configFile = JSON.parse(
      (await fs.promises.readFile(configFileName)).toString()
    );
    config.CHROME_PATH = configFile.CHROME_PATH;
    config.TW_USERNAME = configFile.TW_USERNAME;
    config.TW_PASSWORD = configFile.TW_PASSWORD;
    config.TW_SEARCH = configFile.TW_SEARCH;
  }

  const user = await inquirer.input({
    message: "Introduce el usuario de Twitter",
    default: config.TW_USERNAME,
  });

  const password = await inquirer.input({
    message: "Introduce la contraseña de Twitter",
    default: config.TW_PASSWORD,
  });

  const twSearch = await inquirer.input({
    message: "Introduce el texto a buscar",
    default: config.TW_SEARCH,
  });

  const chrome = config.CHROME_PATH || await searchChrome()

  const chromePath = await inquirer.input({
    message: "Introduce la ruta de chrome",
    default: chrome ?? "",
  });

  try {
    fs.statSync(chromePath)
  } catch {
    throw Error("La ruta de chrome es incorrecta")
  }

  config.CHROME_PATH = chromePath;
  config.TW_USERNAME = user;
  config.TW_PASSWORD = password;
  config.TW_SEARCH = twSearch;

  await fs.writeFileSync(configFileName, JSON.stringify(config));

  const app = new App(config);

  await app.init();

  console.log("Iniciando sesion...");
  await login(app);
  console.log("Se ha iniciado sesion correctamente");

  console.log("Buscando tweets...");
  await search(app);
})();


function getDefaultValue(value: any, defaultValue: any) {
  if(!value) {
    return defaultValue
  }

  return value
}