import { app } from "./infra/http/index.js";

app.listen(3000, () =>
  console.log(`Servidor rodando em http://localhost:3000`)
);
