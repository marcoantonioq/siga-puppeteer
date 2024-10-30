import express from "express";
import { searchSiga } from "../../siga/index.js";

const CACHE_DURATION = 10 * 60 * 1000;

export const app = express();
const processingClients = {};

app.use(express.json({ limit: "1gb" }));

app.post("/siga", async (req, res) => {
  const { date1, date2, filter, cookies, username } = req.body;

  const userCookie = cookies.match(/(?:^|; )user=([^;]*)/);
  const cacheKey = userCookie
    ? `siga.${userCookie[1]}.${date1}.${date2}.${filter}`
    : null;

  if (!cacheKey) {
    return res.status(400).json({ error: "Cookie de usuário não encontrado." });
  }

  try {
    if (!(date1 && date2 && cookies && username)) {
      return res
        .status(400)
        .json({ error: "Configurações ausentes no corpo da requisição." });
    }

    const cachedEntry = processingClients[cacheKey];

    if (cachedEntry) {
      if (Date.now() < cachedEntry.expiration) {
        return res.json(await cachedEntry.promise);
      } else {
        delete processingClients[cacheKey];
      }
    }

    const requestPromise = (async () => {
      const msg = {
        settings: { date1, date2, filter, cookies, betweenDates: [] },
        tables: { igrejas: [], fluxos: [], eventos: [] },
        username,
      };
      const result = await searchSiga(msg);
      return result;
    })();

    processingClients[cacheKey] = {
      promise: requestPromise,
      expiration: Date.now() + CACHE_DURATION,
    };

    const result = await requestPromise;
    res.json(result);
  } catch (error) {
    console.log("Erro ao processar: ", error);
    if (processingClients[cacheKey]) {
      delete processingClients[cacheKey];
    }
    res.status(500).send("Erro ao processar a requisição.");
  }
});
