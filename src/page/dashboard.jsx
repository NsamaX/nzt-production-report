import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import Announcements from '../component/announcements';
import ProductionList from '../component/production_list';
import ExportControls from '../component/export_controls';

// Dashboard Component
function Dashboard({ onNavigate, onSignout, user, userRole }) {
  // State and Constants
  const today = useMemo(() => new Date(), []);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const currentDay = today.getDate();

  const [productions, setProductions] = useState([]);
  const [loading, setLoading] = useState({ productions: true });
  const [selectedMonth, setSelectedMonth] = useState(-1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [availableDates, setAvailableDates] = useState({ months: [], years: [] });
  const [reportLoading, setReportLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  // Role-based Permissions
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';
  const canAccessPlan = isAdmin;
  const canAccessExcel = isAdmin || isManager;
  const canAccessReport = isAdmin || isManager;
  const canManageNews = isAdmin;

  // Fetch Productions
  useEffect(() => {
    const prodQuery = query(collection(db, 'productions'), orderBy('createdAt', 'desc'));
    const unsubscribeProd = onSnapshot(
      prodQuery,
      (snapshot) => {
        const prodData = [];
        const years = new Set();
        const months = new Set();

        snapshot.forEach((doc) => {
          const item = { id: doc.id, ...doc.data() };
          prodData.push(item);

          item.models?.forEach((model) => {
            model.data?.forEach((monthlyData) => {
              years.add(monthlyData.year);
              months.add(monthlyData.month);
            });
          });
        });

        setProductions(prodData);
        setLoading((prev) => ({ ...prev, productions: false }));

        const sortedYears = Array.from(years).sort((a, b) => a - b);
        const initialYear = sortedYears.includes(currentYear)
          ? currentYear
          : sortedYears.length > 0
            ? sortedYears[sortedYears.length - 1]
            : currentYear;

        setSelectedYear(initialYear);

        const monthOptions = getAvailableMonths(prodData, initialYear);
        setAvailableDates({
          years: sortedYears.length > 0 ? sortedYears : [currentYear],
          months: [-1, ...monthOptions],
        });
      },
      (error) => {
        console.error('Error fetching productions:', error);
        setLoading((prev) => ({ ...prev, productions: false }));
      }
    );

    return () => unsubscribeProd();
  }, [currentMonth, currentYear]);

  // Update Available Months
  useEffect(() => {
    const monthOptions = getAvailableMonths(productions, selectedYear);
    setAvailableDates((prev) => ({
      ...prev,
      months: [-1, ...monthOptions],
    }));
  }, [selectedYear, productions]);

  // Utility Functions
  const getAvailableMonths = (prodData, year) => {
    const months = new Set();
    prodData.forEach((item) => {
      item.models?.forEach((model) => {
        model.data?.forEach((monthlyData) => {
          if (monthlyData.year === year) {
            months.add(monthlyData.month);
          }
        });
      });
    });
    return Array.from(months).sort((a, b) => a - b);
  };

  // Render
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4 font-inter text-white">
      <div className="w-full max-w-4xl space-y-6 rounded-xl bg-gray-800 p-8 shadow-lg">
        {/* Header */}
        <div className="mb-6 flex w-full items-center justify-between">
          <h1 className="text-4xl font-extrabold text-emerald-300">
            Production Dashboard
          </h1>
          <button
            onClick={onSignout}
            className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white 
                      transition duration-300 ease-in-out transform hover:scale-105 
                      hover:bg-red-700 focus:outline-none focus:ring-2 
                      focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Signout
          </button>
        </div>

        {/* Production List */}
        {loading.productions ? (
          <p className="text-gray-400">Loading production data...</p>
        ) : (
          <ProductionList
            productions={productions}
            isAdmin={isAdmin}
            onNavigate={onNavigate}
            currentYear={currentYear}
            currentMonth={currentMonth}
            currentDay={currentDay}
          />
        )}

        {/* Export Controls */}
        <ExportControls
          productions={productions}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          availableDates={availableDates}
          reportLoading={reportLoading}
          setReportLoading={setReportLoading}
          excelLoading={excelLoading}
          setExcelLoading={setExcelLoading}
          canAccessReport={canAccessReport}
          canAccessExcel={canAccessExcel}
          canAccessPlan={canAccessPlan}
          onNavigate={onNavigate}
        />

        {/* Announcements */}
        <Announcements user={user} canManageNews={canManageNews} />
      </div>
    </div>
  );
}

export default Dashboard;
