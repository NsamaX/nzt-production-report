import React, { useRef, useEffect } from 'react';

// ProductionTable Component
function ProductionTable({
  model,
  dailyMetrics,
  setDailyMetrics,
  days,
  statusRows,
  editingModelName,
  editingCellKey,
  setEditingCellKey,
  selectedMonth,
  selectedYear,
  today,
}) {
  const inputRef = useRef(null);

  // Focus input when editing cell
  useEffect(() => {
    if (editingCellKey && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCellKey]);

  // Utility Functions
  const formatNumberWithCommas = (num) => {
    const numberValue = parseFloat(num);
    if (num === 0) return '0';
    if (
      isNaN(numberValue) ||
      num === null ||
      num === undefined ||
      String(num).trim() === ''
    ) {
      return '';
    }
    return numberValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleMetricChange = (modelName, statusType, dayIndex, value) => {
    const cleanedValue = value.replace(/,/g, '');
    const parsedValue = cleanedValue === '' ? '' : parseInt(cleanedValue) || 0;

    setDailyMetrics((prevMetrics) => {
      const newMetrics = { ...prevMetrics };
      newMetrics[modelName] = { ...newMetrics[modelName] };
      newMetrics[modelName][statusType] = [...newMetrics[modelName][statusType]];
      newMetrics[modelName][statusType][dayIndex] = parsedValue;
      return newMetrics;
    });
  };

  const handleKeyPress = (event) => {
    const charCode = event.which ? event.which : event.keyCode;
    if (
      !(charCode >= 48 && charCode <= 57) && // Digits 0-9
      charCode !== 8 && // Backspace
      charCode !== 46 && // Delete
      charCode !== 37 && // Left arrow
      charCode !== 39 // Right arrow
    ) {
      event.preventDefault();
    }
  };

  const handleCellClick = (modelName, statusType, day) => {
    if (editingModelName === modelName) {
      const clickedDate = new Date(selectedYear, selectedMonth, day);
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      if (clickedDate <= todayDate) {
        setEditingCellKey(`${modelName}-${statusType}-${day}`);
      } else {
        alert('Cannot edit data for future dates.');
      }
    }
  };

  const handleBlur = () => {
    setEditingCellKey(null);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      setEditingCellKey(null);
    }
  };

  // Render
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-600 rounded-lg border border-gray-600">
        {/* Table Header */}
        <thead className="bg-gray-600">
          <tr>
            <th
              className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium 
                        text-gray-200 uppercase tracking-wider"
            >
              Status
            </th>
            {days.map((day) => {
              const headerDate = new Date(selectedYear, selectedMonth, day);
              const isFutureDate = headerDate > today;
              const isCurrentDay =
                day === today.getDate() &&
                selectedMonth === today.getMonth() &&
                selectedYear === today.getFullYear();

              return (
                <th
                  key={day}
                  className={`whitespace-nowrap px-3 py-3 text-center text-xs font-medium 
                            text-gray-200 uppercase tracking-wider
                            ${isCurrentDay ? 'border-b-2 border-blue-400 bg-blue-700 text-white' : ''}
                            ${isFutureDate ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : ''}`}
                >
                  Day {day}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-gray-700 bg-gray-800">
          {statusRows.map((status, statusIndex) => (
            <tr key={statusIndex}>
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-emerald-300">
                {status}
              </td>
              {days.map((day) => {
                const cellKey = `${model.name}-${status}-${day}`;
                const isEditingCell = editingCellKey === cellKey;
                const isInModelEditMode = editingModelName === model.name;
                const displayValue = dailyMetrics[model.name]?.[status]?.[day - 1];
                const cellDate = new Date(selectedYear, selectedMonth, day);
                const todayDate = new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate()
                );
                const isFutureCell = cellDate > todayDate;
                const isCurrentDayCell = cellDate.getTime() === todayDate.getTime();

                return (
                  <td
                    key={day}
                    className={`relative min-w-[80px] p-2 text-center text-sm h-10 overflow-hidden
                              ${isCurrentDayCell ? 'bg-blue-600 text-white' : 'bg-gray-800'}
                              ${isInModelEditMode && !isFutureCell ? 'cursor-pointer' : ''}
                              ${isFutureCell && isInModelEditMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : ''}
                              ${isFutureCell && !isInModelEditMode ? 'text-gray-500' : 'text-white'}`}
                    onClick={() => handleCellClick(model.name, status, day)}
                  >
                    {isInModelEditMode && !isFutureCell ? (
                      isEditingCell ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <input
                            ref={inputRef}
                            type="text"
                            value={formatNumberWithCommas(displayValue)}
                            onChange={(e) =>
                              handleMetricChange(model.name, status, day - 1, e.target.value)
                            }
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            onKeyPress={handleKeyPress}
                            className="h-full w-full border-none bg-emerald-600 text-center 
                                      text-white focus:outline-none focus:ring-0
                                      [appearance:textfield] 
                                      [&::-webkit-outer-spin-button]:appearance-none 
                                      [&::-webkit-inner-spin-button]:appearance-none 
                                      [-moz-appearance:textfield] pr-6"
                          />
                          <span className="absolute right-1 text-sm pointer-events-none">
                            ✏️
                          </span>
                        </div>
                      ) : (
                        formatNumberWithCommas(displayValue)
                      )
                    ) : (
                      formatNumberWithCommas(displayValue)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProductionTable;
