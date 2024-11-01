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
  };

  let msg = {
    success: false,
    errors: [],
  };

  try {
    const response = UrlFetchApp.fetch(
      "https://node.goias.ifg.edu.br/api/siga",
      options
    );
    msg = JSON.parse(response.getContentText());
    if (msg.success && msg.tables?.igrejas.length) {
      criarTabelasNoGoogleSheets(msg);
    }
    console.log("Dados retornados: ", JSON.stringify(msg, null, 2));
  } catch (error) {
    msg.success = false;
    const message = `Falha ${error}`;
    msg.errors.push(message);
    console.log(message);
  }
  return msg;
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
