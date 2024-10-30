import * as XLSX from "xlsx";

export const sheetToArray = async (fileBuffer) => {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1 });
};

export const excelDateToJSDate = (excelDate) => {
  return new Date(1899, 11, 30).getTime() + excelDate * 86400000;
};
