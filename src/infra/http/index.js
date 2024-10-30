import express from "express";
import { searchSiga } from "../../siga/index.js";

export const app = express();
const processingClients = new Map();

app.use(express.json({ limit: "1gb" }));

app.post("/siga", async (req, res) => {
  const { date1, date2, filter, cookies, username } = req.body;

  if (!(date1 && date2 && cookies && username)) {
    return res
      .status(400)
      .json({ error: "Configurações ausentes no corpo da requisição" });
  }

  if (processingClients.has(username)) {
    try {
      const result = await processingClients.get(username);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const requestPromise = (async () => {
    const msg = {
      settings: { date1, date2, filter, cookies, betweenDates: [] },
      tables: { igrejas: [], fluxos: [], eventos: [] },
      username,
    };
    return await searchSiga(msg);
  })();

  processingClients.set(username, requestPromise);

  try {
    const result = await requestPromise;
    res.json(result);
  } catch (error) {
    console.log("Erro ao processar: ", error);
    res.status(500).send("Erro ao processar a requisição");
  } finally {
    processingClients.delete(username);
  }
});
