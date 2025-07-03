import * as XLSX from 'xlsx';
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

export const exportExcel = (productions, month, year) => {
    const workbook = XLSX.utils.book_new();
    const isDaily = month !== -1;
    const daysInMonth = isDaily ? new Date(year, month + 1, 0).getDate() : 0;

    const groupedPlants = productions.reduce((acc, { plant, models }) => {
        acc[plant] = acc[plant] || [];
        acc[plant].push({ plant, models });
        return acc;
    }, {});

    const plantNames = Object.keys(groupedPlants).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    for (const plantName of plantNames) {
        const models = groupedPlants[plantName]
            .flatMap(({ models }) => Array.isArray(models) ? models.sort((a, b) => a.name.localeCompare(b.name)) : [])
            .map(model => ({ model, plant: plantName }));

        const sheetData = [];
        let currentRow = 0;

        const headers = createSheetHeaders(isDaily, daysInMonth, MONTH_NAMES_SHORT);

        sheetData.push([isDaily ? 'STATUS/DAY' : 'STATUS/MONTH', ...headers]);
        currentRow++;

        const merges = [];

        for (const { model } of models) {
            const startRow = currentRow;
            const modelData = Array.isArray(model.data) ? model.data : [];

            sheetData.push([`Model: ${model.name}`, ''], ['', '']);
            currentRow += 2;

            merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow + 1, c: headers.length } });

            const rows = processModelDataForSheet(modelData, year, month, isDaily, daysInMonth);

            Object.entries(rows).forEach(([rowName, values]) => {
                sheetData.push([rowName, ...values]);
                currentRow++;
            });
        }

        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

        worksheet['!cols'] = [{ wpx: 100 }];
        worksheet['!merges'] = merges;

        XLSX.utils.book_append_sheet(workbook, worksheet, plantName);
    }

    const monthPart = month === -1 ? 'Year' : MONTH_NAMES_SHORT[month];
    const fileName = `NZT_Production_Report_${monthPart}_${year}.xlsx`;

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });

    saveAs(blob, fileName);
};
