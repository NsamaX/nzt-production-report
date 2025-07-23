import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { productionConfig } from '../config/production';
import { MONTH, DAY } from '../config/date_constant';

// Utility Functions
const sumValues = (arr) => arr?.reduce((sum, { value }) => sum + value, 0) || 0;

const getDayVal = (arr, day) => arr?.find((d) => d.day === day)?.value || 0;

const createSheetHeaders = (isDaily, year, month, daysInMonth, monthsArr, dayNamesArr) => {
  if (isDaily) {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dayOfMonth = i + 1;
      const date = new Date(year, month, dayOfMonth);
      const dayName = dayNamesArr[date.getDay()];
      return `${dayName} ${dayOfMonth}`;
    });
  }
  return monthsArr;
};

const processModelDataForSheet = (modelData, year, month, isDaily, daysInMonth) => {
  const rows = {};
  productionConfig.statusRows.forEach((status) => {
    rows[status.name] = [];
  });

  if (isDaily) {
    const entry = modelData.find((d) => d.year === year && d.month === month);
    for (let day = 1; day <= daysInMonth; day++) {
      productionConfig.statusRows.forEach((status) => {
        rows[status.name].push(getDayVal(entry?.data?.[status.name], day));
      });
    }
  } else {
    Array.from({ length: 12 }, (_, m) => {
      const entry = modelData.find((d) => d.year === year && d.month === m);
      productionConfig.statusRows.forEach((status) => {
        rows[status.name].push(entry?.data?.[status.name] ? sumValues(entry.data[status.name]) : 0);
      });
    });
  }

  return rows;
};

// Main Export Function
export const exportExcel = async (productions, month, year) => {
  const workbook = new ExcelJS.Workbook();
  const isDaily = month !== -1;
  const daysInMonth = isDaily ? new Date(year, month + 1, 0).getDate() : 0;

  // Group productions by plant
  const groupedPlants = productions.reduce((acc, { plant, models }) => {
    acc[plant] = acc[plant] || [];
    acc[plant].push({ plant, models });
    return acc;
  }, {});

  const plantNames = Object.keys(groupedPlants).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  // Styles
  const borderStyle = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  const headerFillColor = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF8DB4E2' },
  };

  const modelTitleFillColor = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'C5D9F1' },
  };

  // Process each plant
  for (const plantName of plantNames) {
    const worksheet = workbook.addWorksheet(plantName);

    // Prepare models
    const models = groupedPlants[plantName]
      .flatMap(({ models }) =>
        Array.isArray(models)
          ? models.sort((a, b) => a.name.localeCompare(b.name))
          : []
      )
      .map((model) => ({ model, plant: plantName }));

    let currentRowIndex = 1;

    // Add headers
    const headers = createSheetHeaders(isDaily, year, month, daysInMonth, MONTH.abbreviated, DAY);
    const headerRow = worksheet.addRow([isDaily ? 'STATUS/DAY' : 'STATUS/MONTH', ...headers]);
    headerRow.font = { bold: true };
    headerRow.height = 30;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = headerFillColor;
      cell.border = borderStyle;
    });
    currentRowIndex++;

    // Set column widths
    worksheet.getColumn(1).width = 18;
    for (let i = 2; i <= headers.length + 1; i++) {
      worksheet.getColumn(i).width = 10;
    }

    // Process each model
    for (const { model } of models) {
      const modelNameRowStart = currentRowIndex;
      const modelNameRowEnd = currentRowIndex + 1;

      // Add model title
      const modelTitleRow = worksheet.addRow([`Model: ${model.name}`]);
      modelTitleRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = borderStyle;
      });
      currentRowIndex++;

      // Add empty row for merge
      const emptyRowForMerge = worksheet.addRow([]);
      emptyRowForMerge.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = borderStyle;
      });
      currentRowIndex++;

      // Merge cells for model title
      worksheet.mergeCells(modelNameRowStart, 1, modelNameRowEnd, headers.length + 1);
      const mergedCell = worksheet.getCell(modelNameRowStart, 1);
      mergedCell.fill = modelTitleFillColor;
      mergedCell.font = { bold: true };
      mergedCell.alignment = { vertical: 'middle', horizontal: 'center' };
      mergedCell.border = borderStyle;

      // Process model data
      const modelData = Array.isArray(model.data) ? model.data : [];
      const rows = processModelDataForSheet(modelData, year, month, isDaily, daysInMonth);

      // Add data rows
      productionConfig.statusRows.forEach((status) => {
        const dataRow = worksheet.addRow([status.name, ...rows[status.name]]);
        dataRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = borderStyle;
        });
        currentRowIndex++;
      });
    }
  }

  // Save workbook
  const monthPart = month === -1 ? 'Year' : MONTH.abbreviated[month];
  const fileName = `NZT_Production_Report_${monthPart}_${year}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });
  saveAs(blob, fileName);
};
