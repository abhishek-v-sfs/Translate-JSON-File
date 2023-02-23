#!/usr/bin/node
import { chromium } from "playwright";
import inquirer from "inquirer";
import clipboardy from "clipboardy";

(async () => {
  const a = await inquirer.prompt([
    {
      type: "input",
      name: "sourcePath",
      message: "Enter source JSON file path (English)",
      default: "../../../locales/en/appModule.json",
      validate: (value) => {
        try {
          require(value);
          return true;
        } catch (error) {
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
  console.log(a);
  const moduleEnJson = require(a.sourcePath);

  const browser = await chromium.launch({
    headless: false,
  });
  const page = await browser.newPage();
  const lodash = require("lodash");
  const { flatten } = require("./utills");

  const engJson = flatten(moduleEnJson, [], "");
  let frJson = {};

  await page.goto("https://translate.google.com/");

  await page.waitForSelector("text=English >> visible=true");

  await page.getByRole("button", { name: "More target languages" }).click();

  await page
    .getByRole("main", { name: "Text translation" })
    .getByText(a.language)
    .nth(2)
    .click();
  await page
    .getByRole("main", { name: "Text translation" })
    .getByText(a.language)
    .nth(2)
    .click();

  await page.waitForTimeout(2000);

  let clear = false;
  for (const key of Object.keys(engJson)) {
    if (clear) {
      await page.getByRole("button", { name: "Clear source text" }).click();
    }
    await page
      .getByRole("combobox", { name: "Source text" })
      .fill(engJson[key]);

    await page
      .getByRole("button", { name: "Copy translation" })
      .first()
      .click();

    const string = await clipboardy.read();

    console.log(string);
    frJson[key] = string;

    clear = true;
  }

  const json = {};
  for (const key in frJson) {
    if (Object.hasOwnProperty.call(frJson, key)) {
      const element = frJson[key];
      lodash.set(json, key, element);
    }
  }
  await clipboardy.write(JSON.stringify(json, null, 2));
  console.log(json);

  await browser.close();
})();
