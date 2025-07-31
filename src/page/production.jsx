import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { productionConfig } from '../config/production';
import ProductionTable from '../component/production_table';
import DateSelector from '../component/date_sector';

// Production Component
function Production({ onNavigate, userRole }) {
  // State
  const [selectedProduction, setSelectedProduction] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState({});
  const [editingModelName, setEditingModelName] = useState(null);
  const [editingCellKey, setEditingCellKey] = useState(null);
  const [loadingProductionData, setLoadingProductionData] = useState(true);
  const [originalDailyMetrics, setOriginalDailyMetrics] = useState({});

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // Permissions
  const canEdit = userRole === 'admin' || userRole === 'staff';

  // Utility Functions
  const getDaysInMonth = (month, year) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const days = getDaysInMonth(selectedMonth, selectedYear);
  const statusRows = productionConfig.statusRows.map((status) => status.name);

  const currentDateFormatted = today.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Fetch Production Data
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

          const initialDailyMetrics = {};
          fetchedProduction.models.forEach((model) => {
            initialDailyMetrics[model.name] = {};
            statusRows.forEach((status) => {
              const monthlyData = model.data?.find(
                (data) => data.year === selectedYear && data.month === selectedMonth
              );

              const daysInCurrentMonth = getDaysInMonth(selectedMonth, selectedYear).length;
              const dailyValuesForStatus = Array(daysInCurrentMonth).fill(0);

              if (monthlyData?.data?.[status]) {
                monthlyData.data[status].forEach((dayData) => {
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
          console.log('No such document!');
          alert('Selected production data not found.');
          onNavigate('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching document:', error);
        alert(`An error occurred while fetching production data: ${error.message}`);
        onNavigate('/dashboard');
      } finally {
        setLoadingProductionData(false);
      }
    };

    fetchProduction();
  }, [onNavigate, selectedMonth, selectedYear]);

  // Update Daily Metrics
  useEffect(() => {
    if (selectedProduction && !loadingProductionData) {
      const initialDailyMetrics = {};
      selectedProduction.models.forEach((model) => {
        initialDailyMetrics[model.name] = {};
        statusRows.forEach((status) => {
          const monthlyData = model.data?.find(
            (data) => data.year === selectedYear && data.month === selectedMonth
          );

          const daysInCurrentMonth = getDaysInMonth(selectedMonth, selectedYear).length;
          const dailyValuesForStatus = Array(daysInCurrentMonth).fill(0);

          if (monthlyData?.data?.[status]) {
            monthlyData.data[status].forEach((dayData) => {
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

  // Handlers
  const toggleModelEditMode = async (modelName) => {
    if (editingModelName === modelName) {
      const currentModelMetrics = dailyMetrics[modelName];
      const updatedDailyMetricsForFirestore = {};

      for (const status of statusRows) {
        const dailyValuesArray = currentModelMetrics[status];
        const sparseDataForStatus = [];
        dailyValuesArray.forEach((value, index) => {
          const day = index + 1;
          if (
            value !== 0 &&
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ''
          ) {
            sparseDataForStatus.push({ day, value });
          }
        });
        updatedDailyMetricsForFirestore[status] = sparseDataForStatus;
      }

      try {
        const productionDocRef = doc(db, 'productions', selectedProduction.id);
        const currentModelsCopy = JSON.parse(JSON.stringify(selectedProduction.models));

        const updatedModels = currentModelsCopy.map((model) => {
          if (model.name === modelName) {
            let newData = model.data ? [...model.data] : [];
            const monthlyDataIndex = newData.findIndex(
              (data) => data.year === selectedYear && data.month === selectedMonth
            );

            const isAllZeroOrEmptyForMonth = Object.values(
              updatedDailyMetricsForFirestore
            ).every((arr) => arr.length === 0);

            if (monthlyDataIndex !== -1) {
              if (isAllZeroOrEmptyForMonth) {
                newData.splice(monthlyDataIndex, 1);
              } else {
                newData[monthlyDataIndex] = {
                  year: selectedYear,
                  month: selectedMonth,
                  data: updatedDailyMetricsForFirestore,
                };
              }
            } else if (!isAllZeroOrEmptyForMonth) {
              newData.push({
                year: selectedYear,
                month: selectedMonth,
                data: updatedDailyMetricsForFirestore,
              });
            }

            return { ...model, data: newData };
          }
          return model;
        });

        const hasChanges =
          JSON.stringify(updatedModels) !== JSON.stringify(selectedProduction.models);

        if (hasChanges) {
          await updateDoc(productionDocRef, { models: updatedModels });
          alert('Data saved successfully!');
          setSelectedProduction((prev) => ({ ...prev, models: updatedModels }));
        } else {
          alert('No changes to save.');
        }

        setEditingCellKey(null);
        setEditingModelName(null);
        setOriginalDailyMetrics({});
      } catch (error) {
        console.error('Error saving data:', error);
        alert(`An error occurred while saving data: ${error.message}`);
      }
    } else {
      setOriginalDailyMetrics({
        ...originalDailyMetrics,
        [modelName]: JSON.parse(JSON.stringify(dailyMetrics[modelName])),
      });
      setEditingModelName(modelName);
      setEditingCellKey(null);
    }
  };

  const handleCancelEdit = (modelName) => {
    if (originalDailyMetrics[modelName]) {
      setDailyMetrics((prevMetrics) => ({
        ...prevMetrics,
        [modelName]: originalDailyMetrics[modelName],
      }));
    }
    setEditingModelName(null);
    setEditingCellKey(null);
    setOriginalDailyMetrics({});
  };

  // Render
  if (loadingProductionData || !selectedProduction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4 text-white">
        <p className="mb-4 text-xl text-blue-400">Loading production data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-900 p-4 text-white">
      <div className="my-8 w-full max-w-full overflow-x-auto rounded-xl bg-gray-800 p-8 shadow-lg">
        {/* Header */}
        <h1 className="mb-6 text-center text-4xl font-extrabold text-emerald-300">
          Production Report: {selectedProduction.plant}
        </h1>

        {/* Date and Selector */}
        <div className="mb-6 flex flex-col items-start text-lg text-gray-300 md:flex-row md:items-center md:justify-end">
          <p className="mb-2 text-xl font-bold md:mb-0">
            Today: <span className="text-yellow-300">{currentDateFormatted}</span>
          </p>
          <DateSelector
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            today={today}
            setEditingModelName={setEditingModelName}
            setEditingCellKey={setEditingCellKey}
            setOriginalDailyMetrics={setOriginalDailyMetrics}
          />
        </div>

        {/* Models */}
        {selectedProduction.models && selectedProduction.models.length > 0 ? (
          selectedProduction.models.map((model, modelIndex) => (
            <div
              key={modelIndex}
              className="mb-8 rounded-lg border border-gray-600 bg-gray-700 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-blue-400">
                  Model List: {model.name}
                </h2>
                <div className="flex space-x-2">
                  {canEdit && (
                    <button
                      onClick={() => toggleModelEditMode(model.name)}
                      className={`rounded-lg px-4 py-2 font-bold text-white 
                                transition duration-300 ease-in-out transform hover:scale-105 
                                focus:outline-none focus:ring-2 focus:ring-offset-2
                                ${editingModelName === model.name
                                  ? 'bg-green-500 hover:bg-green-700 focus:ring-green-500 focus:ring-offset-green-800'
                                  : 'bg-red-600 hover:bg-red-700 focus:ring-red-500 focus:ring-offset-red-800'}`}
                    >
                      {editingModelName === model.name ? 'Save' : 'Edit'}
                    </button>
                  )}
                  {editingModelName === model.name && (
                    <button
                      onClick={() => handleCancelEdit(model.name)}
                      className="rounded-lg bg-gray-500 px-4 py-2 font-bold text-white 
                                transition duration-300 ease-in-out transform hover:scale-105 
                                hover:bg-gray-700 focus:outline-none focus:ring-2 
                                focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <ProductionTable
                model={model}
                dailyMetrics={dailyMetrics}
                setDailyMetrics={setDailyMetrics}
                days={days}
                statusRows={statusRows}
                editingModelName={editingModelName}
                editingCellKey={editingCellKey}
                setEditingCellKey={setEditingCellKey}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                today={today}
              />
            </div>
          ))
        ) : (
          <p className="mt-4 text-center text-gray-400">
            No model items for this production.
          </p>
        )}

        {/* Back Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => onNavigate('/dashboard')}
            className="rounded-lg bg-blue-600 px-6 py-4 font-bold text-white 
                      transition duration-300 ease-in-out transform hover:scale-105 
                      hover:bg-blue-700 focus:outline-none focus:ring-2 
                      focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default Production;
