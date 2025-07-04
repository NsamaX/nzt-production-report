import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Chart from 'chart.js/auto';

const MONTH_NAMES_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const COLORS = {
    production: '#C6E0B3',
    forecast: '#4574C4',
    capacity: '#F07730',
    capacityOT: '#FABC02',
    textColor: '#4A4A4A',
    gridColor: 'rgba(200, 200, 200, 0.3)',
    titleColor: '#2C3E50',
    barBorderColor: 'rgba(0, 0, 0, 1)',
};

const sumValues = (dailyArray) => dailyArray?.reduce((sum, entry) => sum + entry.value, 0) || 0;
const getDayVal = (dailyArray, day) => {
    const entry = dailyArray?.find(d => d.day === day);
    return entry ? entry.value : 0;
};
const getMonYearLabel = (month, year) => {
    const yearSuffix = String(year).slice(2);
    return `${MONTH_NAMES_SHORT[month]} ${yearSuffix}`;
};

const getChartDatasets = (labels, prodData, forecastData, capData, capOtData) => {
    const datasets = [];

    const allDataAreZero =
        prodData.every(val => val === 0) &&
        forecastData.every(val => val === 0) &&
        capData.every(val => val === 0) &&
        capOtData.every(val => val === 0);

    if (allDataAreZero) {
        return {
            labels: labels,
            datasets: []
        };
    }

    if (prodData.some(val => val !== 0)) {
        datasets.push({
            type: 'bar',
            label: 'Production',
            backgroundColor: COLORS.production,
            borderColor: 'transparent',
            borderWidth: 1,
            data: prodData,
            order: 2,
            barPercentage: 0.8,
            categoryPercentage: 0.8,
        });
    }

    if (forecastData.some(val => val !== 0)) {
        datasets.push({
            type: 'bar',
            label: 'Forecast',
            backgroundColor: COLORS.forecast,
            borderColor: 'transparent',
            borderWidth: 1,
            data: forecastData,
            order: 2,
            barPercentage: 0.8,
            categoryPercentage: 0.8,
        });
    }

    if (capData.some(val => val !== 0)) {
        datasets.push({
            type: 'line',
            label: 'Capacity',
            borderColor: COLORS.capacity,
            backgroundColor: COLORS.capacity,
            borderWidth: 2,
            fill: false,
            data: capData,
            tension: 0.1,
            pointRadius: 1.6,
            pointBackgroundColor: COLORS.capacity,
            order: 1,
        });
    }

    if (capOtData.some(val => val !== 0)) {
        datasets.push({
            type: 'line',
            label: 'Capacity + OT',
            borderColor: COLORS.capacityOT,
            backgroundColor: COLORS.capacityOT,
            borderWidth: 2,
            fill: false,
            data: capOtData,
            tension: 0.1,
            pointRadius: 1.6,
            pointBackgroundColor: COLORS.capacityOT,
            order: 1,
        });
    }

    return {
        labels,
        datasets,
    };
};

const getChartOpts = (modelName, maxCapacity, isPdf = false, numLabels = 1, isDailyReport = false) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                color: COLORS.textColor,
                font: {
                    size: isPdf ? 8 : 12,
                },
                boxWidth: isPdf ? 8 : 40,
            },
        },
        title: {
            display: true,
            color: COLORS.titleColor,
            font: {
                size: isPdf ? 12 : 16,
                weight: 'bold',
            },
            padding: {
                top: isPdf ? 5 : 10,
                bottom: isPdf ? 10 : 20,
            }
        },
        tooltip: {
            callbacks: {
                label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed.y !== null) {
                        label += new Intl.NumberFormat('en-US').format(context.parsed.y);
                    }
                    return label;
                }
            },
            bodyFont: {
                size: isPdf ? 10 : 12
            },
            titleFont: {
                size: isPdf ? 10 : 12
            }
        }
    },
    devicePixelRatio: isPdf ? 2 : undefined,
    scales: {
        x: {
            grid: {
                display: false,
            },
            ticks: {
                color: COLORS.titleColor,
                font: {
                    size: isPdf ? (isDailyReport ? (numLabels > 20 ? 5 : 6) : (numLabels > 6 ? 6 : 8)) : 12,
                    weight: 'bold',
                },
                maxRotation: isPdf ? (isDailyReport ? 90 : (numLabels > 6 ? 90 : 45)) : 0,
                minRotation: isPdf ? (isDailyReport ? 90 : (numLabels > 6 ? 90 : 45)) : 0
            },
        },
        y: {
            beginAtZero: true,
            grid: {
                color: COLORS.gridColor,
                drawOnChartArea: true,
            },
            ticks: {
                color: COLORS.textColor,
                callback: function(value) {
                    return new Intl.NumberFormat('en-US').format(value);
                },
                font: {
                    size: isPdf ? 8 : 10,
                },
            },
            max: maxCapacity > 0 ? maxCapacity : undefined,
        },
    },
});

export const getReport = async (allProds, selectedMonth, selectedYear) => {
    const tempDiv = document.createElement('div');
    tempDiv.style.width = '210mm';
    tempDiv.style.margin = '20px auto';
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    const prodsByPlant = allProds.reduce((acc, item) => {
        if (!acc[item.plant]) {
            acc[item.plant] = [];
        }
        acc[item.plant].push(item);
        return acc;
    }, {});

    const sortedPlants = Object.keys(prodsByPlant).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();

    const isDailyReport = selectedMonth !== -1;
    const daysInMonth = isDailyReport ? new Date(selectedYear, selectedMonth + 1, 0).getDate() : 0;

    const modelsPerPage = isDailyReport ? 3 : 6;
    const gridColumnCount = isDailyReport ? 1 : 2;
    const chartHeightPdf = '80mm';

    let pageIdx = 0;

    for (const plant of sortedPlants) {
        const plantModList = [];
        prodsByPlant[plant].forEach(plantEntry => {
            if (plantEntry.models && Array.isArray(plantEntry.models)) {
                const sortedModels = [...plantEntry.models].sort((a, b) => a.name.localeCompare(b.name));
                plantModList.push(...sortedModels.map(model => ({ model, plant: plantEntry.plant, plantId: plantEntry.id })));
            }
        });

        const modelChunks = [];
        for (let i = 0; i < plantModList.length; i += modelsPerPage) {
            modelChunks.push(plantModList.slice(i, i + modelsPerPage));
        }

        let isFirstChunk = true;
        for (const chunk of modelChunks) {
            if (pageIdx > 0 || !isFirstChunk) {
                pdf.addPage();
            }
            isFirstChunk = false;
            pageIdx++;

            let htmlContent = `
                <div style="background-color: #ffffff; color: #333333; padding: 5mm; font-family: 'Inter', sans-serif; width: 210mm; box-sizing: border-box;">
                    <h1 style="font-size: 16px; font-weight: bold; text-align: center; color: #1e40af; margin-bottom: 8px;">
                        Summary Report Production, Forecast, Capacity, and Capacity + OT
                    </h1>
                    <h2 style="font-size: 14px; font-weight: bold; text-align: center; color: #333; margin-top: 5mm; margin-bottom: 5mm;">
                        Plant: ${plant}
                    </h2>
                    <br />
                    <div style="display: grid; grid-template-columns: repeat(${gridColumnCount}, 1fr); gap: 5mm; width: 100%;">
            `;

            const chartCanvases = [];

            for (const [index, { model, plantId }] of chunk.entries()) {
                const modelData = (model && Array.isArray(model.data)) ? model.data : [];

                const prodData = [];
                const forecastData = [];
                const capData = [];
                const capOtData = [];
                let labels = [];

                let tableHdrs;
                let tableRowsData = {
                    'Forecast': [],
                    'Capacity': [],
                    'Capacity + OT': [],
                    'Production': []
                };

                if (isDailyReport) {
                    tableHdrs = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                    labels = tableHdrs;

                    const monthlyEnt = modelData.find(data =>
                        data.year === selectedYear && data.month === selectedMonth
                    );

                    for (let day = 1; day <= daysInMonth; day++) {
                        const dailyForecastVal = getDayVal(monthlyEnt?.data?.Forecast, day);
                        const dailyCapVal = getDayVal(monthlyEnt?.data?.Capacity, day);
                        const dailyCapOtVal = getDayVal(monthlyEnt?.data?.["Capacity + OT"], day);
                        const dailyProdVal = getDayVal(monthlyEnt?.data?.Production, day);

                        tableRowsData['Forecast'].push(dailyForecastVal);
                        tableRowsData['Capacity'].push(dailyCapVal);
                        tableRowsData['Capacity + OT'].push(dailyCapOtVal);
                        tableRowsData['Production'].push(dailyProdVal);

                        prodData.push(dailyProdVal);
                        forecastData.push(dailyForecastVal);
                        capData.push(dailyCapVal);
                        capOtData.push(dailyCapOtVal);
                    }
                } else {
                    let monthsForChart = Array.from({ length: 12 }, (_, i) => i);
                    tableHdrs = monthsForChart.map(monthNum => getMonYearLabel(monthNum, selectedYear));
                    labels = tableHdrs;

                    monthsForChart.forEach(monthNum => {
                        const monthlyEnt = modelData.find(data =>
                            data.year === selectedYear && data.month === monthNum
                        );

                        const monthlyProdSumVal = monthlyEnt?.data?.Production ? sumValues(monthlyEnt.data.Production) : 0;
                        const monthlyForecastSumVal = monthlyEnt?.data?.Forecast ? sumValues(monthlyEnt.data.Forecast) : 0;
                        const monthlyCapSumVal = monthlyEnt?.data?.Capacity ? sumValues(monthlyEnt.data.Capacity) : 0;
                        const monthlyCapOtSumVal = monthlyEnt?.data?.["Capacity + OT"] ? sumValues(monthlyEnt.data["Capacity + OT"]) : 0;

                        prodData.push(monthlyProdSumVal);
                        forecastData.push(monthlyForecastSumVal);
                        capData.push(monthlyCapSumVal);
                        capOtData.push(monthlyCapOtSumVal);

                        tableRowsData['Forecast'].push(monthlyForecastSumVal);
                        tableRowsData['Capacity'].push(monthlyCapSumVal);
                        tableRowsData['Capacity + OT'].push(monthlyCapOtSumVal);
                        tableRowsData['Production'].push(monthlyProdSumVal);
                    });
                }

                const chartCfg = getChartDatasets(
                    labels,
                    prodData,
                    forecastData,
                    capData,
                    capOtData
                );
                const chartOpts = getChartOpts(model.name, model.maxCapacity, true, labels.length, isDailyReport);

                const sanitizedPlantId = plantId.replace(/[^a-zA-Z0-9]/g, '_');
                const sanitizedModelName = model.name.replace(/[^a-zA-Z0-9]/g, '_');
                const canvasId = `chart-${sanitizedPlantId}-${sanitizedModelName}-${pageIdx}-${index}`;

                htmlContent += `
                    <div style="background-color: #ffffff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); border: 1px solid #eee; width: 100%; height: ${chartHeightPdf}; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border-radius: 4px;">
                        <div style="overflow-x: auto; flex-shrink: 0; max-height: ${isDailyReport ? '45mm' : '35mm'};">
                            <table style="min-width: ${isDailyReport ? 'max-content' : '100%'}; border-collapse: collapse; table-layout: ${isDailyReport ? 'fixed' : 'auto'}; width: 100%;">
                                <thead style="background-color: #f0f0f0;">
                                    <tr>
                                        <th style="padding: 2px; text-align: left; font-size: 5px; font-weight: bold; color: #374151; text-transform: uppercase; white-space: nowrap; width: ${isDailyReport ? '30px' : '20px'};">
                                            Status
                                        </th>
                                        ${tableHdrs.map(header => `
                                            <th style="padding: 2px; text-align: center; font-size: 5px; font-weight: bold; color: #374151; white-space: nowrap; width: ${isDailyReport ? '18px' : 'auto'};">
                                                ${header}
                                            </th>
                                        `).join('')}
                                    </tr>
                                </thead>
                                <tbody style="background-color: #ffffff; border-top: 1px solid #e5e7eb;">
                                    ${Object.keys(tableRowsData).map(rowName => `
                                        <tr>
                                            <td style="padding: 2px; white-space: nowrap; font-size: 5px; font-weight: 500; color: #111827; word-wrap: break-word;">
                                                ${rowName}
                                            </td>
                                            ${tableRowsData[rowName].map((value, idx) => `
                                                <td key=${idx} style="padding: 2px; white-space: nowrap; font-size: 5px; color: #374151; text-align: center; word-wrap: break-word;">
                                                    ${new Intl.NumberFormat('en-US').format(value)}
                                                </td>
                                            `).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        <h3 style="font-size: 9px; font-weight: bold; text-align: center; margin: 4mm 0 2mm; color: #333;">${model.name}</h3> <!-- Adjusted margin -->
                        <div style="flex-grow: 1; display: flex; justify-content: center; align-items: center; overflow: hidden;">
                            <canvas id="${canvasId}" style="width: 100%; height: 100%;"></canvas>
                        </div>
                    </div>
                `;

                chartCanvases.push({ canvasId, chartCfg, chartOpts });
            }

            htmlContent += `</div></div>`;
            tempDiv.innerHTML = htmlContent;

            await new Promise(resolve => setTimeout(resolve, 100));

            for (const { canvasId, chartCfg, chartOpts } of chartCanvases) {
                const canvas = tempDiv.querySelector(`#${canvasId}`);
                if (canvas) {
                    chartOpts.plugins.title.text = '';
                    new Chart(canvas, {
                        type: 'bar',
                        data: chartCfg,
                        options: chartOpts
                    });
                } else {
                    console.error(`Canvas with ID #${canvasId} not found`);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
                const canvas = await html2canvas(tempDiv, {
                    scale: 3,
                    useCORS: true,
                    windowWidth: tempDiv.scrollWidth,
                    windowHeight: tempDiv.scrollHeight,
                    logging: false,
                    backgroundColor: '#ffffff'
                });
                const imgData = canvas.toDataURL('image/png');

                const imgWidth = pageWidth;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

            } catch (error) {
                console.error("Error generating PDF page:", error);
            }
        }
    }

    try {
        const fileMonPart = selectedMonth === -1 ? 'Year' : MONTH_NAMES_SHORT[selectedMonth];
        pdf.save(`NZT_Production_Report_${fileMonPart}_${selectedYear}.pdf`);
    } catch (error) {
        console.error("Error saving PDF:", error);
    } finally {
        tempDiv.innerHTML = '';
        document.body.removeChild(tempDiv);
    }
};
