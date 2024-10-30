import * as XLSX from "xlsx";

const isNode = () => typeof process !== "undefined" && process.versions?.node;

export const sheet = {
  async blobBytesToArray(file) {
    return new Promise((resolve, reject) => {
      if (isNode()) {
        try {
          const workbook = XLSX.read(file, { type: "array" });
          const arrayData = XLSX.utils.sheet_to_json(
            workbook.Sheets[workbook.SheetNames[0]],
            { header: 1 }
          );
          resolve(arrayData);
        } catch (error) {
          reject(error);
        }
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const arrayData = XLSX.utils.sheet_to_json(
              workbook.Sheets[workbook.SheetNames[0]],
              { header: 1 }
            );
            resolve(arrayData);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      }
    });
  },
};
