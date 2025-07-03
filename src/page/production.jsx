import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

function Production({ onNavigate }) {
  const [selectedProduction, setSelectedProduction] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState({});
  const [editingModelName, setEditingModelName] = useState(null);
  const [editingCellKey, setEditingCellKey] = useState(null);
  const [loadingProductionData, setLoadingProductionData] = useState(true);

  const [availableMonths, setAvailableMonths] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);

  const [originalDailyMetrics, setOriginalDailyMetrics] = useState({});

  const inputRef = useRef(null);

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const englishMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (month, year) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const days = getDaysInMonth(selectedMonth, selectedYear);
  const statusRows = ['Forecast', 'Capacity', 'Capacity + OT', 'Production'];

  const currentDateFormatted = today.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productionId = params.get('id');

    const fetchProduction = async () => {
      if (!productionId) {
        onNavigate('/dashboard');
        return;
      }

      try {
        setLoadingProductionData(true);
        const docRef = doc(db, 'productions', productionId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const fetchedProduction = { id: docSnap.id, ...docSnap.data() };
          setSelectedProduction(fetchedProduction);

          const currentYear = today.getFullYear();
          const startYear = 2020; // Assuming data starts from 2020
          const years = [];
          for (let year = startYear; year <= currentYear; year++) {
            years.push(year);
          }
          setAvailableYears(years.sort((a, b) => a - b));

          let initialSelectedYear = today.getFullYear();
          let initialSelectedMonth = today.getMonth();

          setSelectedYear(initialSelectedYear);
          setSelectedMonth(initialSelectedMonth);

          const initialDailyMetrics = {};
          fetchedProduction.models.forEach(model => {
            initialDailyMetrics[model.name] = {};
            statusRows.forEach(status => {
              const monthlyData = model.data?.find(
                data => data.year === initialSelectedYear && data.month === initialSelectedMonth
              );

              const daysInCurrentMonth = getDaysInMonth(initialSelectedMonth, initialSelectedYear).length;
              const dailyValuesForStatus = Array(daysInCurrentMonth).fill(0);

              if (monthlyData && monthlyData.data && monthlyData.data[status]) {
                monthlyData.data[status].forEach(dayData => {
                  const dayIndex = dayData.day - 1;
                  if (dayIndex >= 0 && dayIndex < daysInCurrentMonth) {
                    dailyValuesForStatus[dayIndex] = dayData.value;
                  }
                });
              }
              initialDailyMetrics[model.name][status] = dailyValuesForStatus;
            });
          });
          setDailyMetrics(initialDailyMetrics);

        } else {
          console.log("No such document!");
          alert('Selected production data not found.');
          onNavigate('/dashboard');
        }
      } catch (error) {
        console.error("Error fetching document:", error);
        alert('An error occurred while fetching production data: ' + error.message);
        onNavigate('/dashboard');
      } finally {
        setLoadingProductionData(false);
      }
    };

    fetchProduction();
  }, [onNavigate]);

  useEffect(() => {
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    if (selectedYear === currentYear) {
      const months = [];
      for (let i = 0; i <= currentMonth; i++) {
        months.push(i);
      }
      setAvailableMonths(months);
    } else {
      const months = [];
      for (let i = 0; i < 12; i++) {
        months.push(i);
      }
      setAvailableMonths(months);
    }
  }, [selectedYear, today]);


  useEffect(() => {
    if (selectedProduction && !loadingProductionData) {
      const initialDailyMetrics = {};
      selectedProduction.models.forEach(model => {
        initialDailyMetrics[model.name] = {};
        statusRows.forEach(status => {
          const monthlyData = model.data?.find(
            data => data.year === selectedYear && data.month === selectedMonth
          );

          const daysInCurrentMonth = getDaysInMonth(selectedMonth, selectedYear).length;
          const dailyValuesForStatus = Array(daysInCurrentMonth).fill(0);

          if (monthlyData && monthlyData.data && monthlyData.data[status]) {
            monthlyData.data[status].forEach(dayData => {
              const dayIndex = dayData.day - 1;
              if (dayIndex >= 0 && dayIndex < daysInCurrentMonth) {
                dailyValuesForStatus[dayIndex] = dayData.value;
              }
            });
          }
          initialDailyMetrics[model.name][status] = dailyValuesForStatus;
        });
      });
      setDailyMetrics(initialDailyMetrics);
    }
  }, [selectedMonth, selectedYear, selectedProduction, loadingProductionData, days.length]);

  useEffect(() => {
    if (editingCellKey && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCellKey]);

  const formatNumberWithCommas = (num) => {
    const numberValue = parseFloat(num);
    if (num === 0) {
      return '0';
    }
    if (isNaN(numberValue) || num === null || num === undefined || String(num).trim() === '') {
      return '';
    }
    return numberValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleMetricChange = (modelName, statusType, dayIndex, value) => {
    const cleanedValue = value.replace(/,/g, '');
    const parsedValue = cleanedValue === '' ? '' : parseInt(cleanedValue) || 0;

    setDailyMetrics(prevMetrics => {
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
      !(charCode >= 48 && charCode <= 57) && // Only allow numbers
      charCode !== 8 && // Backspace
      charCode !== 46 && // Delete
      charCode !== 37 && // Left arrow
      charCode !== 39 // Right arrow
    ) {
      event.preventDefault();
    }
  };

  const toggleModelEditMode = async (modelName) => {
    if (editingModelName === modelName) {
      const currentModelMetrics = dailyMetrics[modelName];
      const updatedDailyMetricsForFirestore = {};
      let hasAnyDataToSave = false;

      for (const status of statusRows) {
        const dailyValuesArray = currentModelMetrics[status];
        const sparseDataForStatus = [];
        dailyValuesArray.forEach((value, index) => {
          const day = index + 1;
          if (value !== 0 && value !== null && value !== undefined && String(value).trim() !== '') {
            sparseDataForStatus.push({ day, value });
            hasAnyDataToSave = true;
          }
        });
        updatedDailyMetricsForFirestore[status] = sparseDataForStatus;
      }

      try {
        const productionDocRef = doc(db, 'productions', selectedProduction.id);

        const currentModelsCopy = JSON.parse(JSON.stringify(selectedProduction.models));

        const updatedModels = currentModelsCopy.map(model => {
          if (model.name === modelName) {
            let newdata = [];
            if (model.data) {
              newdata = [...model.data];
            }

            const monthlyDataIndex = newdata.findIndex(
              data => data.year === selectedYear && data.month === selectedMonth
            );

            const isAllZeroOrEmptyForMonth = Object.values(updatedDailyMetricsForFirestore).every(
              (arr) => arr.length === 0
            );

            if (monthlyDataIndex !== -1) {
              if (isAllZeroOrEmptyForMonth) {
                newdata.splice(monthlyDataIndex, 1);
              } else {
                newdata[monthlyDataIndex] = {
                  year: selectedYear,
                  month: selectedMonth,
                  data: updatedDailyMetricsForFirestore
                };
              }
            } else {
              if (!isAllZeroOrEmptyForMonth) {
                newdata.push({
                  year: selectedYear,
                  month: selectedMonth,
                  data: updatedDailyMetricsForFirestore
                });
              }
            }

            return {
              ...model,
              data: newdata
            };
          }
          return model;
        });

        const hasChanges = JSON.stringify(updatedModels) !== JSON.stringify(selectedProduction.models);

        if (hasChanges) {
          await updateDoc(productionDocRef, {
            models: updatedModels
          });
          alert('Data saved successfully!');
          setSelectedProduction(prev => ({ ...prev, models: updatedModels }));
        } else {
          alert('No changes to save.');
        }

        setEditingCellKey(null);
        setEditingModelName(null);
        setOriginalDailyMetrics({});

      } catch (error) {
        console.error("Error saving data:", error);
        alert('An error occurred while saving data: ' + error.message);
      }
    } else {
      setOriginalDailyMetrics({
        ...originalDailyMetrics,
        [modelName]: JSON.parse(JSON.stringify(dailyMetrics[modelName]))
      });
      setEditingModelName(modelName);
      setEditingCellKey(null);
    }
  };

  const handleCancelEdit = (modelName) => {
    if (originalDailyMetrics[modelName]) {
      setDailyMetrics(prevMetrics => ({
        ...prevMetrics,
        [modelName]: originalDailyMetrics[modelName]
      }));
    }
    setEditingModelName(null);
    setEditingCellKey(null);
    setOriginalDailyMetrics({});
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

  if (loadingProductionData || !selectedProduction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <p className="text-blue-400 text-xl mb-4">Loading production data...</p>
      </div>
    );
  }

  const yearsToDisplay = availableYears;
  const monthsToDisplay = availableMonths;

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-full overflow-x-auto my-8">
        <h1 className="text-4xl font-extrabold text-center text-emerald-300 mb-6">
          Production Report: {selectedProduction.plant}
        </h1>
        <div className="flex flex-col items-start md:flex-row md:items-center md:justify-end text-lg text-gray-300 mb-6">
          <p className="text-xl font-bold mb-2 md:mb-0">
            Today: <span className="text-yellow-300">
              {currentDateFormatted}
            </span>
          </p>
          <div className="flex space-x-2 items-center">
            <label htmlFor="month-select" className="sr-only">Select Month</label>
            <select
              id="month-select"
              className="bg-gray-700 text-white p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedMonth}
              onChange={handleMonthChange}
            >
              {monthsToDisplay.map((monthNum) => (
                <option key={monthNum} value={monthNum}>
                  {englishMonths[monthNum]}
                </option>
              ))}
            </select>
            <label htmlFor="year-select" className="sr-only">Select Year</label>
            <select
              id="year-select"
              className="bg-gray-700 text-white p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedYear}
              onChange={handleYearChange}
            >
              {yearsToDisplay.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedProduction.models && selectedProduction.models.length > 0 ? (
          selectedProduction.models.map((model, modelIndex) => (
            <div key={modelIndex} className="mb-8 p-4 bg-gray-700 rounded-lg border border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-blue-400">
                  Model List: {model.name}
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => toggleModelEditMode(model.name)}
                    className={`py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105
                                 ${editingModelName === model.name ? 'bg-green-500 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                                 text-white font-bold focus:outline-none focus:ring-2
                                 ${editingModelName === model.name ? 'focus:ring-green-500 focus:ring-offset-green-800' : 'focus:ring-red-500 focus:ring-offset-red-800'}
                                 `}
                  >
                    {editingModelName === model.name ? 'Save' : 'Edit'}
                  </button>
                  {editingModelName === model.name && (
                    <button
                      onClick={() => handleCancelEdit(model.name)}
                      className="py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105
                                 bg-gray-500 hover:bg-gray-700 text-white font-bold focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-gray-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg">
                  <thead className="bg-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-200 uppercase tracking-wider whitespace-nowrap">
                        Status
                      </th>
                      {days.map((day) => {
                          const headerDate = new Date(selectedYear, selectedMonth, day);
                          const isFutureDate = headerDate > today;
                          const isCurrentDay = day === today.getDate() && selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
                        return (
                          <th
                            key={day}
                            className={`px-3 py-3 text-center text-xs font-medium text-gray-200 uppercase tracking-wider whitespace-nowrap
                                  ${
                                    isCurrentDay
                                      ? 'bg-blue-700 text-white border-b-2 border-blue-400'
                                      : ''
                                  }
                                  ${isFutureDate ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : ''}
                                  `}
                          >
                            Day {day}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {statusRows.map((status, statusIndex) => (
                      <tr key={statusIndex}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-300">
                          {status}
                        </td>
                        {days.map((day) => {
                          const cellKey = `${model.name}-${status}-${day}`;
                          const isEditingCell = editingCellKey === cellKey;
                          const isInModelEditMode = editingModelName === model.name;

                          const displayValue = dailyMetrics[model.name]?.[status]?.[day - 1];

                          const cellDate = new Date(selectedYear, selectedMonth, day);
                          const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                          const isFutureCell = cellDate > todayDate;
                          const isCurrentDayCell = cellDate.getTime() === todayDate.getTime();


                          return (
                            <td
                              key={day}
                              className={`
                                p-2 h-10 min-w-[80px] relative overflow-hidden
                                text-sm text-center
                                ${isCurrentDayCell ? 'bg-blue-600 text-white' : 'bg-gray-800'}
                                ${isInModelEditMode && !isFutureCell ? 'cursor-pointer' : ''}
                                ${isFutureCell && isInModelEditMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : ''}
                                ${isFutureCell && !isInModelEditMode ? 'text-gray-500' : 'text-white'}
                              `}
                              onClick={() => handleCellClick(model.name, status, day)}
                            >
                              {isInModelEditMode && !isFutureCell ? (
                                isEditingCell ? (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <input
                                      ref={inputRef}
                                      type="text"
                                      value={formatNumberWithCommas(dailyMetrics[model.name]?.[status]?.[day - 1])}
                                      onChange={(e) => handleMetricChange(model.name, status, day - 1, e.target.value)}
                                      onBlur={handleBlur}
                                      onKeyDown={handleKeyDown}
                                      onKeyPress={handleKeyPress}
                                      className={`
                                        w-full h-full bg-emerald-600 text-white text-center border-none focus:outline-none focus:ring-0
                                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                                        [-moz-appearance:textfield]
                                        pr-6
                                      `}
                                    />
                                    <span className="absolute right-1 text-sm pointer-events-none">✏️</span>
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
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-center mt-4">No model items for this production.</p>
        )}
        <div className="flex justify-end mt-8">
          <button
            onClick={() => onNavigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default Production;
