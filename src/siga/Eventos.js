import PuppeteerManager from "./PuppeteerManager.js";

export class Evento {
  constructor({
    EVENTO = "",
    GRUPO = "",
    DATA = "",
    IGREJA = "",
    OBSERVACOES = "",
    STATUS = "",
    ID = "",
  }) {
    Object.assign(this, {
      EVENTO,
      GRUPO,
      DATA,
      IGREJA,
      OBSERVACOES,
      STATUS,
      ID,
    });
    this.CREATED = this.UPDATED = new Date();
  }

  static create(options) {
    return new Evento(options);
  }
}

export const agenda = async (msg = {}, adm) => {
  const page = await PuppeteerManager.createPage({
    cookies: msg.settings.cookies,
    domain: "siga.congregacao.org.br",
  });
  try {
    await page.goto("https://siga.congregacao.org.br/REL/REL01701.aspx");

    const eventos = await page.evaluate(
      async (msg, adm) => {
        const eventos = [];

        try {
          const response = await fetch(
            "https://siga.congregacao.org.br/REL/REL01701.asmx/SelecionarVW",
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json; charset=UTF-8",
                Cookie: msg.settings.cookies,
                __antixsrftoken:
                  msg.settings.cookies.match(/__AntiXsrfToken=([^;]+)/i)?.[1] ||
                  "",
              },
              body: JSON.stringify({
                codigoTipoEvento: null,
                codigoEmpresa: adm.UNIDADE_COD,
                codigoEstabelecimento: null,
                data1: msg.settings.date1.split("-").reverse().join("/"),
                data2: msg.settings.date2.split("-").reverse().join("/"),
                listaStatus: "4,3",
                config: {
                  sEcho: 1,
                  iDisplayStart: 0,
                  iDisplayLength: 1000,
                  sSearch: "",
                  iSortCol: 0,
                  sSortDir: "asc",
                },
              }),
            }
          );

          const data = await response.json();
          if (data?.d?.aaData && response.ok) {
            data.d.aaData.forEach(
              ([DATA, SEMANA, HORA, GRUPO, IGREJA, , STATUS, ID]) => {
                eventos.push({
                  EVENTO: "Secretaria",
                  GRUPO,
                  DATA: new Date(
                    `${DATA.split("/").reverse().join("-")} ${HORA.split(
                      "-"
                    )[0].trim()}:00-03:00`
                  ).toISOString(),
                  IGREJA,
                  OBSERVAÇÕES: `${SEMANA}: ${HORA}`,
                  STATUS: STATUS.replace(/<\/?[^>]+>/gi, ""),
                  ID,
                });
              }
            );
          }
        } catch (erro) {
          console.warn("Erro ao obter Eventos: ", erro);
        }

        return eventos;
      },
      msg,
      adm
    );

    eventos.forEach((e) => {
      msg.tables.eventos.push(Evento.create(e));
    });
    return eventos;
  } catch (error) {
    console.log("Erro ao processar coletas: ", error);
    throw new Error(error.msssage);
  } finally {
    await page.close();
  }
};
