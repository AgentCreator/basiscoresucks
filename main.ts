// Import Astral
import { DOMParser } from "jsr:@b-fuze/deno-dom";
import { launch } from "jsr:@astral/astral";
import { toCamelCase } from "jsr:@std/text";
import { format } from "jsr:@std/datetime";

import "jsr:@std/dotenv/load";

const kv = await Deno.openKv("deno.db");
const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_TOKEN")!;

// Deno.cron("the app", "*/1 * * * *", async () => {
// Launch the browser
const browser = await launch();

// Open a new page
const page = await browser.newPage("https://basis.ua/web/login");

await page.waitForNetworkIdle();

type HomeWork = {
  subject: string;
  task: string;
  deadline: Date;
  id: number;
  attachments?: {
    label: string;
    link: string;
  }[] | null;
};

// login
const EMAIL = Deno.env.get("EMAIL")!;
const PASSWORD = Deno.env.get("PASSWORD")!;

const emailBox = await page.$("#login");
const passwordBox = await page.$("input#password");
const submit = await page.$(
  "#wrapwrap > main > div > form > div.clearfix.oe_login_buttons.text-center.gap-1.d-grid.mb-1.pt-3 > button",
);
await emailBox?.type(EMAIL);
// page.keyboard.press("Enter")
// await passwordBox?.click()
// await passwordBox?.focus()
submit?.click();
await page.waitForTimeout(100);
await passwordBox?.type(PASSWORD);
submit?.click();

console.log("logged in!");

await page.waitForNavigation();
const authCookie = (await page.cookies()).find((e) => e.name == "session_id");

console.log("on main page!");

await page.goto("https://basis.ua/student/assignment/details");

await page.waitForNetworkIdle();

console.log("on homework page!");

const tasks = [...await page.$$("td a")]!;

const taskURLs = await Promise.all(tasks.map((e) => e.getAttribute("href")));

// console.log(authCookie);

const taskResponces = await Promise.all(
  taskURLs.map((e) =>
    fetch("https://basis.ua" + e!, {
      headers: {
        Cookie: `session_id=${authCookie?.value}`,
      },
    })
  ),
);

const taskHTMLs = await Promise.all(taskResponces.map((e) => e.text()));
const actualTasks: HomeWork[] = taskHTMLs.map((e, index) => {
  const doc = (new DOMParser()).parseFromString(e, "text/html");
  const deadline = doc.querySelector(
    "#wrap > div > div:nth-child(2) > div > div.row.col-md-12 > div:nth-child(1) > div:nth-child(6) > span",
  )?.textContent.split(".")!;
  const dateDeadline = new Date(
    parseInt(deadline[2]),
    parseInt(deadline[1]) - 1,
    parseInt(deadline[0]),
  );
  const url = taskURLs[index];
  //   console.log(url)
  const hasAttachments =
    doc.querySelector(
      "#wrap > div > div:nth-child(2) > div > div.mt32.assignment-description > span > div",
    ) !== null;

    
    const attachments: {
      label: string;
      link: string;
    }[] = [];
    
    if (hasAttachments) {
      attachments.push({
        link: doc.querySelector(".o_knowledge_file_image > a")?.getAttribute(
          "href",
        )!,
        label: doc.querySelector(".o_knowledge_file_name")?.textContent!,
      });
    }
    console.log(hasAttachments, url, attachments)
    
  return {
    subject: doc.querySelector(
      "#wrap > div > div:nth-child(2) > div > div.row.col-md-12 > div:nth-child(1) > div:nth-child(4) > span",
    )?.textContent!,
    task: doc.querySelector(
      ".assignment-description > span",
    )?.textContent! + (doc.querySelector("span > img.img-fluid o_we_custom_image") === null ?"": ` [Картинка:](https://${doc.querySelector("span > img.img-fluid o_we_custom_image")!.getAttribute("src")})`),
    deadline: dateDeadline,
    id: parseInt(url!.split("/").at(-1)!)!,
    attachments: hasAttachments ? attachments : null
  };
});

console.log(actualTasks);

// const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${encodeURI("-1002370620815")}&text=hello%20world!`, {
//   method: "POST",
//   body: JSON.stringify({
//     chat_id: "+KurmJjv3hCliYzAy",
//     text: "Hello World!",
//   })
// })

// console.log(res, await res.text())

  actualTasks.forEach(async (e) => {
    console.log("telling the world about homework №", e.id, "!");
    const key = ["hw", e.id];
    const res = await kv.atomic()
      .check({ key, versionstamp: null })
      .set(key, e)
      .commit();
    if (res.ok && e.deadline.getTime() > (new Date()).getTime()) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const newText = `
**Задали нову домашку по предмету " #${toCamelCase(e.subject)} " на ${
        [
          "Неділлю",
          "Понеділок",
          "Вівторок",
          "Середу",
          "Четвер",
          "Пʼятницю",
          "Суботу",
        ][e.deadline.getDay()]
      } (${format(e.deadline, "dd-mm-yyyy")})!**

${e.task}
${e.attachments !== null? "Завантажити "+e.attachments?.map((o) => `[ ${o.label}](${"https://basis.ua"+o.link})`).join(", ") : ""}
        `;
      console.log(newText);

      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=-1002370620815&text=${
          encodeURIComponent(newText)
        }&parse_mode=markdown`,
        {
          method: "POST",
        },
      );
      console.log(res);
    }
  });

// Take a screenshot of the page and save that to disk
// const screenshot = await page.screenshot();
// Deno.writeFileSync("screenshot.png", screenshot);

// Close the browser
await browser.close();
// });
