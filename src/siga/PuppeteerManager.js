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
  browsers: new Map(),
  timeoutIds: new Map(),

  async createBrowserInstance(cookies) {
    const browser = await puppeteer.launch({
      headless: settings.headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        `--disable-infobars`,
        `--window-size=1280,800`,
        `--disable-extensions`,
        `--disable-dev-shm-usage`,
        `--disable-gpu`,
        `--allow-insecure-localhost`,
      ],
    });
    console.log("Navegador iniciado para:", cookies);
    this.browsers.set(cookies, browser);
    return browser;
  },

  async getBrowser(user) {
    // Retorna um navegador existente ou cria um novo para o perfil de cookies
    if (!this.browsers.has(user)) {
      const browser = await this.createBrowserInstance(user);
      this.resetCloseTimer(user);
      return browser;
    }
    this.resetCloseTimer(user);
    return this.browsers.get(user);
  },

  async createPage({ cookies = "", domain = "" } = {}) {
    const user =
      cookies.match(/(;| )(user)=([^;]*)/i)?.[3] ||
      Math.random().toString(36).slice(2);
    const browser = await this.getBrowser(user);
    const page = await browser.newPage();

    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: settings.downloadDir,
    });

    page.setRequestInterception(true);
    page.on("request", (request) => {
      ["image"].includes(request.resourceType())
        ? request.abort()
        : request.continue();
    });

    if (cookies) {
      const parsedCookies = cookies.split(";").map((c) => {
        const [name, value] = c.split("=");
        return { name: name.trim(), value: value.trim(), domain, path: "/" };
      });
      await page.setCookie(...parsedCookies);
    }

    page.on("close", () => this.onPageClose(user, page));
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
              const fileName = path.join(settings.downloadDir, filename);
              await new Promise((res) => setTimeout(res, 3 * delay));
              if (fs.existsSync(fileName)) {
                const fileBuffer = fs.readFileSync(fileName);
                const values = await sheetToArray(fileBuffer);
                resolve(values);
              } else {
                reject(new Error(`Arquivo não encontrado: ${fileName}`));
              }
            } catch (error) {
              reject(error);
            }
          }
        }
      });
    });
  },

  async closeBrowser(user) {
    if (this.browsers.has(user)) {
      const browser = this.browsers.get(user);
      fs.readdirSync(settings.downloadDir).forEach((file) => {
        const filePath = path.join(settings.downloadDir, file);
        if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
      });
      await browser.close();
      this.browsers.delete(user);
      console.log("Navegador fechado para o perfil ", user);
    }
  },

  resetCloseTimer(user) {
    if (this.timeoutIds.has(user)) clearTimeout(this.timeoutIds.get(user));
    this.timeoutIds.set(
      user,
      setTimeout(() => this.closeBrowser(user), 5 * 60 * 1000) // 5 minutos
    );
  },

  onPageClose(cookies, page) {
    const browser = this.browsers.get(cookies);
    if (browser) {
      this.resetCloseTimer(cookies);
    }
  },
};

export default PuppeteerManager;
