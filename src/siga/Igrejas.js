import PuppeteerManager from "./PuppeteerManager.js";
import { sleep } from "../util/sleep.js";

export class Igreja {
  constructor(options = {}) {
    Object.assign(this, {
      IGREJA: "",
      IGREJA_COD: 0,
      IGREJA_DESC: "",
      IGREJA_TIPO: 0,
      IGREJA_ADM: "",
      REGIONAL: "",
      CATEGORIA: "",
      UNIDADE_COD: 0,
      MEMBROS: 0,
      CREATED: new Date(),
      UPDATED: new Date(),
      ...options,
    });
  }

  static create(options) {
    return new Igreja(options);
  }
}

export const getIgrejas = async (msg = {}) => {
  const page = await PuppeteerManager.createPage({
    cookies: msg.settings.cookies,
    domain: "siga.congregacao.org.br",
  });

  try {
    await page.goto("https://siga.congregacao.org.br/SIS/SIS99908.aspx", {
      waitUntil: "networkidle0",
    });

    // Prezada(o) Irmã(o) o sistema está temporariamente em manutenção.
    const emManutencao = await page.evaluate(() =>
      document
        .querySelector(".col-md-10")
        ?.innerText.includes("temporariamente em manutenção.")
    );
    if (emManutencao) throw new Error("O sistema está em manutenção.");

    // Username
    msg.username = await page.evaluate(() => {
      return document
        .getElementById("f_autoid_001")
        ?.value?.replace(/\r?\n|\r/g, "")
        ?.trim();
    });
    if (!msg.username) throw new Error(`Usuário não identificado.`);
    console.log("Usuário logado: ", msg.username);

    // Coletar igrejas
    await page.evaluate(() => {
      [...document.querySelectorAll("a.showModal")]
        .find((el) => el.textContent.includes("Mudar Local"))
        ?.click();
    });

    await page.waitForSelector(
      'form[action="../SIS/SIS99906.aspx"] select[name="f_empresa"]',
      {
        timeout: 5000,
      }
    );

    const options = await page.evaluate(async () => {
      return [...document.querySelectorAll("optgroup")].flatMap((optgroup) => {
        const regional = optgroup.label;
        return [...optgroup.querySelectorAll("option")].map((option) => {
          const selectElement = option.closest("select");
          return {
            id: selectElement
              ? selectElement.id.replace(/f_([a-z]+)_?.*/gi, "$1")
              : null,
            cod: option.value,
            text: option.textContent.trim(),
            regional: regional,
          };
        });
      });
    });

    const empresas = options.filter((e) => e.id === "empresa" && e.cod);

    const results = await Promise.all(
      empresas.map(async (empresa) => {
        const igrejas = await page.evaluate(
          async (msg, empresa) => {
            try {
              const igrejasCompetencias = await fetch(
                "https://siga.congregacao.org.br/CTB/CompetenciaWS.asmx/SelecionarCompetencias",
                {
                  method: "POST",
                  credentials: "include",
                  headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    __antixsrftoken:
                      msg.settings.cookies.match(
                        /__AntiXsrfToken=([^;]+)/i
                      )?.[1] || "",
                  },
                  body: JSON.stringify({ codigoEmpresa: empresa.cod }),
                }
              );
              const { d: competencias } = await igrejasCompetencias.json();
              const COMPETENCIA = competencias.find((e) => e.Ativo).Codigo;

              const igrejasAcessos = await fetch(
                "https://siga.congregacao.org.br/REL/EstabelecimentoWS.asmx/SelecionarParaAcesso",
                {
                  method: "POST",
                  credentials: "include",
                  headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    __antixsrftoken:
                      msg.settings.cookies.match(
                        /__AntiXsrfToken=([^;]+)/i
                      )?.[1] || "",
                  },
                  body: JSON.stringify({ codigoEmpresa: empresa.cod }),
                }
              );
              const { d: dadosIgrejas } = await igrejasAcessos.json();
              return dadosIgrejas.map((e) => ({
                IGREJA: e.Nome,
                IGREJA_COD: e.Codigo,
                IGREJA_DESC: e.NomeExibicao,
                IGREJA_TIPO: e.CodigoTipoEstabelecimento,
                IGREJA_ADM: empresa.text,
                REGIONAL: empresa.regional,
                UNIDADE_COD: e.CodigoEmpresa,
                MEMBROS: 0,
                COMPETENCIA,
              }));
            } catch (error) {
              console.error("Erro ao SelecionarParaAcesso", error);
            }
          },
          msg,
          empresa
        );

        return igrejas;
      })
    );

    const flatResults = results.flatMap((e) => e).map((e) => Igreja.create(e));

    msg.tables.igrejas = flatResults;
    return flatResults;
  } catch (error) {
    throw new Error(error.message);
  } finally {
    await page.close();
  }
};

export const alterarIgreja = async (msg = {}, adm) => {
  const page = await PuppeteerManager.createPage({
    cookies: msg.settings.cookies,
    domain: "siga.congregacao.org.br",
  });

  try {
    await page.goto("https://siga.congregacao.org.br/SIS/SIS99908.aspx", {
      waitUntil: "networkidle0",
    });

    await page.evaluate(() => {
      [...document.querySelectorAll("a.showModal")]
        .find((el) => el.textContent.includes("Mudar Local"))
        ?.click();
    });

    await page.waitForSelector(
      'form[action="../SIS/SIS99906.aspx"] select[name="f_empresa"]',
      {
        timeout: 5000,
      }
    );

    async function pressTab(page, count, delay = 20) {
      for (let i = 0; i < count; i++) {
        await page.keyboard.press("Tab", { delay });
      }
    }

    await sleep(1000);
    await pressTab(page, 3);
    await page.keyboard.type(adm.IGREJA_ADM, { delay: 10 });
    await page.keyboard.press("Enter", { delay: 50 });
    await pressTab(page, 1);
    await page.keyboard.type(adm.IGREJA_DESC, { delay: 10 });
    await page.keyboard.press("Enter", { delay: 50 });
    await sleep(200);
    await page.click(
      'form[action="../SIS/SIS99906.aspx"] button[type="submit"]'
    );
    await page.close();
    return true;
  } catch (error) {
    console.error("Erro durante a execução: " + error);
    throw error;
  }
};
