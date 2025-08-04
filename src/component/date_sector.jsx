import React, { useEffect, useState } from 'react';
import { MONTH } from '../config/date_constant';

// DateSelector Component
function DateSelector({
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  today,
  setEditingModelName,
  setEditingCellKey,
  setOriginalDailyMetrics,
}) {
  // State Management
  const [availableMonths, setAvailableMonths] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);

  // Populate available months and years
  useEffect(() => {
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // Generate available years from 2020 to current year
    const startYear = 2020;
    const years = Array.from(
      { length: currentYear - startYear + 1 },
      (_, index) => startYear + index
    );
    setAvailableYears(years);

    // Set available months based on selected year
    const months = selectedYear === currentYear
      ? Array.from({ length: currentMonth + 1 }, (_, index) => index)
      : Array.from({ length: 12 }, (_, index) => index);
    setAvailableMonths(months);
  }, [selectedYear, today]);

  // Handlers
  const handleMonthChange = (event) => {
    const newMonth = parseInt(event.target.value);
    setSelectedMonth(newMonth);
    setEditingModelName(null);
    setEditingCellKey(null);
    setOriginalDailyMetrics({});
  };

  const handleYearChange = (event) => {
    const newYear = parseInt(event.target.value);
    setSelectedYear(newYear);
    setEditingModelName(null);
    setEditingCellKey(null);
    setOriginalDailyMetrics({});
  };

  // Render
  return (
    <div className="flex items-center space-x-2">
      {/* Month Selector */}
      <label htmlFor="month-select" className="sr-only">
        Select Month
      </label>
      <select
        id="month-select"
        className="bg-gray-700 text-white p-2 rounded-md 
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={selectedMonth}
        onChange={handleMonthChange}
      >
        {availableMonths.map((monthNum) => (
          <option key={monthNum} value={monthNum}>
            {MONTH.full[monthNum]}
          </option>
        ))}
      </select>

      {/* Year Selector */}
      <label htmlFor="year-select" className="sr-only">
        Select Year
      </label>
      <select
        id="year-select"
        className="bg-gray-700 text-white p-2 rounded-md 
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={selectedYear}
        onChange={handleYearChange}
      >
        {availableYears.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}

export default DateSelector;
