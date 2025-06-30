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
  'มค', 'กพ', 'มีค', 'เมย', 'พค', 'มิย',
  'กค', 'สค', 'กย', 'ตค', 'พย', 'ธค'
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

const getMonthYearLabel = (month, year) => {
  const buddhistYear = year + 543;
  const yearSuffix = String(buddhistYear).slice(2);
  return `${thaiMonths[month]} ${yearSuffix}`;
};

const getCommonChartOptions = (modelName, maxCapacity, isPdf = false) => ({
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
      text: modelName,
      color: COLORS.titleColor,
      font: {
        size: isPdf ? 12 : 16,
        weight: 'bold',
      },
      padding: {
        bottom: isPdf ? 3 : 10,
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
          size: isPdf ? 8 : 12,
          weight: 'bold',
        },
        maxRotation: isPdf ? 45 : 0,
        minRotation: isPdf ? 45 : 0
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
      max: maxCapacity,
    },
  },
});

const getChartData = (labels, productionData, forecastData, capacityData, capacityOtData) => ({
  labels,
  datasets: [
    {
      type: 'bar',
      label: 'Production',
      backgroundColor: COLORS.production,
      borderColor: 'transparent',
      borderWidth: 1,
      data: productionData,
      order: 2,
      barPercentage: 0.8,
      categoryPercentage: 0.8,
    },
    {
      type: 'bar',
      label: 'Forecast',
      backgroundColor: COLORS.forecast,
      borderColor: 'transparent',
      borderWidth: 1,
      data: forecastData,
      order: 2,
      barPercentage: 0.8,
      categoryPercentage: 0.8,
    },
    {
      type: 'line',
      label: 'Capacity',
      borderColor: COLORS.capacity,
      backgroundColor: COLORS.capacity,
      borderWidth: 2,
      fill: false,
      data: capacityData,
      tension: 0.1,
      pointRadius: 3,
      pointBackgroundColor: COLORS.capacity,
      order: 1,
    },
    {
      type: 'line',
      label: 'Capacity + OT',
      borderColor: COLORS.capacityOT,
      backgroundColor: COLORS.capacityOT,
      borderWidth: 2,
      fill: false,
      data: capacityOtData,
      tension: 0.1,
      pointRadius: 3,
      pointBackgroundColor: COLORS.capacityOT,
      order: 1,
    },
  ],
});

const ProductionDataTable = ({ modelName, modelData }) => {
  const tableHeaders = [];
  const tableRows = {
    'Forecast': [],
    'Capacity': [],
    'Capacity + OT': [],
    'Production': []
  };

  const sortedMonthlyData = [...modelData].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  sortedMonthlyData.forEach(monthlyEntry => {
    tableHeaders.push(getMonthYearLabel(monthlyEntry.month, monthlyEntry.year));
    tableRows['Forecast'].push(sumDailyValues(monthlyEntry.data?.Forecast));
    tableRows['Capacity'].push(sumDailyValues(monthlyEntry.data?.Capacity));
    tableRows['Capacity + OT'].push(sumDailyValues(monthlyEntry.data?.["Capacity + OT"]));
    tableRows['Production'].push(sumDailyValues(monthlyEntry.data?.Production));
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
              Status / Month
            </th>
            {tableHeaders.map((header, idx) => (
              <th key={idx} scope="col" className="px-3 py-2 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Object.keys(tableRows).map(rowName => (
            <tr key={rowName}>
              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                {rowName}
              </td>
              {tableRows[rowName].map((value, idx) => (
                <td key={idx} className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 text-center">
                  {new Intl.NumberFormat('en-US').format(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ModelDataVisualization = ({ model }) => {
  const labels = [];
  const productionData = [];
  const forecastData = [];
  const capacityData = [];
  const capacityOtData = [];

  const sortedMonthlyData = [...model.data].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  sortedMonthlyData.forEach(monthlyEntry => {
    labels.push(getMonthYearLabel(monthlyEntry.month, monthlyEntry.year));
    productionData.push(sumDailyValues(monthlyEntry.data?.Production));
    forecastData.push(sumDailyValues(monthlyEntry.data?.Forecast));
    capacityData.push(sumDailyValues(monthlyEntry.data?.Capacity));
    capacityOtData.push(sumDailyValues(monthlyEntry.data?.["Capacity + OT"]));
  });

  const chartConfig = getChartData(labels, productionData, forecastData, capacityData, capacityOtData);
  const chartOptions = getCommonChartOptions(model.name, model.maxCapacity);

  return (
    <div className="bg-white p-2 shadow-lg border-2 border-black w-full sm:w-[calc(100%-1rem)] md:w-[calc(50%-1rem)] lg:w-[calc(33.33%-1rem)] min-w-[300px]">
      <ProductionDataTable modelName={model.name} modelData={model.data} />
      <div className="h-[300px] mt-4">
        <Bar data={chartConfig} options={chartOptions} />
      </div>
    </div>
  );
};

export const generateReportPdf = async (allProductions, selectedMonth, selectedYear) => {
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '210mm';
  document.body.appendChild(tempDiv);

  const filteredAndSortedProductions = allProductions
    .filter(plantEntry =>
      plantEntry.models.some(model =>
        model.data.some(monthlyData =>
          monthlyData.year === selectedYear && monthlyData.month === selectedMonth
        )
      )
    )
    .map(plantEntry => ({
      ...plantEntry,
      models: plantEntry.models.map(model => ({
        ...model,
        data: model.data.filter(monthlyData =>
          monthlyData.year === selectedYear && monthlyData.month === selectedMonth
        )
      })).filter(model => model.data.length > 0)
    })).filter(plantEntry => plantEntry.models.length > 0)
    .sort((a, b) => a.plant.localeCompare(b.plant, 'th', { sensitivity: 'base' }));

  let htmlContent = `
    <div style="background-color: #ffffff; color: #333333; padding: 5mm; font-family: 'Inter', sans-serif;">
      <h1 style="font-size: 20px; font-weight: bold; text-align: center; color: #1e40af; margin-bottom: 10px;">
        สรุปการผลิต Production, Forecast, Capacity, and Capacity + OT
      </h1>
  `;

  if (filteredAndSortedProductions && filteredAndSortedProductions.length > 0) {
    filteredAndSortedProductions.forEach((plantEntry) => {
      htmlContent += `
          <div style="margin-bottom: 15px;">
            <h2 style="font-size: 16px; font-weight: bold; text-align: center; color: #1d4ed8; margin-top: 15px; margin-bottom: 8px;">
              ${plantEntry.plant}
            </h2>
            <div style="display: flex; flex-wrap: wrap; justify-content: space-around; align-items: flex-start; row-gap: 5mm; column-gap: 3mm;">
      `;
      if (plantEntry.models && plantEntry.models.length > 0) {
        plantEntry.models.forEach((model) => {
          if (model.data && model.data.length > 0) {
            const monthlyEntry = model.data[0];
            if (!monthlyEntry) return;

            const labels = [getMonthYearLabel(monthlyEntry.month, monthlyEntry.year)];
            const productionData = [sumDailyValues(monthlyEntry.data?.Production)];
            const forecastData = [sumDailyValues(monthlyEntry.data?.Forecast)];
            const capacityData = [sumDailyValues(monthlyEntry.data?.Capacity)];
            const capacityOtData = [sumDailyValues(monthlyEntry.data?.["Capacity + OT"])];

            const chartConfig = getChartData(labels, productionData, forecastData, capacityData, capacityOtData);
            const chartOptions = getCommonChartOptions(model.name, model.maxCapacity, true);

            const tableHeaders = [getMonthYearLabel(monthlyEntry.month, monthlyEntry.year)];
            const tableRows = {
              'Forecast': [sumDailyValues(monthlyEntry.data?.Forecast)],
              'Capacity': [sumDailyValues(monthlyEntry.data?.Capacity)],
              'Capacity + OT': [sumDailyValues(monthlyEntry.data?.["Capacity + OT"])],
              'Production': [sumDailyValues(monthlyEntry.data?.Production)]
            };

            const safeModelName = model.name.replace(/[^a-zA-Z0-9-_]/g, '');
            const chartId = `modelChart-${safeModelName}`;

            htmlContent += `
                <div style="background-color: #ffffff; padding: 3px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); border: 1px solid #eee; width: 63mm; height: 90mm; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border-radius: 4px;">
                  <div style="overflow-x: auto; flex-shrink: 0; max-height: 40mm;">
                    <table style="min-width: 100%; border-collapse: collapse;">
                      <thead style="background-color: #f0f0f0;">
                        <tr>
                          <th style="padding: 3px; text-align: left; font-size: 8px; font-weight: bold; color: #374151; text-transform: uppercase;">
                            Status / Month
                          </th>
                          ${tableHeaders.map(header => `
                            <th style="padding: 3px; text-align: center; font-size: 8px; font-weight: bold; color: #374151; text-transform: uppercase;">
                              ${header}
                            </th>
                          `).join('')}
                        </tr>
                      </thead>
                      <tbody style="background-color: #ffffff; border-top: 1px solid #e5e7eb;">
                        ${Object.keys(tableRows).map(rowName => `
                          <tr>
                            <td style="padding: 3px; white-space: nowrap; font-size: 8px; font-weight: 500; color: #111827;">
                              ${rowName}
                            </td>
                            ${tableRows?.[rowName]?.map((value, idx) => `
                              <td key={idx} style="padding: 3px; white-space: nowrap; font-size: 8px; color: #374151; text-align: center;">
                                ${new Intl.NumberFormat('en-US').format(value)}
                              </td>
                            `).join('')}
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                  <div style="flex-grow: 1; margin-top: 2px; display: flex; justify-content: center; align-items: center; overflow: hidden;">
                    <canvas id="${chartId}" width="360" height="240" style="max-width: 100%; max-height: 100%;"></canvas>
                  </div>
                </div>
            `;
          }
        });
      } else {
        htmlContent += `<p style="color: #6b7280; font-size: 12px; text-align: center; width: 100%;">ไม่มีข้อมูลรุ่นสำหรับสายการผลิตนี้</p>`;
      }
      htmlContent += `</div></div>`;
    });
  } else {
    htmlContent += `<p style="color: #6b7280; font-size: 14px; text-align: center;">ไม่มีข้อมูลการผลิตที่จะแสดงแผนภูมิสำหรับเดือนที่เลือก</p>`;
  }
  htmlContent += `</div>`;

  tempDiv.innerHTML = htmlContent;

  filteredAndSortedProductions.forEach(plantEntry => {
    plantEntry.models.forEach(model => {
      if (model.data && model.data.length > 0) {
        const safeModelName = model.name.replace(/[^a-zA-Z0-9-_]/g, '');
        const chartId = `modelChart-${safeModelName}`;
        const canvas = tempDiv.querySelector(`#${chartId}`);
        if (canvas) {
          const monthlyEntry = model.data[0];
          if (!monthlyEntry) return;

          const labels = [getMonthYearLabel(monthlyEntry.month, monthlyEntry.year)];
          const productionData = [sumDailyValues(monthlyEntry.data?.Production)];
          const forecastData = [sumDailyValues(monthlyEntry.data?.Forecast)];
          const capacityData = [sumDailyValues(monthlyEntry.data?.Capacity)];
          const capacityOtData = [sumDailyValues(monthlyEntry.data?.["Capacity + OT"])];

          const chartConfig = getChartData(labels, productionData, forecastData, capacityData, capacityOtData);
          const chartOptions = getCommonChartOptions(model.name, model.maxCapacity, true);

          try {
            new ChartJS(canvas, {
              type: 'bar',
              data: chartConfig,
              options: chartOptions,
            });
          } catch (chartError) {
            console.error(`Error initializing Chart.js for model ${model.name}:`, chartError);
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.font = '10px Arial';
                ctx.fillStyle = 'red';
                ctx.fillText('Chart Error', 10, 50);
              }
            }
          }
        }
      }
    });
  });

  await new Promise(resolve => setTimeout(resolve, 1500));

  const pdf = new jsPDF('p', 'mm', 'a4');

  try {
    const canvas = await html2canvas(tempDiv, {
      scale: 3,
      useCORS: true,
      windowWidth: tempDiv.scrollWidth,
      windowHeight: tempDiv.scrollHeight,
      devicePixelRatio: window.devicePixelRatio * 2,
    });
    const imgData = canvas.toDataURL('image/png');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let currentY = 0;
    pdf.addImage(imgData, 'PNG', 0, currentY, imgWidth, imgHeight);

    let remainingHeight = imgHeight;
    while (remainingHeight > pdfHeight) {
      pdf.addPage();
      currentY -= pdfHeight;
      remainingHeight -= pdfHeight;
      pdf.addImage(imgData, 'PNG', 0, currentY, imgWidth, imgHeight);
    }

    pdf.save(`รายงานการผลิต_${thaiMonths[selectedMonth]}_${selectedYear + 543}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
  } finally {
    document.body.removeChild(tempDiv);
  }
};

function Report({ allProductions, selectedMonth, selectedYear }) {
  const filteredAndSortedProductions = allProductions
    .filter(plantEntry =>
      plantEntry.models.some(model =>
        model.data.some(monthlyData =>
          monthlyData.year === selectedYear && monthlyData.month === selectedMonth
        )
      )
    )
    .map(plantEntry => ({
      ...plantEntry,
      models: plantEntry.models.map(model => ({
        ...model,
        data: model.data.filter(monthlyData =>
          monthlyData.year === selectedYear && monthlyData.month === selectedMonth
        )
      })).filter(model => model.data.length > 0)
    })).filter(plantEntry => plantEntry.models.length > 0)
    .sort((a, b) => a.plant.localeCompare(b.plant, 'th', { sensitivity: 'base' }));

  return (
    <div className="min-h-screen bg-white text-gray-800 p-2 flex flex-col items-center padding lg:p-4">
      <h1 className="text-xl font-extrabold text-center text-blue-800 mb-4 mt-2">
        สรุปการผลิต Production, Forecast, Capacity, and Capacity + OT
      </h1>
      {filteredAndSortedProductions && filteredAndSortedProductions.length > 0 ? (
        filteredAndSortedProductions.map((plantEntry, plantIndex) => (
          <div key={plantIndex} className="w-full mb-8">
            <h2 className="text-2xl font-bold text-center text-blue-700 my-6">
              {plantEntry.plant}
            </h2>
            <div className="flex flex-wrap justify-center gap-4 w-full">
              {plantEntry.models && plantEntry.models.length > 0 ? (
                plantEntry.models.map((model, modelIndex) => (
                  model.data && model.data.length > 0 && (
                    <ModelDataVisualization key={modelIndex} model={model} />
                  )
                ))
              ) : (
                <p className="text-gray-600 text-base">
                  ไม่มีข้อมูลรุ่นสำหรับสายการผลิตนี้
                </p>
              )}
            </div>
          </div>
        ))
      ) : (
        <p className="text-gray-600 text-base">ไม่มีข้อมูลการผลิตที่จะแสดงแผนภูมิสำหรับเดือนที่เลือก</p>
      )}
    </div>
  );
}

export default Report;
