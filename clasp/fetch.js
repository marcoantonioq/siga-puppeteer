const API_URL = "https://node.goias.ifg.edu.br/api/siga";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("CCB")
    .addItem("📊 SIGA", "showPage")
    .addToUi();
}

function baixarSiga(payload = { username: "." }) {
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    timeout: 250000,
  };

  const msg = { success: false, errors: [] };

  try {
    const response = UrlFetchApp.fetch(
      "https://node.goias.ifg.edu.br/api/siga",
      options
    );

    // Verifica se a resposta HTTP foi bem-sucedida
    if (response.getResponseCode() !== 200) {
      throw new Error(`Erro HTTP: ${response.getResponseCode()}`);
    }

    const parsedResponse = JSON.parse(response.getContentText());

    // Verifica a estrutura da resposta
    if (parsedResponse.success && parsedResponse.tables?.igrejas?.length) {
      criarTabelasNoGoogleSheets(parsedResponse);
    } else {
      msg.errors.push("Dados inválidos ou sem igrejas na resposta.");
    }

    console.log("Dados retornados: ", JSON.stringify(parsedResponse, null, 2));
    return { ...msg, ...parsedResponse };
  } catch (error) {
    handleFetchError(error, msg);
    return msg;
  }
}

function handleFetchError(error, msg) {
  const message = `Falha ao conectar no servidor. Reconectando... \n</br>Erro: ${
    error.message || error
  }`;
  msg.errors.push(message);
  console.error(message); // Usar console.error para registrar erros
}

function criarTabelasNoGoogleSheets(msg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  for (const tableName in msg.tables) {
    const data = msg.tables[tableName];
    const sheet = ss.getSheetByName(tableName) || ss.insertSheet(tableName);
    sheet.clear();

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      const rows = data.map((row) =>
        headers.map((header) =>
          ["DATA", "UPDATED", "CREATED"].includes(header) && row[header]
            ? new Date(row[header])
            : row[header]
        )
      );
      rows.unshift(headers);
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

      headers.forEach((header, i) => {
        if (["DATA", "UPDATED", "CREATED"].includes(header)) {
          sheet
            .getRange(1, i + 1, rows.length - 1)
            .setNumberFormat("dd/MM/yyyy HH:mm");
        }
      });
    }
  }
}

function showPage() {
  const html = HtmlService.createHtmlOutputFromFile("page")
    .setWidth(400)
    .setHeight(600);

  SpreadsheetApp.getUi().showModalDialog(html, "Carregar Dados");
}
