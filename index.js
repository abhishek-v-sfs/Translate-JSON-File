#!/usr/bin/env node

import { chromium } from "playwright";
import inquirer from "inquirer";
import { readFileSync, writeFileSync } from "fs";
import lodash from "lodash";
import cliProgress from "cli-progress";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

function getLocale(language) {
  switch (language) {
    case "FRENCH":
      return "fr";
    case "SPANISH":
      return "es";
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
(async () => {
  let moduleEnJson;

  console.log("Installing playwright...");
  const { stdout } = await execAsync("npx playwright install");

  const a = await inquirer.prompt([
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
      choices: ["FRENCH", "SPANISH"],
    },
  ]);

  const browser = await chromium.launch({
    headless: true,
  });
  const page = await browser.newPage();

  const engJson = flatten(moduleEnJson, [], "");
  let frJson = {};

  bar1.start(Object.keys(engJson).length, 0);
  let completed = 0;

  await page.goto(
    `https://translate.google.com/?sl=auto&tl=${getLocale(
      a.language
    )}&op=translate`
  );

  await page.waitForSelector("text=English >> visible=true");

  await page.waitForTimeout(2000);

  let clear = false;
  const paginated = [];

  Object.keys(engJson).forEach((key, index) => {
    if (index % 50 === 0) {
      paginated.push([]);
    }
    paginated[paginated.length - 1].push(key);
  });

  for (const pageKeys of paginated) {
    if (clear) {
      await page.getByRole("button", { name: "Clear source text" }).click();
    }

    const stringToTranslate =
      "dwerewerwerw " +
      pageKeys.map((key) => lodash.get(engJson, key)).join("\n"); //add a random string to get the translation

    await page
      .getByRole("combobox", { name: "Source text" })
      .fill(stringToTranslate);

    await page.getByRole("button", { name: "Copy translation" }).textContent(); //wait for the translation to be completed
    let string = await page.getByText("dwerewerwerw").last().textContent();

    string = string.replace(/dwerewerwerw /i, ""); //remove the random string
    string = lodash.upperFirst(string); // capitalize the first letter

    completed += pageKeys.length;

    bar1.update(completed);

    string.split("\n").forEach((string, index) => {
      const key = pageKeys[index];
      lodash.set(frJson, key, string);
    });

    clear = true;
  }

  const json = {};
  for (const key in frJson) {
    if (Object.hasOwnProperty.call(frJson, key)) {
      const element = frJson[key];
      lodash.set(json, key, element);
    }
  }

  await browser.close();

  bar1.stop();

  const b = await inquirer.prompt([
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
  writeFileSync(b.destinationPath, JSON.stringify(json, null, 2));
  console.log(`\x1b[32m%s\x1b[0m`, `File written to ${b.destinationPath}`);
})();
