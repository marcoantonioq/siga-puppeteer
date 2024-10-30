import { excelDateToJSDate } from "../util/sheet.js";
import PuppeteerManager from "./PuppeteerManager.js";

export const coletas = async (msg = {}) => {
  try {
    for (const { start, end, ref } of msg.settings.betweenDates) {
      const page = await PuppeteerManager.createPage({
        cookies: msg.settings.cookies,
        domain: "siga.congregacao.org.br",
      });

      await page.goto("https://siga.congregacao.org.br/TES/TES00501.aspx", {
        waitUntil: "networkidle0",
      });
      console.log("Coletas: ", start, end, ref);

      try {
        const onValues = PuppeteerManager.listenerDownload({ page });
        try {
          await Promise.all([
            page.evaluate(
              (start, end) => {
                document.querySelector("#f_data1").value = start
                  .split("-")
                  .reverse()
                  .join("/");
                document.querySelector("#f_data2").value = end
                  .split("-")
                  .reverse()
                  .join("/");
              },
              start,
              end
            ),
            page.select("#f_detalhar", "true"),
            page.select("#f_saidapara_original", "Excel"),
          ]);

          await page.waitForSelector(
            'form[action="TES00501.aspx"] button[type="submit"]',
            { visible: true }
          );
          await page.click(
            'form[action="TES00501.aspx"] button[type="submit"]'
          );

          const values = await onValues;
          if (!values) return;
          var nomeIgreja = "",
            headers = "",
            tipo = "";

          for (var i = 0; i < values.length; i++) {
            if (/^Total/.test(values[i][0])) {
              nomeIgreja = "";
              continue;
            } else if (/^Todos/.test(values[i][0])) {
              break;
            } else if (/^Casa de Oração/.test(`${values[i][0]}`)) {
              headers = values[i];
            } else if (/^(SET|BR|ADM)/.test(values[i][0])) {
              nomeIgreja = values[i][0];
            }

            if (/^Tipo/.test(values[i][6])) {
              continue;
            } else if (/[a-z]/i.test(values[i][6])) {
              tipo = values[i][6];

              for (let x = 7; x < headers.length; x++) {
                if (headers[x] === "Total") break;
                if (!headers[x] || !/^[1-9]/.test(values[i][x])) continue;

                msg.tables.fluxos.push({
                  FLUXO: "Coleta",
                  IGREJA: nomeIgreja,
                  IGREJA_DESC: nomeIgreja,
                  CATEGORIA: tipo,
                  DATA: end,
                  VALOR: values[i][x],
                  OBSERVACOES: headers[x],
                  REF: ref,
                  ORIGEM: "SIGA",
                });
              }
            }
          }
        } catch (error) {
          console.error("Erro ao navegar por coletas: ", error);
        }
      } catch (error) {
        console.warn("Erro ao processar arquivo de coleta: ", error);
      } finally {
        page.close();
      }
    }
  } catch (error) {
    console.log("Erro ao processar coletas: ", error);
  }
};

export const despesas = async (msg = {}) => {
  try {
    for (const { start, end, ref } of msg.settings.betweenDates) {
      const page = await PuppeteerManager.createPage({
        cookies: msg.settings.cookies,
        domain: "siga.congregacao.org.br",
      });
      console.log("Despensa: ", start, end, ref);
      await page.goto("https://siga.congregacao.org.br/TES/TES00901.aspx", {
        waitUntil: "networkidle0",
      });
      const onValues = PuppeteerManager.listenerDownload({ page });

      try {
        await Promise.all([
          page.evaluate(
            (start, end) => {
              document.querySelector("#f_data1").value = start
                .split("-")
                .reverse()
                .join("/");
              document.querySelector("#f_data2").value = end
                .split("-")
                .reverse()
                .join("/");
            },
            start,
            end
          ),
          page.select("#f_saidapara", "Excel"),
          page.select("#f_agrupar", "CentrodeCustoSetor"),
          page.click('form[action="TES00902.aspx"] button[type="submit"]'),
        ]);

        const values = await onValues;
        if (!values) return;
        let Localidade = "",
          Ref = "";
        values.forEach((row) => {
          try {
            if (Array.isArray(row) && row.length) {
              if (/^Mês \d\d\/\d+/.test(`${row[0]}`)) {
                const [, mm, yyyy] = row[0].match(/(\d{2})\/(\d{4})/);
                Ref = `${mm}/${yyyy}`;
              } else if (
                /^(BR \d+-\d+|^ADM|^PIA|^SET)/.test(`${row[0]}`) ||
                row.length === 1
              ) {
                Localidade = row[0];
              } else if (/^\d+$/.test(`${row[0]}`)) {
                msg.tables.fluxos.push({
                  FLUXO: "Saída",
                  IGREJA: Localidade,
                  IGREJA_DESC: Localidade,
                  CATEGORIA: row[6],
                  DATA: new Date(
                    new Date(1899, 11, 30).getTime() + row[0] * 86400000
                  ),
                  VALOR: row[30] || 0,
                  OBSERVACOES: `${row[8]}, NF: ${row[4]}; ${row[3]}; Valor: ${row[15]}; Multa: ${row[21]}; Juros: ${row[24]}; Desconto: ${row[27]}`,
                  REF: ref,
                  ORIGEM: "SIGA",
                });
              }
            }
          } catch (error) {
            console.warn("Falha ao procurar em linhas de despesas: ", error);
          }
        });
      } catch (error) {
        console.error("Erro ao navegar por despesas: ", error);
      } finally {
        page.close();
      }
    }
  } catch (error) {
    console.log("Erro ao processar despesas: ", error);
  }
};

export const depositos = async (msg = {}) => {
  try {
    const pageComp = await PuppeteerManager.createPage({
      cookies: msg.settings.cookies,
      domain: "siga.congregacao.org.br",
    });
    await pageComp.goto("https://siga.congregacao.org.br/TES/TES00701.aspx", {
      waitUntil: "networkidle0",
    });
    const competencias = await pageComp.evaluate(() => {
      return [...document.querySelector('select[id="f_competencia"]')]
        .map((option) => ({
          label: option.innerText,
          value: option.value,
        }))
        .filter((e) => e.value);
    });
    pageComp.close();

    for (const { ref } of msg.settings.betweenDates) {
      console.log("Depositos: ", ref);
      const page = await PuppeteerManager.createPage({
        cookies: msg.settings.cookies,
        domain: "siga.congregacao.org.br",
      });
      const onValues = PuppeteerManager.listenerDownload({ page });
      try {
        const competencia = competencias.find((e) => ref === e.label);
        if (competencia) {
          await page.goto("https://siga.congregacao.org.br/TES/TES00701.aspx", {
            waitUntil: "networkidle0",
          });

          await Promise.all([
            page.select('select[id="f_competencia"]', competencia.value),
            page.select("#f_saidapara", "Excel"),
          ]);

          await page.click(
            'form[action="TES00702.aspx"] button[type="submit"]'
          );

          const values = await onValues;
          if (!values) return;
          var igrejaNome = "";

          for (var i = 0; i < values.length; i++) {
            try {
              if (/^(SET|ADM|BR|PIA)/.test(`${values[i][0]}`)) {
                igrejaNome = values[i][0];
              } else if (/^\d\d\/\d{4}/.test(values[i][2])) {
                msg.tables.fluxos.push({
                  FLUXO: "Deposito",
                  IGREJA: igrejaNome,
                  IGREJA_DESC: igrejaNome,
                  DATA: new Date(excelDateToJSDate(values[i][3])),
                  VALOR: values[i][18],
                  OBSERVAÇÕES: values[i][7],
                  REF: ref,
                  ORIGEM: "SIGA",
                });
              }
            } catch (error) {
              console.log("Erro ao processar despesa: ", error);
            }
          }
        }
      } catch (error) {
        console.log("Erro ao coletar deposito: ", error);
      } finally {
        page.close();
      }
    }
  } catch (error) {
    console.error("Erro ao navegar por depositos: ", error);
  }
};
