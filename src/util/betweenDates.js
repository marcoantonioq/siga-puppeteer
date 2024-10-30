export function betweenDates(dataInicial, dataFinal) {
  const resultado = [];
  const start = new Date(dataInicial);
  const end = new Date(dataFinal);

  // Começa com o primeiro dia do mês da data inicial
  let data = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  while (data <= end) {
    const primeiroDia = new Date(data); // Primeiro dia do mês atual
    const ultimoDia = new Date(
      Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0)
    ); // Último dia do mês atual

    resultado.push({
      start: primeiroDia.toISOString().split("T")[0],
      end: ultimoDia.toISOString().split("T")[0],
      ref: primeiroDia
        .toISOString()
        .replace(/(\d\d\d\d)-(\d\d)-\d\d.*/, "$2/$1"),
    });

    // Avança para o próximo mês
    data.setUTCMonth(data.getUTCMonth() + 1);
  }

  return resultado;
}
