import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { sheetToArray } from "../util/sheet.js";
import fs from "fs";
import path from "path";

puppeteer.use(StealthPlugin());

const settings = {
  headless: process.env.NODE_ENV === "production",
  downloadDir: path.resolve(process.cwd(), "downloads"),
};

export const PuppeteerManager = {
  browser: null,
  pages: [],
  timeoutId: null,

  async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: settings.headless,
        args: ["--no-sandbox"],
      });
      console.log("Navegador iniciado.");
    }
    return this.browser;
  },

  async createPage({ cookies = "", domain = "" } = {}) {
    await this.getBrowser();
    const page = await this.browser.newPage();
    this.pages.push(page);

    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: settings.downloadDir,
    });

    page.setRequestInterception(true);
    page.on("request", (request) => {
      ["image"].includes(
        request.resourceType()
      )
        ? request.abort()
        : request.continue();
    });

    if (cookies) {
      const parsedCookies = cookies.split("; ").map((c) => {
        const [name, value] = c.split("=");
        return { name, value, domain, path: "/" };
      });
      await page.setCookie(...parsedCookies);
    }

    this.resetCloseTimer();
    page.on("close", () => this.onPageClose(page));

    return page;
  },

  listenerDownload({ page, delay = 1000 }) {
    return new Promise((resolve, reject) => {
      page.on("response", async (response) => {
        if (response.request().resourceType() === "document") {
          const contentDisposition = response.headers()["content-disposition"];
          if (contentDisposition) {
            const filename = decodeURIComponent(
              escape(contentDisposition.split("filename=")[1].replace(/"/g, ""))
            );
            try {
              const fileName = `${settings.downloadDir}/${filename}`;
              await new Promise((res) => setTimeout(res, 3 * delay));
              const fileBuffer = fs.readFileSync(fileName);
              const values = await sheetToArray(fileBuffer);
              resolve(values);
            } catch (error) {
              reject(error);
            }
          }
        }
      });
    });
  },

  async closeBrowser() {
    if (this.browser) {
      fs.readdirSync(settings.downloadDir).forEach((file) => {
        const filePath = path.join(settings.downloadDir, file);
        if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
      });
      await this.browser.close();
      this.browser = null;
      this.pages = [];
      console.log("Navegador fechado.");
    }
  },

  resetCloseTimer() {
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      if (this.pages.length === 0) {
        this.closeBrowser();
      }
    }, 5 * 60 * 1000); // 5 minutos
  },

  onPageClose(page) {
    this.pages = this.pages.filter((p) => p !== page);
    this.resetCloseTimer();
  },
};

export default PuppeteerManager;
