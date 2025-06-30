import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const formatNumberWithCommas = (num) => {
  if (num === 0) return '0';
  const numberValue = parseFloat(num);
  if (isNaN(numberValue) || num === null || num === undefined || String(num).trim() === '') {
    return '';
  }
  return numberValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

function Production({ onNavigate }) {
  const [selectedProduction, setSelectedProduction] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState({});
  const [editingModelName, setEditingModelName] = useState(null);
  const [editingCellKey, setEditingCellKey] = useState(null);
  const [loadingProductionData, setLoadingProductionData] = useState(true);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const originalDailyMetrics = useRef({});

  const inputRef = useRef(null);

  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const getDaysInMonth = useCallback((month, year) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, []);

  const days = getDaysInMonth(selectedMonth, selectedYear);
  const statusRows = ['Forecast', 'Capacity', 'Capacity + OT', 'Production'];

  const currentDateFormatted = today.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    const productionId = new URLSearchParams(window.location.search).get('id');

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

          const yearsSet = new Set();
          const monthsForYear = new Map();

          fetchedProduction.models?.forEach(model => {
            model.data?.forEach(monthlyData => {
              yearsSet.add(monthlyData.year);
              if (!monthsForYear.has(monthlyData.year)) {
                monthsForYear.set(monthlyData.year, new Set());
              }
              monthsForYear.get(monthlyData.year).add(monthlyData.month);
            });
          });

          const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);
          setAvailableYears(sortedYears);

          let initialSelectedYear = sortedYears.includes(today.getFullYear()) ? today.getFullYear() : sortedYears[sortedYears.length - 1] || today.getFullYear();
          const monthsForCurrentSelectedYear = Array.from(monthsForYear.get(initialSelectedYear) || []).sort((a, b) => a - b);
          let initialSelectedMonth = monthsForCurrentSelectedYear.includes(today.getMonth()) ? today.getMonth() : monthsForCurrentSelectedYear[monthsForCurrentSelectedYear.length - 1] || today.getMonth();

          setSelectedYear(initialSelectedYear);
          setSelectedMonth(initialSelectedMonth);
          setAvailableMonths(monthsForCurrentSelectedYear);

        } else {
          console.log("No such document!");
          alert('ไม่พบข้อมูลการผลิตที่เลือก');
          onNavigate('/dashboard');
        }
      } catch (error) {
        console.error("Error fetching document:", error);
        alert('เกิดข้อผิดพลาดในการดึงข้อมูลการผลิต: ' + error.message);
        onNavigate('/dashboard');
      } finally {
        setLoadingProductionData(false);
      }
    };

    fetchProduction();
  }, [onNavigate, today]);

  useEffect(() => {
    if (selectedProduction && !loadingProductionData) {
      const monthsForYearSet = new Set();
      selectedProduction.models.forEach(model => {
        model.data?.forEach(monthlyData => {
          if (monthlyData.year === selectedYear) {
            monthsForYearSet.add(monthlyData.month);
          }
        });
      });
      const sortedMonths = Array.from(monthsForYearSet).sort((a, b) => a - b);
      setAvailableMonths(sortedMonths);

      if (!sortedMonths.includes(selectedMonth)) {
        setSelectedMonth(sortedMonths.length > 0 ? sortedMonths[0] : today.getMonth());
      }
    } else if (!selectedProduction && availableYears.length === 0) {
      setAvailableMonths([today.getMonth()]);
    }
  }, [selectedYear, selectedProduction, loadingProductionData, today, selectedMonth, availableYears.length]);

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

          monthlyData?.data?.[status]?.forEach(dayData => {
            const dayIndex = dayData.day - 1;
            if (dayIndex >= 0 && dayIndex < daysInCurrentMonth) {
              dailyValuesForStatus[dayIndex] = dayData.value;
            }
          });
          initialDailyMetrics[model.name][status] = dailyValuesForStatus;
        });
      });
      setDailyMetrics(initialDailyMetrics);
    }
  }, [selectedMonth, selectedYear, selectedProduction, loadingProductionData, getDaysInMonth]);

  useEffect(() => {
    if (editingCellKey && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCellKey]);

  const handleMetricChange = (modelName, statusType, dayIndex, value) => {
    const cleanedValue = value.replace(/,/g, '');
    const parsedValue = cleanedValue === '' ? '' : parseInt(cleanedValue) || 0;

    setDailyMetrics(prevMetrics => ({
      ...prevMetrics,
      [modelName]: {
        ...prevMetrics[modelName],
        [statusType]: Object.assign([], prevMetrics[modelName][statusType], { [dayIndex]: parsedValue })
      }
    }));
  };

  const handleKeyPress = (event) => {
    const charCode = event.which ? event.which : event.keyCode;
    if (
      !(charCode >= 48 && charCode <= 57) &&
      charCode !== 8 &&
      charCode !== 46 &&
      charCode !== 37 &&
      charCode !== 39
    ) {
      event.preventDefault();
    }
  };

  const toggleModelEditMode = async (modelName) => {
    if (editingModelName === modelName) {
      const currentModelMetrics = dailyMetrics[modelName];
      const updatedDailyMetricsForFirestore = {};

      for (const status of statusRows) {
        const dailyValuesArray = currentModelMetrics[status];
        const sparseDataForStatus = [];
        dailyValuesArray.forEach((value, index) => {
          const day = index + 1;
          if (value !== 0 && value !== null && value !== undefined && String(value).trim() !== '') {
            sparseDataForStatus.push({ day, value });
          }
        });
        updatedDailyMetricsForFirestore[status] = sparseDataForStatus;
      }

      try {
        const productionDocRef = doc(db, 'productions', selectedProduction.id);
        const currentModelsCopy = JSON.parse(JSON.stringify(selectedProduction.models));

        const updatedModels = currentModelsCopy.map(model => {
          if (model.name === modelName) {
            let monthlyDataArray = model.data ? [...model.data] : [];
            const monthlyDataIndex = monthlyDataArray.findIndex(
              data => data.year === selectedYear && data.month === selectedMonth
            );

            const newMonthlyData = {
              year: selectedYear,
              month: selectedMonth,
              data: updatedDailyMetricsForFirestore
            };

            const allCurrentMonthDataEmpty = Object.values(updatedDailyMetricsForFirestore).every(arr => arr.length === 0);

            if (monthlyDataIndex !== -1) {
              if (allCurrentMonthDataEmpty) {
                monthlyDataArray.splice(monthlyDataIndex, 1);
              } else {
                monthlyDataArray[monthlyDataIndex] = newMonthlyData;
              }
            } else {
              if (!allCurrentMonthDataEmpty) {
                monthlyDataArray.push(newMonthlyData);
              }
            }
            return { ...model, data: monthlyDataArray };
          }
          return model;
        });

        const hasChanges = JSON.stringify(updatedModels) !== JSON.stringify(selectedProduction.models);

        if (hasChanges) {
          await updateDoc(productionDocRef, { models: updatedModels });
          alert('บันทึกข้อมูลสำเร็จ!');
          setSelectedProduction(prev => ({ ...prev, models: updatedModels }));
        } else {
          alert('ไม่มีการเปลี่ยนแปลงข้อมูล');
        }

        setEditingCellKey(null);
        setEditingModelName(null);
        originalDailyMetrics.current = {};

      } catch (error) {
        console.error("Error saving data:", error);
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
      }
    } else {
      originalDailyMetrics.current[modelName] = JSON.parse(JSON.stringify(dailyMetrics[modelName]));
      setEditingModelName(modelName);
      setEditingCellKey(null);
    }
  };

  const handleCancelEdit = (modelName) => {
    if (originalDailyMetrics.current[modelName]) {
      setDailyMetrics(prevMetrics => ({
        ...prevMetrics,
        [modelName]: originalDailyMetrics.current[modelName]
      }));
    }
    setEditingModelName(null);
    setEditingCellKey(null);
    originalDailyMetrics.current = {};
  };

  const handleCellClick = (modelName, statusType, day) => {
    const isCurrentDayAndMonthYear = (
      day === today.getDate() &&
      selectedMonth === today.getMonth() &&
      selectedYear === today.getFullYear()
    );
    if (isCurrentDayAndMonthYear && editingModelName === modelName) {
      setEditingCellKey(`${modelName}-${statusType}-${day}`);
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
    setSelectedMonth(parseInt(event.target.value));
    setEditingModelName(null);
    setEditingCellKey(null);
    originalDailyMetrics.current = {};
  };

  const handleYearChange = (event) => {
    setSelectedYear(parseInt(event.target.value));
    setEditingModelName(null);
    setEditingCellKey(null);
    originalDailyMetrics.current = {};
  };

  if (loadingProductionData || !selectedProduction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <p className="text-blue-400 text-xl mb-4">กำลังโหลดข้อมูลการผลิต...</p>
      </div>
    );
  }

  const yearsToDisplay = availableYears.length > 0 ? availableYears : [today.getFullYear()];
  const monthsToDisplay = availableMonths.length > 0 ? availableMonths : [today.getMonth()];

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-full overflow-x-auto my-8">
        <h1 className="text-4xl font-extrabold text-center text-emerald-300 mb-6">
          รายงานการผลิต: {selectedProduction.plant}
        </h1>
        <div className="flex flex-col items-start md:flex-row md:items-center md:justify-between text-lg text-gray-300 mb-6">
          <p className="text-left mb-4 md:mb-0">
            <span className="font-semibold text-blue-300">ผู้รับผิดชอบ:</span> {selectedProduction.responsiblePerson || 'ไม่ได้ระบุ'}
          </p>
          <div className="flex flex-col items-end">
            <p className="font-bold mb-2">
              วันนี้: <span className="text-yellow-300">
                {currentDateFormatted}
              </span>
            </p>
            <div className="flex space-x-2 items-center">
              <label htmlFor="month-select" className="sr-only">เลือกเดือน</label>
              <select
                id="month-select"
                className="bg-gray-700 text-white p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedMonth}
                onChange={handleMonthChange}
              >
                {monthsToDisplay.map((monthNum) => (
                  <option key={monthNum} value={monthNum}>
                    {thaiMonths[monthNum]}
                  </option>
                ))}
              </select>
              <label htmlFor="year-select" className="sr-only">เลือกปี</label>
              <select
                id="year-select"
                className="bg-gray-700 text-white p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedYear}
                onChange={handleYearChange}
              >
                {yearsToDisplay.map((year) => (
                  <option key={year} value={year}>
                    {year + 543}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedProduction.models && selectedProduction.models.length > 0 ? (
          selectedProduction.models.map((model, modelIndex) => (
            <div key={modelIndex} className="mb-8 p-4 bg-gray-700 rounded-lg border border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-blue-400">
                  รายการรุ่น: {model.name}
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
                    {editingModelName === model.name ? 'บันทึก' : 'แก้ไข'}
                  </button>
                  {editingModelName === model.name && (
                    <button
                      onClick={() => handleCancelEdit(model.name)}
                      className="py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105
                                 bg-gray-500 hover:bg-gray-700 text-white font-bold focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-gray-800"
                    >
                      ยกเลิก
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg">
                  <thead className="bg-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-200 uppercase tracking-wider whitespace-nowrap">
                        สถานะ
                      </th>
                      {days.map((day) => (
                        <th
                          key={day}
                          className={`px-3 py-3 text-center text-xs font-medium text-gray-200 uppercase tracking-wider whitespace-nowrap
                                     ${day === today.getDate() && selectedMonth === today.getMonth() && selectedYear === today.getFullYear()
                                         ? 'bg-blue-700 text-white border-b-2 border-blue-400'
                                         : ''
                                     }`}
                        >
                          วันที่ {day}
                        </th>
                      ))}
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
                          const isCurrentDayAndMonthYear = (
                            day === today.getDate() &&
                            selectedMonth === today.getMonth() &&
                            selectedYear === today.getFullYear()
                          );

                          return (
                            <td
                              key={day}
                              className={`
                                         p-2 h-10 min-w-[80px] relative overflow-hidden
                                         text-sm text-center
                                         ${isCurrentDayAndMonthYear ? 'bg-blue-600 text-white' : 'bg-gray-800'}
                                         ${isCurrentDayAndMonthYear && isInModelEditMode ? 'cursor-pointer' : ''}
                                         text-white
                                     `}
                              onClick={() => handleCellClick(model.name, status, day)}
                            >
                              {isCurrentDayAndMonthYear && isInModelEditMode ? (
                                isEditingCell ? (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <input
                                      ref={inputRef}
                                      type="text"
                                      value={formatNumberWithCommas(displayValue)}
                                      onChange={(e) => handleMetricChange(model.name, status, day - 1, e.target.value)}
                                      onBlur={handleBlur}
                                      onKeyDown={handleKeyDown}
                                      onKeyPress={handleKeyPress}
                                      className={`
                                                 w-full h-full bg-blue-600 text-white text-center border-none focus:outline-none focus:ring-0
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
          <p className="text-gray-400 text-center mt-4">ไม่มีรายการรุ่นสำหรับการผลิตนี้</p>
        )}

        <div className="flex justify-end mt-8">
          <button
            onClick={() => onNavigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            กลับสู่แผงควบคุม
          </button>
        </div>
      </div>
    </div>
  );
}

export default Production;
