import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const MONTH_NAMES_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const sumValues = (arr) => arr?.reduce((sum, { value }) => sum + value, 0) || 0;

const getDayVal = (arr, day) => arr?.find(d => d.day === day)?.value || 0;

const createSheetHeaders = (isDaily, daysInMonth, monthsArr) => {
    return isDaily
        ? Array.from({ length: daysInMonth }, (_, i) => i + 1)
        : Array.from({ length: 12 }, (_, i) => monthsArr[i]);
};

const processModelDataForSheet = (modelData, year, month, isDaily, daysInMonth) => {
    const rows = {
        Forecast: [],
        Capacity: [],
        'Capacity + OT': [],
        Production: []
    };

    if (isDaily) {
        const entry = modelData.find(d => d.year === year && d.month === month);
        for (let day = 1; day <= daysInMonth; day++) {
            rows.Forecast.push(getDayVal(entry?.data?.Forecast, day));
            rows.Capacity.push(getDayVal(entry?.data?.Capacity, day));
            rows['Capacity + OT'].push(getDayVal(entry?.data?.['Capacity + OT'], day));
            rows.Production.push(getDayVal(entry?.data?.Production, day));
        }
    } else {
        Array.from({ length: 12 }, (_, m) => {
            const entry = modelData.find(d => d.year === year && d.month === m);
            rows.Forecast.push(entry?.data?.Forecast ? sumValues(entry.data.Forecast) : 0);
            rows.Capacity.push(entry?.data?.Capacity ? sumValues(entry.data.Capacity) : 0);
            rows['Capacity + OT'].push(entry?.data?.['Capacity + OT'] ? sumValues(entry.data['Capacity + OT']) : 0);
            rows.Production.push(entry?.data?.Production ? sumValues(entry.data.Production) : 0);
        });
    }

    return rows;
};

export const exportExcel = async (productions, month, year) => {
    const workbook = new ExcelJS.Workbook();
    const isDaily = month !== -1;
    const daysInMonth = isDaily ? new Date(year, month + 1, 0).getDate() : 0;

    const groupedPlants = productions.reduce((acc, { plant, models }) => {
        acc[plant] = acc[plant] || [];
        acc[plant].push({ plant, models });
        return acc;
    }, {});

    const plantNames = Object.keys(groupedPlants).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const borderStyle = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };

    const headerFillColor = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8DB4E2' }
    };

    for (const plantName of plantNames) {
        const worksheet = workbook.addWorksheet(plantName);

        const models = groupedPlants[plantName]
            .flatMap(({ models }) => Array.isArray(models) ? models.sort((a, b) => a.name.localeCompare(b.name)) : [])
            .map(model => ({ model, plant: plantName }));

        let currentRowIndex = 1;

        const headers = createSheetHeaders(isDaily, daysInMonth, MONTH_NAMES_SHORT);

        const headerRow = worksheet.addRow([isDaily ? 'STATUS/DAY' : 'STATUS/MONTH', ...headers]);
        headerRow.font = { bold: true };
        headerRow.height = 30;
        headerRow.alignment = {
            vertical: 'middle',
            horizontal: 'center'
        };

        headerRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = headerFillColor;
            cell.border = borderStyle;
        });

        currentRowIndex++;

        worksheet.getColumn(1).width = 18;

        for (let i = 2; i <= headers.length + 1; i++) {
            worksheet.getColumn(i).width = 10;
        }

        for (const { model } of models) {
            const modelNameRowStart = currentRowIndex;
            const modelNameRowEnd = currentRowIndex + 1;

            const modelTitleRow = worksheet.addRow([`Model: ${model.name}`]);
            modelTitleRow.eachCell({ includeEmpty: true }, (cell) => {
                cell.border = borderStyle;
            });
            currentRowIndex++;

            const emptyRowForMerge = worksheet.addRow([]);
            emptyRowForMerge.eachCell({ includeEmpty: true }, (cell) => {
                cell.border = borderStyle;
            });
            currentRowIndex++;

            worksheet.mergeCells(modelNameRowStart, 1, modelNameRowEnd, headers.length + 1);

            const mergedCell = worksheet.getCell(modelNameRowStart, 1);

            mergedCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'C5D9F1' }
            };
            mergedCell.font = { bold: true };
            mergedCell.alignment = {
                vertical: 'middle',
                horizontal: 'center'
            };
            mergedCell.border = borderStyle;


            const modelData = Array.isArray(model.data) ? model.data : [];
            const rows = processModelDataForSheet(modelData, year, month, isDaily, daysInMonth);

            Object.entries(rows).forEach(([rowName, values]) => {
                const dataRow = worksheet.addRow([rowName, ...values]);
                dataRow.eachCell({ includeEmpty: true }, (cell) => {
                    cell.border = borderStyle;
                });
                currentRowIndex++;
            });
        }
    }

    const monthPart = month === -1 ? 'Year' : MONTH_NAMES_SHORT[month];
    const fileName = `NZT_Production_Report_${monthPart}_${year}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(blob, fileName);
};
