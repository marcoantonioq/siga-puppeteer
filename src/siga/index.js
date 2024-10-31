import * as Fluxos from "./Fluxos.js";
import * as Eventos from "./Eventos.js";
import * as Igreja from "./Igrejas.js";
import { betweenDates } from "../util/betweenDates.js";
import fs from "fs";

const restore = (path) => {
  return fs.existsSync(path)
    ? JSON.parse(fs.readFileSync(path, "utf-8"))
    : null;
};

const save = (path, data) => {
  fs.writeFileSync(path, data, "utf-8");
};

export const searchSiga = async (msg) => {
  try {
    msg.settings.betweenDates = betweenDates(
      msg.settings.date1,
      msg.settings.date2
    );

    await Igreja.getIgrejas(msg);
    console.log("Buscar igrejas...");

    const filterRegex = new RegExp(msg.settings.filter, "i");
    const adms = msg.tables.igrejas.filter(
      (e) => e.IGREJA_TIPO === 3 && filterRegex.test(e.IGREJA_DESC)
    );
    console.log("Adms: ", adms);

    for (const adm of adms) {
      await Igreja.alterarIgreja(msg, adm);
      await Fluxos.depositos(msg, adm);
      await Fluxos.coletas(msg, adm);
      await Fluxos.despesas(msg, adm);
      await Eventos.agenda(msg, adm);
    }

    // const secs = msg.tables.igrejas.filter(
    //   (e) => e.IGREJA_TIPO === 11 && filterRegex.test(e.IGREJA_DESC)
    // );
    // for (const sec of secs) {
    //   await Igreja.alterarIgreja(msg, sec);
    //   console.log("Sec: ", sec);
    //   await Fluxos.coletas(msg, sec);
    // }

    save("msg.json", JSON.stringify(msg, null, 2));
    return msg;
  } catch (error) {
    throw new Error("Erro ao processo SIGA: " + error.message);
  }
};
