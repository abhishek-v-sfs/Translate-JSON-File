#!/usr/bin/env node

import { chromium } from "playwright";
import inquirer from "inquirer";
import { readFileSync, writeFileSync } from "fs";
import lodash from "lodash";
import cliProgress from "cli-progress";
import { promisify } from "util";
import { exec } from "child_process";
import ora from "ora";

const execAsync = promisify(exec);

const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

function getLocale(language) {
  switch (language) {
    case "FRENCH":
      return "fr";
    case "SPANISH":
      return "es";
    case "KANNADA":
      return "kn";
    default:
      return "en";
  }
}

function flatten(object, addToList, prefix) {
  Object.keys(object).map((key) => {
    if (object[key] === null) {
      addToList[prefix + key] = "";
    } else if (object[key] instanceof Array) {
      for (i in object[key]) {
        flatten(object[key][i], addToList, prefix + key + "." + i);
      }
    } else if (
      typeof object[key] == "object" &&
      !object[key].toLocaleDateString
    ) {
      flatten(object[key], addToList, prefix + key + ".");
    } else {
      addToList[prefix + key] = object[key];
    }
  });
  return addToList;
}

async function configure() {
  const spinner = ora({
    color: "yellow",
    text: "Installing Playwright",
  }).start();

  const { stdout } = await execAsync("npx playwright install");

  spinner.succeed("Successfully installed Playwright");
}

(async () => {
  let moduleEnJson;

  await configure();

  const sourceAndLanguage = await inquirer.prompt([
    {
      type: "input",
      name: "sourcePath",
      message: "Enter source JSON file path (English)",
      default: "./appModule.json",
      validate: (value) => {
        try {
          const a = readFileSync(value);
          moduleEnJson = JSON.parse(a);
          return true;
        } catch (error) {
          console.log(error);
          return "Please enter valid path";
        }
      },
    },
    {
      type: "list",
      name: "language",
      message: "Select language",
      choices: ["KANNADA", "FRENCH", "SPANISH"],
    },
  ]);

  const browser = await chromium.launch({
    headless: true,
  });
  const page = await browser.newPage();

  const engJson = flatten(moduleEnJson, [], "");
  let translatedJson = {};

  const totalItemsToTranslate = Object.keys(engJson).length;

  bar1.start(totalItemsToTranslate, 0);

  let completedCount = 0;

  await page.goto(
    `https://translate.google.com/?sl=auto&tl=${getLocale(
      sourceAndLanguage.language
    )}&op=translate`
  );

  await page.waitForSelector("text=English >> visible=true");

  await page.waitForTimeout(2000);

  let shouldClearPreviousInput = false;
  const paginatedJson = [];

  Object.keys(engJson).forEach((key, index) => {
    if (index % 50 === 0) {
      paginatedJson.push([]);
    }
    paginatedJson[paginatedJson.length - 1].push(key);
  });

  for (const pageKeys of paginatedJson) {
    if (shouldClearPreviousInput) {
      await page.getByRole("button", { name: "Clear source text" }).click();
    }

    const placeHolderText = "'API'";

    const stringToTranslate =
      `${placeHolderText} ` +
      pageKeys.map((key) => lodash.get(engJson, key)).join("\n\n"); //add a random string to get the translation

    await page
      .getByRole("combobox", { name: "Source text" })
      .fill(stringToTranslate);

    await page.getByRole("button", { name: "Copy translation" }).textContent(); //wait for the translation to be completed
    let string = await page
      .getByText(`${placeHolderText}`)
      .last()
      .textContent();

    string = string.replace(placeHolderText, ""); //remove the random string
    string = lodash.upperFirst(string); // capitalize the first letter

    completedCount += pageKeys.length;

    bar1.update(completedCount);

    string.split("\n\n").forEach((string, index) => {
      const key = pageKeys[index];
      lodash.set(translatedJson, key, string);
    });

    shouldClearPreviousInput = true;
  }

  const finalJson = {};
  for (const key in translatedJson) {
    if (Object.hasOwnProperty.call(translatedJson, key)) {
      const element = translatedJson[key];
      lodash.set(finalJson, key, element);
    }
  }

  await browser.close();

  bar1.stop();

  const destination = await inquirer.prompt([
    {
      type: "input",
      name: "destinationPath",
      message: "Enter destination JSON file path",
      default: "./appModule.json",
      validate: (value) => {
        try {
          return true;
        } catch (error) {
          console.log(error);
          return "Please enter valid path";
        }
      },
    },
  ]);
  writeFileSync(
    destination.destinationPath,
    JSON.stringify(finalJson, null, 2)
  );
  console.log(
    `\x1b[32m%s\x1b[0m`,
    `File written to ${destination.destinationPath}`
  );
})();
