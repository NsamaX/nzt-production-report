import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Chart from 'chart.js/auto';
import { productionConfig } from '../config/production';
import { MONTH, DAY } from '../config/date_constant';

// Utility Functions
const sumValues = (dailyArray) =>
  dailyArray?.reduce((sum, entry) => sum + entry.value, 0) || 0;

const getLastNonZeroValue = (dailyArray) => {
  if (!dailyArray || !Array.isArray(dailyArray)) return 0;
  const lastNonZero = dailyArray
    .filter(
      (entry) => entry.value !== 0 && entry.value !== null && entry.value !== undefined
    )
    .sort((a, b) => b.day - a.day)[0];
  return lastNonZero ? lastNonZero.value : 0;
};

const getDayVal = (dailyArray, day) => {
  const entry = dailyArray?.find((d) => d.day === day);
  return entry ? entry.value : 0;
};

const getMonYearLabel = (month, year) => {
  const yearSuffix = String(year).slice(2);
  return `${MONTH.abbreviated[month]} ${yearSuffix}`;
};

const getDayLabel = (year, month, day) => {
  const date = new Date(year, month, day);
  const dayName = DAY[date.getDay()];
  return `${dayName} ${day}`;
};

const getChartDatasets = (labels, statusData) => {
  const datasets = [];
  const allDataAreZero = Object.values(statusData).every((data) =>
    data.every((val) => val === 0)
  );

  if (allDataAreZero) {
    return { labels, datasets: [] };
  }

  productionConfig.statusRows.forEach((status) => {
    const data = statusData[status.name];
    if (data.some((val) => val !== 0)) {
      datasets.push({
        type: status.chartType,
        label: status.name,
        backgroundColor: status.color,
        borderColor: status.chartType === 'line' ? status.color : 'transparent',
        borderWidth: status.chartType === 'line' ? 2 : 1,
        data,
        order: status.order,
        barPercentage: status.barPercentage,
        categoryPercentage: status.categoryPercentage,
        fill: status.chartType === 'line' ? false : undefined,
        tension: status.tension || undefined,
        pointRadius: status.pointRadius || undefined,
        pointBackgroundColor: status.chartType === 'line' ? status.color : undefined,
      });
    }
  });

  return { labels, datasets };
};

const getChartOpts = (maxCapacity, isPdf = false, numLabels = 1, isDailyReport = false) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#4A4A4A',
        font: { size: isPdf ? 8 : 12 },
        boxWidth: isPdf ? 8 : 40,
      },
    },
    title: {
      display: true,
      color: '#2C3E50',
      font: {
        size: isPdf ? 12 : 16,
        weight: 'bold',
      },
      padding: {
        top: isPdf ? 5 : 10,
        bottom: isPdf ? 10 : 20,
      },
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          let label = context.dataset.label || '';
          if (label) label += ': ';
          if (context.parsed.y !== null) {
            label += new Intl.NumberFormat('en-US').format(context.parsed.y);
          }
          return label;
        },
      },
      bodyFont: { size: isPdf ? 10 : 12 },
      titleFont: { size: isPdf ? 10 : 12 },
    },
  },
  devicePixelRatio: isPdf ? 2 : undefined,
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        color: '#2C3E50',
        font: {
          size: isPdf
            ? isDailyReport
              ? numLabels > 20
                ? 5
                : 6
              : numLabels > 6
                ? 6
                : 8
            : 12,
          weight: 'bold',
        },
        maxRotation: isPdf ? (isDailyReport ? 90 : numLabels > 6 ? 90 : 45) : 0,
        minRotation: isPdf ? (isDailyReport ? 90 : numLabels > 6 ? 90 : 45) : 0,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(200, 200, 200, 0.3)',
        drawOnChartArea: true,
      },
      ticks: {
        color: '#4A4A4A',
        callback: (value) => new Intl.NumberFormat('en-US').format(value),
        font: { size: isPdf ? 8 : 10 },
      },
      max: maxCapacity > 0 ? maxCapacity : undefined,
    },
  },
});

// Main Export Function
export const getReport = async (allProds, selectedMonth, selectedYear) => {
  // Create temporary div for rendering charts
  const tempDiv = document.createElement('div');
  tempDiv.style.width = '210mm';
  tempDiv.style.margin = '20px auto';
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  document.body.appendChild(tempDiv);

  // Group productions by plant
  const prodsByPlant = allProds.reduce((acc, item) => {
    acc[item.plant] = acc[item.plant] || [];
    acc[item.plant].push(item);
    return acc;
  }, {});

  const sortedPlants = Object.keys(prodsByPlant).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  // Initialize PDF
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const isDailyReport = selectedMonth !== -1;
  const daysInMonth = isDailyReport ? new Date(selectedYear, selectedMonth + 1, 0).getDate() : 0;
  const modelsPerPage = isDailyReport ? 3 : 6;
  const gridColumnCount = isDailyReport ? 1 : 2;
  const chartHeightPdf = '80mm';

  let pageIdx = 0;

  // Process each plant
  for (const plant of sortedPlants) {
    // Prepare models
    const plantModList = prodsByPlant[plant]
      .flatMap((plantEntry) =>
        plantEntry.models && Array.isArray(plantEntry.models)
          ? [...plantEntry.models]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((model) => ({ model, plant: plantEntry.plant, plantId: plantEntry.id }))
          : []
      );

    // Split models into chunks
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

      // Build HTML content for the page
      let htmlContent = `
        <div style="background-color: #ffffff; color: #333333; padding: 5mm; font-family: 'Inter', sans-serif; width: 210mm; box-sizing: border-box;">
          <h1 style="font-size: 16px; font-weight: bold; text-align: center; color: #1e40af; margin-bottom: 8px;">
            Plant: ${plant}
          </h1>
          <br />
          <div style="display: grid; grid-template-columns: repeat(${gridColumnCount}, 1fr); gap: 5mm; width: 100%;">
      `;

      const chartCanvases = [];

      // Process each model in the chunk
      for (const [index, { model, plantId }] of chunk.entries()) {
        const modelData = Array.isArray(model.data) ? model.data : [];
        let labels = [];
        let tableHdrs = [];
        let tableRowsData = {};
        let statusData = {};

        productionConfig.statusRows.forEach((status) => {
          tableRowsData[status.name] = [];
          statusData[status.name] = [];
        });

        if (isDailyReport) {
          tableHdrs = Array.from({ length: daysInMonth }, (_, i) =>
            getDayLabel(selectedYear, selectedMonth, i + 1)
          );
          labels = tableHdrs;

          const monthlyEnt = modelData.find(
            (data) => data.year === selectedYear && data.month === selectedMonth
          );

          for (let day = 1; day <= daysInMonth; day++) {
            productionConfig.statusRows.forEach((status) => {
              const dailyVal = getDayVal(monthlyEnt?.data?.[status.name], day);
              tableRowsData[status.name].push(dailyVal);
              statusData[status.name].push(dailyVal);
            });
          }
        } else {
          const monthsForChart = Array.from({ length: 12 }, (_, i) => i);
          tableHdrs = monthsForChart.map((monthNum) =>
            getMonYearLabel(monthNum, selectedYear)
          );
          labels = tableHdrs;

          monthsForChart.forEach((monthNum) => {
            const monthlyEnt = modelData.find(
              (data) => data.year === selectedYear && data.month === monthNum
            );
            productionConfig.statusRows.forEach((status) => {
              const value = monthlyEnt?.data?.[status.name]
                ? sumValues(monthlyEnt.data[status.name])
                : 0;
              tableRowsData[status.name].push(value);
              statusData[status.name].push(value);
            });
          });
        }

        const chartCfg = getChartDatasets(labels, statusData);
        const chartOpts = getChartOpts(model.maxCapacity, true, labels.length, isDailyReport);
        const sanitizedPlantId = plantId.replace(/[^a-zA-Z0-9]/g, '_');
        const sanitizedModelName = model.name.replace(/[^a-zA-Z0-9]/g, '_');
        const canvasId = `chart-${sanitizedPlantId}-${sanitizedModelName}-${pageIdx}-${index}`;

        // Add chart and table HTML
        htmlContent += `
          <div style="background-color: #ffffff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); border: 1px solid #eee; width: 100%; height: ${chartHeightPdf}; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border-radius: 4px;">
            <div style="overflow-x: auto; flex-shrink: 0; max-height: ${isDailyReport ? '45mm' : '35mm'};">
              <table style="min-width: ${isDailyReport ? 'max-content' : '100%'}; border-collapse: collapse; table-layout: ${isDailyReport ? 'fixed' : 'auto'}; width: 100%;">
                <thead style="background-color: #f0f0f0;">
                  <tr>
                    <th style="padding: 2px; text-align: left; font-size: 5px; font-weight: bold; color: #374151; text-transform: uppercase; white-space: nowrap; width: ${isDailyReport ? '30px' : '20px'};">
                      Status
                    </th>
                    ${tableHdrs
                      .map(
                        (header) => `
                      <th style="padding: 2px; text-align: center; font-size: 5px; font-weight: bold; color: #374151; white-space: nowrap; width: ${isDailyReport ? '18px' : 'auto'};">
                        ${header}
                      </th>
                    `
                      )
                      .join('')}
                  </tr>
                </thead>
                <tbody style="background-color: #ffffff; border-top: 1px solid #e5e7eb;">
                  ${Object.keys(tableRowsData)
                    .map(
                      (rowName) => `
                    <tr>
                      <td style="padding: 2px; white-space: nowrap; font-size: 5px; font-weight: 500; color: #111827; word-wrap: break-word;">
                        ${rowName}
                      </td>
                      ${tableRowsData[rowName]
                        .map(
                          (value, idx) => `
                        <td key=${idx} style="padding: 2px; white-space: nowrap; font-size: 5px; color: #374151; text-align: center; word-wrap: break-word;">
                          ${new Intl.NumberFormat('en-US').format(value)}
                        </td>
                      `
                        )
                        .join('')}
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
            <h3 style="font-size: 9px; font-weight: bold; text-align: center; margin: 4mm 0 2mm; color: #333;">
              ${model.name}
            </h3>
            <div style="flex-grow: 1; display: flex; justify-content: center; align-items: center; overflow: hidden;">
              <canvas id="${canvasId}" style="width: 100%; height: 100%;"></canvas>
            </div>
          </div>
        `;

        chartCanvases.push({ canvasId, chartCfg, chartOpts });
      }

      htmlContent += `</div></div>`;
      tempDiv.innerHTML = htmlContent;

      // Wait for DOM to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Render charts
      for (const { canvasId, chartCfg, chartOpts } of chartCanvases) {
        const canvas = tempDiv.querySelector(`#${canvasId}`);
        if (canvas) {
          chartOpts.plugins.title.text = '';
          new Chart(canvas, {
            type: 'bar',
            data: chartCfg,
            options: chartOpts,
          });
        } else {
          console.error(`Canvas with ID #${canvasId} not found`);
        }
      }

      // Wait for charts to render
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Convert to PDF
      try {
        const canvas = await html2canvas(tempDiv, {
          scale: 3,
          useCORS: true,
          windowWidth: tempDiv.scrollWidth,
          windowHeight: tempDiv.scrollHeight,
          logging: false,
          backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      } catch (error) {
        console.error('Error generating PDF page:', error);
      }
    }
  }

  // Save PDF
  try {
    const fileMonPart = selectedMonth === -1 ? 'Year' : MONTH.abbreviated[selectedMonth];
    pdf.save(`NZT_Production_Report_${fileMonPart}_${selectedYear}.pdf`);
  } catch (error) {
    console.error('Error saving PDF:', error);
  } finally {
    tempDiv.innerHTML = '';
    document.body.removeChild(tempDiv);
  }
};
