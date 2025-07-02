import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const sumDaily = (array) => array?.reduce((sum, { value }) => sum + value, 0) || 0;

const getDayValue = (array, day) => array?.find(d => d.day === day)?.value || 0;

const createHeaders = (isDaily, monthDays, months) => {
    return isDaily
        ? Array.from({ length: monthDays }, (_, i) => i + 1)
        : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(m => months[m]);
};

const processModelData = (modelData, year, month, isDaily, monthDays) => {
    const rows = {
        Forecast: [],
        Capacity: [],
        'Capacity + OT': [],
        Production: []
    };

    if (isDaily) {
        const entry = modelData.find(d => d.year === year && d.month === month);
        for (let day = 1; day <= monthDays; day++) {
            rows.Forecast.push(getDayValue(entry?.data?.Forecast, day));
            rows.Capacity.push(getDayValue(entry?.data?.Capacity, day));
            rows['Capacity + OT'].push(getDayValue(entry?.data?.['Capacity + OT'], day));
            rows.Production.push(getDayValue(entry?.data?.Production, day));
        }
    } else {
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach(m => {
            const entry = modelData.find(d => d.year === year && d.month === m);
            rows.Forecast.push(entry?.data?.Forecast ? sumDaily(entry.data.Forecast) : 0);
            rows.Capacity.push(entry?.data?.Capacity ? sumDaily(entry.data.Capacity) : 0);
            rows['Capacity + OT'].push(entry?.data?.['Capacity + OT'] ? sumDaily(entry.data['Capacity + OT']) : 0);
            rows.Production.push(entry?.data?.Production ? sumDaily(entry.data.Production) : 0);
        });
    }

    return rows;
};

export const exportExcel = (productions, month, year) => {
    const workbook = XLSX.utils.book_new();
    const isDaily = month !== -1;
    const monthDays = isDaily ? new Date(year, month + 1, 0).getDate() : 0;

    const plantGroups = productions.reduce((acc, { plant, models, id }) => {
        acc[plant] = acc[plant] || [];
        acc[plant].push({ plant, models, id });
        return acc;
    }, {});

    const plantNames = Object.keys(plantGroups).sort((a, b) => a.localeCompare(b, 'th', { sensitivity: 'base' }));

    for (const plantName of plantNames) {
        const models = plantGroups[plantName]
            .flatMap(({ models }) => Array.isArray(models) ? models.sort((a, b) => a.name.localeCompare(b.name)) : [])
            .map(model => ({ model, plant: plantName }));

        const data = [];
        let row = 0;

        const headers = createHeaders(isDaily, monthDays, months);

        data.push([isDaily ? 'STATUS/DAY' : 'STATUS/MONTH', ...headers]);
        row++;

        const merges = [];

        for (const { model } of models) {
            const startRow = row;
            const modelData = Array.isArray(model.data) ? model.data : [];

            data.push([`Model: ${model.name}`, ''], ['', '']);
            row += 2;

            merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow + 1, c: headers.length } });

            const rows = processModelData(modelData, year, month, isDaily, monthDays);

            Object.entries(rows).forEach(([rowName, values]) => {
                data.push([rowName, ...values]);
                row++;
            });
        }

        const worksheet = XLSX.utils.aoa_to_sheet(data);

        worksheet['!cols'] = [{ wpx: 100 }];
        worksheet['!merges'] = merges;

        XLSX.utils.book_append_sheet(workbook, worksheet, plantName);
    }

    const monthPart = month === -1 ? 'Year' : months[month];
    const name = `NZT_Production_Report_${monthPart}_${year + 543}.xlsx`;

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });

    saveAs(blob, name);
};
