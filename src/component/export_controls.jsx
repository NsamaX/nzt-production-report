import React from 'react';
import { getReport } from './get_report';
import { exportExcel } from './export_excel';
import { MONTH } from '../config/date_constant';

// ExportControls Component
function ExportControls({
  productions,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  availableDates,
  reportLoading,
  setReportLoading,
  excelLoading,
  setExcelLoading,
  canAccessReport,
  canAccessExcel,
  canAccessPlan,
  onNavigate,
}) {
  const hasProdData = productions.length > 0;

  // Handlers
  const handleReportExport = async () => {
    if (!hasProdData) {
      console.warn('No production data to generate a report.');
      alert('No production data to generate a report. Please add production data first.');
      return;
    }

    setReportLoading(true);
    try {
      const prodsForReport = productions
        .map((prodItem) => {
          const newProdItem = JSON.parse(JSON.stringify(prodItem));
          if (newProdItem.models && Array.isArray(newProdItem.models)) {
            newProdItem.models = newProdItem.models.map((model) => {
              const safeModelData = Array.isArray(model?.data) ? model.data : [];
              let filteredMonthlyData = safeModelData.filter((d) => d.year === selectedYear);
              
              if (selectedMonth !== -1) {
                filteredMonthlyData = filteredMonthlyData.filter((d) => d.month === selectedMonth);
              }
              return { ...model, data: filteredMonthlyData };
            });
          } else {
            newProdItem.models = [];
          }
          return newProdItem;
        })
        .filter((pItem) => pItem.models && pItem.models.length > 0);

      await getReport(prodsForReport, selectedMonth, selectedYear);
      console.log('Report generation complete and download initiated.');
    } catch (error) {
      console.error('Error generating report:', error);
      alert(`An error occurred while generating the report: ${error.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  const handleExcelExport = async () => {
    if (!canAccessExcel) {
      console.warn('You do not have permission to export Excel.');
      alert('You do not have permission to export Excel.');
      return;
    }
    
    if (!hasProdData) {
      console.warn('No production data to export to Excel.');
      alert('No production data to export to Excel. Please add production data first.');
      return;
    }

    setExcelLoading(true);
    try {
      await exportExcel(productions, selectedMonth, selectedYear);
      console.log('Excel export complete and download initiated.');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert(`An error occurred while exporting Excel: ${error.message}`);
    } finally {
      setExcelLoading(false);
    }
  };

  // Render
  return (
    <div className="mt-4 flex w-full flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
      {/* Report Controls */}
      {canAccessReport && (
        <>
          {/* Month Selector */}
          <select
            id="report-month-select"
            className={`flex-1 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500
              ${hasProdData 
                ? 'bg-gray-700 text-white transition duration-300 ease-in-out transform hover:scale-105' 
                : 'bg-gray-600 text-gray-400'
              }`}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            disabled={!hasProdData || reportLoading || excelLoading}
          >
            <option value={-1}>Entire year</option>
            {availableDates.months
              .filter((monthNum) => monthNum !== -1)
              .map((monthNum) => (
                <option key={`report-month-${monthNum}`} value={monthNum}>
                  {MONTH.full[monthNum]}
                </option>
              ))}
            {availableDates.months.length === 1 && 
             availableDates.months[0] === -1 && 
             !hasProdData && (
              <option value="" disabled>No month data</option>
            )}
          </select>

          {/* Year Selector */}
          <select
            id="report-year-select"
            className={`flex-1 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500
              ${hasProdData 
                ? 'bg-gray-700 text-white transition duration-300 ease-in-out transform hover:scale-105' 
                : 'bg-gray-600 text-gray-400'
              }`}
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            disabled={
              (availableDates.years.length <= 1 && 
               availableDates.years[0] === selectedYear && 
               !hasProdData) || 
              reportLoading || 
              excelLoading
            }
          >
            {availableDates.years.map((year) => (
              <option key={`report-year-${year}`} value={year}>
                {year}
              </option>
            ))}
            {!hasProdData && <option value="" disabled>No year data</option>}
          </select>

          {/* Report Button */}
          <button
            className={`flex-1 rounded-lg py-4 px-6 font-bold text-white transition duration-300 
              ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2 
              focus:ring-offset-gray-800
              ${hasProdData && !reportLoading && !excelLoading 
                ? 'bg-blue-600 hover:bg-blue-700 hover:scale-105 focus:ring-blue-500' 
                : 'bg-gray-500'
              }`}
            onClick={handleReportExport}
            disabled={!hasProdData || reportLoading || excelLoading}
          >
            {reportLoading ? 'Generating...' : 'Get Report'}
          </button>
        </>
      )}

      {/* Excel Export Button */}
      {canAccessExcel && (
        <button
          className={`flex-1 rounded-lg py-4 px-6 font-bold text-white transition duration-300 
            ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2 
            focus:ring-offset-gray-800
            ${hasProdData && !reportLoading && !excelLoading
              ? 'bg-green-600 hover:bg-green-700 hover:scale-105 focus:ring-green-500'
              : 'bg-gray-500 text-gray-300'
            }`}
          onClick={handleExcelExport}
          disabled={!hasProdData || reportLoading || excelLoading}
        >
          {excelLoading ? 'Exporting...' : 'Export Excel'}
        </button>
      )}

      {/* Production Plan Button */}
      {canAccessPlan && (
        <button
          className={`flex-1 rounded-lg py-4 px-6 font-bold text-white transition duration-300 
            ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2 
            focus:ring-offset-gray-800
            ${!reportLoading && !excelLoading
              ? 'bg-purple-600 hover:bg-purple-700 hover:scale-105 focus:ring-purple-500'
              : 'bg-gray-500 text-gray-300'
            }`}
          onClick={() => onNavigate('/new_plan')}
          disabled={reportLoading || excelLoading}
        >
          Production
        </button>
      )}
    </div>
  );
}

export default ExportControls;
