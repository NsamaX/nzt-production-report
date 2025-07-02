import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const thaiMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const COLORS = {
    production: 'rgba(21, 128, 61, 0.8)',
    forecast: 'rgba(54, 162, 235, 0.8)',
    capacity: 'rgb(255, 99, 132)',
    capacityOT: 'rgb(153, 102, 255)',
    textColor: '#4A4A4A',
    gridColor: 'rgba(200, 200, 200, 0.3)',
    titleColor: '#2C3E50',
    barBorderColor: 'rgba(0, 0, 0, 1)',
};

const sumDailyValues = (dailyArray) => dailyArray?.reduce((sum, entry) => sum + entry.value, 0) || 0;

const getDailyValue = (dailyArray, day) => {
    const entry = dailyArray?.find(d => d.day === day);
    return entry ? entry.value : 0;
};

const getMonthYearLabel = (month, year) => {
    const yearSuffix = String(year).slice(2);
    return `${thaiMonths[month]} ${yearSuffix}`;
};

const getCommonChartOptions = (modelName, maxCapacity, isPdf = false, numLabels = 1, isDailyReport = false) => ({
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

const getChartData = (labels, productionData, forecastData, capacityData, capacityOtData, isDailyReport = false) => {
    const datasets = [];

    const allDataAreZero =
        productionData.every(val => val === 0) &&
        forecastData.every(val => val === 0) &&
        capacityData.every(val => val === 0) &&
        capacityOtData.every(val => val === 0);

    if (allDataAreZero) {
        return {
            labels: labels,
            datasets: []
        };
    }

    if (productionData.some(val => val !== 0)) {
        datasets.push({
            type: 'bar',
            label: 'Production',
            backgroundColor: COLORS.production,
            borderColor: 'transparent',
            borderWidth: 1,
            data: productionData,
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

    if (capacityData.some(val => val !== 0)) {
        datasets.push({
            type: 'line',
            label: 'Capacity',
            borderColor: COLORS.capacity,
            backgroundColor: COLORS.capacity,
            borderWidth: 2,
            fill: false,
            data: capacityData,
            tension: 0.1,
            pointRadius: 1.6,
            pointBackgroundColor: COLORS.capacity,
            order: 1,
        });
    }

    if (capacityOtData.some(val => val !== 0)) {
        datasets.push({
            type: 'line',
            label: 'Capacity + OT',
            borderColor: COLORS.capacityOT,
            backgroundColor: COLORS.capacityOT,
            borderWidth: 2,
            fill: false,
            data: capacityOtData,
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

export const getReport = async (allProductions, selectedMonth, selectedYear) => {
    const tempDiv = document.createElement('div');
    tempDiv.style.width = '210mm';
    tempDiv.style.margin = '20px auto';
    document.body.appendChild(tempDiv);

    const groupedProductionsByPlant = allProductions.reduce((acc, item) => {
        if (!acc[item.plant]) {
            acc[item.plant] = [];
        }
        acc[item.plant].push(item);
        return acc;
    }, {});

    const sortedPlantNames = Object.keys(groupedProductionsByPlant).sort((a, b) => a.localeCompare(b, 'th', { sensitivity: 'base' }));

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();

    const isDailyReport = selectedMonth !== -1;
    const daysInMonth = isDailyReport ? new Date(selectedYear, selectedMonth + 1, 0).getDate() : 0;

    const modelsPerPage = isDailyReport ? 3 : 6;
    const gridColumnCount = isDailyReport ? 1 : 2;
    const chartHeightPdf = '80mm';

    let pageIndex = 0;

    for (const plantName of sortedPlantNames) {
        const plantModels = [];
        groupedProductionsByPlant[plantName].forEach(plantEntry => {
            if (plantEntry.models && Array.isArray(plantEntry.models)) {
                const sortedModels = [...plantEntry.models].sort((a, b) => a.name.localeCompare(b.name));
                plantModels.push(...sortedModels.map(model => ({ model, plant: plantEntry.plant, plantId: plantEntry.id })));
            }
        });

        const plantModelChunks = [];
        for (let i = 0; i < plantModels.length; i += modelsPerPage) {
            plantModelChunks.push(plantModels.slice(i, i + modelsPerPage));
        }

        let firstChunkForPlant = true;
        for (const modelChunk of plantModelChunks) {
            if (pageIndex > 0 || !firstChunkForPlant) {
                pdf.addPage();
            }
            firstChunkForPlant = false;
            pageIndex++;

            let htmlContent = `
                <div style="background-color: #ffffff; color: #333333; padding: 5mm; font-family: 'Inter', sans-serif; width: 210mm; box-sizing: border-box;">
                    <h1 style="font-size: 16px; font-weight: bold; text-align: center; color: #1e40af; margin-bottom: 8px;">
                        Summary Report Production, Forecast, Capacity, and Capacity + OT
                    </h1>
                    <h2 style="font-size: 14px; font-weight: bold; text-align: center; color: #333; margin-top: 5mm; margin-bottom: 5mm;">
                        Plant: ${plantName}
                    </h2>
                    <br />
                    <div style="display: grid; grid-template-columns: repeat(${gridColumnCount}, 1fr); gap: 5mm; width: 100%;">
            `;

            const chartPromises = [];

            for (const { model, plant, plantId } of modelChunk) {
                const safeModelData = (model && Array.isArray(model.data)) ? model.data : [];

                const productionDataForChart = [];
                const forecastDataForChart = [];
                const capacityDataForChart = [];
                const capacityOtDataForChart = [];
                let chartLabels = [];

                let tableHeaders;
                let tableRows = {
                    'Forecast': [],
                    'Capacity': [],
                    'Capacity + OT': [],
                    'Production': []
                };

                if (isDailyReport) {
                    tableHeaders = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                    chartLabels = tableHeaders;

                    const monthlyEntry = safeModelData.find(data =>
                        data.year === selectedYear && data.month === selectedMonth
                    );

                    for (let day = 1; day <= daysInMonth; day++) {
                        const dailyForecast = getDailyValue(monthlyEntry?.data?.Forecast, day);
                        const dailyCapacity = getDailyValue(monthlyEntry?.data?.Capacity, day);
                        const dailyCapacityOT = getDailyValue(monthlyEntry?.data?.["Capacity + OT"], day);
                        const dailyProduction = getDailyValue(monthlyEntry?.data?.Production, day);

                        tableRows['Forecast'].push(dailyForecast);
                        tableRows['Capacity'].push(dailyCapacity);
                        tableRows['Capacity + OT'].push(dailyCapacityOT);
                        tableRows['Production'].push(dailyProduction);

                        productionDataForChart.push(dailyProduction);
                        forecastDataForChart.push(dailyForecast);
                        capacityDataForChart.push(dailyCapacity);
                        capacityOtDataForChart.push(dailyCapacityOT);
                    }

                } else {
                    let monthsToIncludeForModel = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
                    tableHeaders = monthsToIncludeForModel.map(monthNum => getMonthYearLabel(monthNum, selectedYear));
                    chartLabels = tableHeaders;

                    monthsToIncludeForModel.forEach(monthNum => {
                        const monthlyEntry = safeModelData.find(data =>
                            data.year === selectedYear && data.month === monthNum
                        );

                        const monthlyProdSum = monthlyEntry?.data?.Production ? sumDailyValues(monthlyEntry.data.Production) : 0;
                        const monthlyForecastSum = monthlyEntry?.data?.Forecast ? sumDailyValues(monthlyEntry.data.Forecast) : 0;
                        const monthlyCapacitySum = monthlyEntry?.data?.Capacity ? sumDailyValues(monthlyEntry.data.Capacity) : 0;
                        const monthlyCapacityOTSum = monthlyEntry?.data?.["Capacity + OT"] ? sumDailyValues(monthlyEntry.data["Capacity + OT"]) : 0;

                        productionDataForChart.push(monthlyProdSum);
                        forecastDataForChart.push(monthlyForecastSum);
                        capacityDataForChart.push(monthlyCapacitySum);
                        capacityOtDataForChart.push(monthlyCapacityOTSum);

                        tableRows['Forecast'].push(monthlyForecastSum);
                        tableRows['Capacity'].push(monthlyCapacitySum);
                        tableRows['Capacity + OT'].push(monthlyCapacityOTSum);
                        tableRows['Production'].push(monthlyProdSum);
                    });
                }

                const chartConfig = getChartData(
                    chartLabels,
                    productionDataForChart,
                    forecastDataForChart,
                    capacityDataForChart,
                    capacityOtDataForChart,
                    isDailyReport
                );
                const chartOptions = getCommonChartOptions(model.name, model.maxCapacity, true, chartLabels.length, isDailyReport);

                const safeModelName = model.name.replace(/[^a-zA-Z0-9-_]/g, '');
                const chartId = `modelChart-${safeModelName}-${plantId}-${pageIndex}`;

                htmlContent += `
                    <div style="background-color: #ffffff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); border: 1px solid #eee; width: 100%; height: ${chartHeightPdf}; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border-radius: 4px;">
                        <div style="overflow-x: auto; flex-shrink: 0; max-height: ${isDailyReport ? '45mm' : '35mm'};">
                            <table style="min-width: ${isDailyReport ? 'max-content' : '100%'}; border-collapse: collapse; table-layout: ${isDailyReport ? 'fixed' : 'auto'}; width: 100%;">
                                <thead style="background-color: #f0f0f0;">
                                    <tr>
                                        <th style="padding: 2px; text-align: left; font-size: 5px; font-weight: bold; color: #374151; text-transform: uppercase; white-space: nowrap; width: ${isDailyReport ? '30px' : '60px'};">
                                            Status
                                        </th>
                                        ${tableHeaders.map(header => `
                                            <th style="padding: 2px; text-align: center; font-size: 5px; font-weight: bold; color: #374151; white-space: nowrap; width: ${isDailyReport ? '18px' : 'auto'};">
                                                ${header}
                                            </th>
                                        `).join('')}
                                    </tr>
                                </thead>
                                <tbody style="background-color: #ffffff; border-top: 1px solid #e5e7eb;">
                                    ${Object.keys(tableRows).map(rowName => `
                                        <tr>
                                            <td style="padding: 2px; white-space: nowrap; font-size: 5px; font-weight: 500; color: #111827; word-wrap: break-word;">
                                                ${rowName}
                                            </td>
                                            ${tableRows[rowName].map((value, idx) => `
                                                <td key=${idx} style="padding: 2px; white-space: nowrap; font-size: 5px; color: #374151; text-align: center; word-wrap: break-word;">
                                                    ${new Intl.NumberFormat('en-US').format(value)}
                                                </td>
                                            `).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        <h3 style="font-size: 9px; font-weight: bold; text-align: center; margin-top: 2mm; color: #333;">${model.name}</h3>
                        <div style="flex-grow: 1; display: flex; justify-content: center; align-items: center; overflow: hidden;">
                            <canvas id="${chartId}" width="300" height="200" style="max-width: 100%; max-height: 100%; display: block;"></canvas>
                        </div>
                    </div>
                `;
            }

            htmlContent += `</div></div>`;
            tempDiv.innerHTML = htmlContent;

            for (const { model, plant, plantId } of modelChunk) {
                const safeModelName = model.name.replace(/[^a-zA-Z0-9-_]/g, '');
                const chartId = `modelChart-${safeModelName}-${plantId}-${pageIndex}`;
                const canvas = tempDiv.querySelector(`#${chartId}`);

                if (canvas) {
                    const safeModelData = (model && Array.isArray(model.data)) ? model.data : [];

                    const productionDataForChart = [];
                    const forecastDataForChart = [];
                    const capacityDataForChart = [];
                    const capacityOtDataForChart = [];
                    let chartLabels = [];

                    if (isDailyReport) {
                        chartLabels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                        const monthlyEntry = safeModelData.find(data =>
                            data.year === selectedYear && data.month === selectedMonth
                        );
                        for (let day = 1; day <= daysInMonth; day++) {
                            productionDataForChart.push(getDailyValue(monthlyEntry?.data?.Production, day));
                            forecastDataForChart.push(getDailyValue(monthlyEntry?.data?.Forecast, day));
                            capacityDataForChart.push(getDailyValue(monthlyEntry?.data?.Capacity, day));
                            capacityOtDataForChart.push(getDailyValue(monthlyEntry?.data?.["Capacity + OT"], day));
                        }
                    } else {
                        let monthsToIncludeForModel = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
                        chartLabels = monthsToIncludeForModel.map(monthNum => getMonthYearLabel(monthNum, selectedYear));

                        monthsToIncludeForModel.forEach(monthNum => {
                            const monthlyEntry = safeModelData.find(data =>
                                data.year === selectedYear && data.month === monthNum
                            );
                            productionDataForChart.push(monthlyEntry?.data?.Production ? sumDailyValues(monthlyEntry.data.Production) : 0);
                            forecastDataForChart.push(monthlyEntry?.data?.Forecast ? sumDailyValues(monthlyEntry.data.Forecast) : 0);
                            capacityDataForChart.push(monthlyEntry?.data?.Capacity ? sumDailyValues(monthlyEntry.data.Capacity) : 0);
                            capacityOtDataForChart.push(monthlyEntry?.data?.["Capacity + OT"] ? sumDailyValues(monthlyEntry.data["Capacity + OT"]) : 0);
                        });
                    }

                    const chartConfig = getChartData(
                        chartLabels,
                        productionDataForChart,
                        forecastDataForChart,
                        capacityDataForChart,
                        capacityOtDataForChart,
                        isDailyReport
                    );
                    const chartOptions = getCommonChartOptions(model.name, model.maxCapacity, true, chartLabels.length, isDailyReport);

                    chartPromises.push(new Promise((resolveChart) => {
                        try {
                            const existingChart = ChartJS.getChart(canvas);
                            if (existingChart) {
                                existingChart.destroy();
                            }

                            const chartInstance = new ChartJS(canvas, {
                                type: 'bar',
                                data: chartConfig,
                                options: {
                                    ...chartOptions,
                                    animation: {
                                        duration: 0,
                                        onComplete: () => resolveChart(),
                                        onProgress: () => {}
                                    }
                                },
                            });

                            if (chartConfig.datasets.length === 0) {
                                resolveChart();
                            }

                        } catch (chartError) {
                            console.error(`Error initializing Chart.js for model ${model.name}:`, chartError);
                            if (canvas) {
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                    ctx.font = '8px Arial';
                                    ctx.fillStyle = 'red';
                                    ctx.fillText('Chart Error', 10, 50);
                                }
                            }
                            resolveChart();
                        }
                    }));
                }
            }

            await Promise.all(chartPromises);

            await new Promise(resolve => setTimeout(resolve, 500));

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
        const fileNameMonthPart = selectedMonth === -1 ? 'Year' : thaiMonths[selectedMonth];
        pdf.save(`NZT_Production_Report_${fileNameMonthPart}_${selectedYear + 543}.pdf`);
    } catch (error) {
        console.error("Error saving PDF:", error);
    } finally {
        document.body.removeChild(tempDiv);
    }
};
