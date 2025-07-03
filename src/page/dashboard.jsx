import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

import { getReport } from './get_report';
import { exportExcel } from './export_excel';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function Dashboard({ onNavigate, onSignout, user, userRole }) {
    const today = useMemo(() => new Date(), []);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    const [productions, setProductions] = useState([]);
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState({ productions: true, news: true });

    const [isEditingNews, setIsEditingNews] = useState(false);
    const [currentNews, setCurrentNews] = useState({ title: '', message: '', id: null });

    const [selectedMonth, setSelectedMonth] = useState(-1);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [availableDates, setAvailableDates] = useState({ months: [], years: [] });
    const [reportLoading, setReportLoading] = useState(false);
    const [excelLoading, setExcelLoading] = useState(false);

    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager';

    const canAccessPlan = isAdmin;
    const canAccessExcel = isAdmin || isManager;
    const canAccessReport = isAdmin || isManager;
    const canManageNews = isAdmin;

    useEffect(() => {
        const prodQuery = query(collection(db, 'productions'), orderBy('createdAt', 'desc'));
        const unsubscribeProd = onSnapshot(prodQuery, (snapshot) => {
            const prodData = [];
            const years = new Set();
            const months = new Set();

            snapshot.forEach((doc) => {
                const item = { id: doc.id, ...doc.data() };
                prodData.push(item);

                item.models?.forEach(model => {
                    model.data?.forEach(monthlyData => {
                        years.add(monthlyData.year);
                        months.add(monthlyData.month);
                    });
                });
            });

            setProductions(prodData);
            setLoading(prev => ({ ...prev, productions: false }));

            const sortedYears = Array.from(years).sort((a, b) => a - b);

            let initialYear = currentYear;
            if (!sortedYears.includes(currentYear) && sortedYears.length > 0) {
                initialYear = sortedYears[sortedYears.length - 1];
            }

            setSelectedYear(initialYear);

            const monthOptions = getAvailableMonths(prodData, initialYear);

            setAvailableDates({
                years: sortedYears.length > 0 ? sortedYears : [currentYear],
                months: [-1, ...monthOptions]
            });

        }, (error) => {
            console.error("Error fetching productions:", error);
            setLoading(prev => ({ ...prev, productions: false }));
        });

        return () => unsubscribeProd();
    }, [currentMonth, currentYear]);

    useEffect(() => {
        const monthOptions = getAvailableMonths(productions, selectedYear);
        setAvailableDates(prev => ({
            ...prev,
            months: [-1, ...monthOptions]
        }));
    }, [selectedYear, productions]);

    const getAvailableMonths = (prodData, year) => {
        const months = new Set();
        prodData.forEach(item => {
            item.models?.forEach(model => {
                model.data?.forEach(monthlyData => {
                    if (monthlyData.year === year) {
                        months.add(monthlyData.month);
                    }
                });
            });
        });
        return Array.from(months).sort((a, b) => a - b);
    };

    useEffect(() => {
        const newsQuery = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
        const unsubscribeNews = onSnapshot(newsQuery, (snapshot) => {
            const newsData = [];
            snapshot.forEach((doc) => newsData.push({ id: doc.id, ...doc.data() }));
            setNews(newsData);
            setLoading(prev => ({ ...prev, news: false }));
        }, (error) => {
            console.error("Error fetching news:", error);
            setLoading(prev => ({ ...prev, news: false }));
        });

        return () => unsubscribeNews();
    }, []);

    const handleNewsEdit = (item = null) => {
        if (!canManageNews) {
            console.warn('You do not have permission to manage announcements.');
            return;
        }
        setIsEditingNews(true);
        setCurrentNews({
            id: item?.id || null,
            title: item?.title || '',
            message: item?.message || (item?.messages ? item.messages.join('\n') : '')
        });
    };

    const handleCancelNewsEdit = () => {
        setIsEditingNews(false);
        setCurrentNews({ title: '', message: '', id: null });
    };

    const handleNewsSave = async (event) => {
        event.preventDefault();
        if (currentNews.title.trim() === '' || currentNews.message.trim() === '') {
            console.warn('Please enter both title and message for the announcement.');
            return;
        }

        const payload = {
            title: currentNews.title,
            message: currentNews.message,
        };

        try {
            if (currentNews.id) {
                await updateDoc(doc(db, 'news', currentNews.id), payload);
                console.log('Announcement updated successfully!');
            } else {
                await addDoc(collection(db, 'news'), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    createdBy: user?.uid || 'anonymous',
                    createdByEmail: user?.email || 'anonymous',
                    date: new Date().toLocaleDateString('en-US'),
                });
                console.log('New announcement saved successfully!');
            }
            handleCancelNewsEdit();
        } catch (e) {
            console.error("Error saving news:", e);
            console.error('An error occurred while saving the announcement: ' + e.message);
        }
    };

    const handleNewsDelete = async (newsId) => {
        if (!window.confirm("Are you sure you want to delete this announcement?")) return;
        try {
            await deleteDoc(doc(db, 'news', newsId));
            console.log('Announcement deleted successfully!');
        } catch (e) {
            console.error("Error deleting news:", e);
            console.error('An error occurred while deleting the announcement: ' + e.message);
        }
    };

    const handleProdDelete = async (prodId) => {
        if (!isAdmin) {
            console.warn('You do not have permission to delete this production item.');
            alert('You do not have permission to delete this production item.');
            return;
        }
        if (!window.confirm("Are you sure you want to delete this production item? All related data will be deleted as well!")) return;
        try {
            await deleteDoc(doc(db, 'productions', prodId));
            console.log('Production item deleted successfully!');
        } catch (e) {
            console.error("Error deleting production:", e);
            alert('An error occurred while deleting the production item: ' + e.message);
        }
    };

    const handleReportExport = async () => {
        if (productions.length === 0) {
            console.warn("No production data to generate a report.");
            alert("No production data to generate a report. Please add production data first.");
            return;
        }

        setReportLoading(true);
        try {
            const prodsForReport = productions.map(prodItem => {
                const newProdItem = JSON.parse(JSON.stringify(prodItem));

                if (newProdItem.models && Array.isArray(newProdItem.models)) {
                    newProdItem.models = newProdItem.models.map(model => {
                        const safeModelData = Array.isArray(model?.data) ? model.data : [];

                        let filteredMonthlyData = safeModelData.filter(d => d.year === selectedYear);

                        if (selectedMonth !== -1) {
                            filteredMonthlyData = filteredMonthlyData.filter(d => d.month === selectedMonth);
                        }
                        return { ...model, data: filteredMonthlyData };
                    });
                } else {
                    newProdItem.models = [];
                }
                return newProdItem;
            }).filter(pItem => pItem.models && pItem.models.length > 0);

            await getReport(prodsForReport, selectedMonth, selectedYear);
            console.log("Report generation complete and download initiated.");
        } catch (error) {
            console.error("Error generating report:", error);
            alert("An error occurred while generating the report: " + error.message);
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
        if (productions.length === 0) {
            console.warn("No production data to export to Excel.");
            alert("No production data to export to Excel. Please add production data first.");
            return;
        }

        setExcelLoading(true);
        try {
            await exportExcel(productions, selectedMonth, selectedYear);
            console.log("Excel export complete and download initiated.");
        } catch (error) {
            console.error("Error exporting Excel:", error);
            alert("An error occurred while exporting Excel: " + error.message);
        } finally {
            setExcelLoading(false);
        }
    };

    const getModelColor = (modelData) => {
        const monthlyData = modelData?.find(data => data.year === currentYear && data.month === currentMonth);
        if (monthlyData && monthlyData.data) {
            const hasDataForToday = Object.values(monthlyData.data).some(
                (statusArray) => statusArray.some(
                    (dailyData) => dailyData.day === currentDay && dailyData.value !== 0 && dailyData.value !== null && dailyData.value !== undefined && String(dailyData.value).trim() !== ''
                )
            );
            return hasDataForToday ? 'text-green-400' : 'text-gray-400';
        }
        return 'text-gray-400';
    };

    const hasProdData = productions.length > 0;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 font-inter">
            <div className="bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-4xl flex flex-col items-center space-y-6">
                <div className="w-full flex justify-between items-center mb-6">
                    <h1 className="text-4xl font-extrabold text-emerald-300">
                        Production Dashboard
                    </h1>
                    <button
                        onClick={onSignout}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg
                                       transition duration-300 ease-in-out transform hover:scale-105
                                       focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    >
                        Signout
                    </button>
                </div>
                <div className="w-full bg-gray-700 p-6 rounded-lg border border-emerald-700">
                    {loading.productions ? (
                        <p className="text-gray-400">Loading production data...</p>
                    ) : (
                        <div className="space-y-6">
                            {productions.length > 0 ? (
                                productions.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-gray-800 p-5 rounded-lg border border-gray-600 shadow-md
                                            cursor-pointer hover:bg-gray-700 transition duration-200 ease-in-out relative group"
                                        onClick={() => onNavigate('/production', item.id)}
                                    >
                                        <h3 className="text-xl font-bold text-emerald-300 mb-2">{item.plant}</h3>
                                        {isAdmin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleProdDelete(item.id);
                                                }}
                                                className="absolute top-3 right-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1.5 px-3 rounded-md
                                                opacity-0 group-hover:opacity-100 transition-opacity duration-200 transform hover:scale-105"
                                            >
                                                Delete
                                            </button>
                                        )}
                                        <p className="text-gray-300 mb-3">{item.description}</p>
                                        {item.models && item.models.length > 0 && (
                                            <>
                                                <p className="font-semibold text-gray-300 mt-3 mb-1">Model List:</p>
                                                <ul className="list-disc list-inside text-gray-400 space-y-1 ml-4">
                                                    {item.models.map((model, index) => (
                                                        <li key={index}>
                                                            <span className={`font-medium ${getModelColor(model.data)}`}>
                                                                {model.name}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400">No production data yet.</p>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full justify-stretch mt-4">
                    {canAccessReport && (
                        <>
                            <select
                                id="report-month-select"
                                className={`p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1
                                ${!hasProdData ? 'bg-gray-600 text-gray-400' : 'bg-gray-700 text-white transition duration-300 ease-in-out transform hover:scale-105'}`}
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                disabled={!hasProdData || reportLoading || excelLoading}
                            >
                                <option key="report-month--1" value={-1}>Entire year</option>
                                {availableDates.months
                                    .filter(monthNum => monthNum !== -1)
                                    .map((monthNum) => (
                                        <option key={`report-month-${monthNum}`} value={monthNum}>
                                            {MONTHS[monthNum]}
                                        </option>
                                    ))
                                }
                                {availableDates.months.length === 1 && availableDates.months[0] === -1 && productions.length === 0 &&
                                    <option value="" disabled>No month data</option>
                                }
                            </select>
                            <select
                                id="report-year-select"
                                className={`p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1
                                ${!hasProdData ? 'bg-gray-600 text-gray-400' : 'bg-gray-700 text-white transition duration-300 ease-in-out transform hover:scale-105'}`}
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                disabled={availableDates.years.length <= 1 && availableDates.years[0] === currentYear && !hasProdData || reportLoading || excelLoading}
                            >
                                {availableDates.years.map((year) => (
                                    <option key={`report-year-${year}`} value={year}>
                                        {year}
                                    </option>
                                ))}
                                {!hasProdData && <option value="" disabled>No year data</option>}
                            </select>
                            <button
                                className={`font-bold py-4 px-6 rounded-lg transition duration-300 ease-in-out transform flex-1
                                ${hasProdData && !reportLoading && !excelLoading ? 'bg-blue-600 hover:bg-blue-700 hover:scale-105 focus:ring-blue-500' : 'bg-gray-500'}
                                text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800`}
                                onClick={handleReportExport}
                                disabled={!hasProdData || reportLoading || excelLoading}
                            >
                                {reportLoading ? 'Generating...' : 'Export Report'}
                            </button>
                        </>
                    )}
                    {canAccessExcel && (
                        <button
                            className={`font-bold py-4 px-6 rounded-lg transition duration-300 ease-in-out transform flex-1
                            ${hasProdData && !reportLoading && !excelLoading
                                ? 'bg-green-600 hover:bg-green-700 hover:scale-105 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800'
                                : 'bg-gray-500 text-gray-300'
                            }
                            text-white focus:outline-none focus:ring-2`}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            onClick={handleExcelExport}
                            disabled={!hasProdData || reportLoading || excelLoading}
                        >
                            {excelLoading ? 'Exporting...' : 'Export Excel'}
                        </button>
                    )}
                    {canAccessPlan && (
                        <button
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6
                            rounded-lg transition duration-300 ease-in-out transform
                            hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex-1"
                            onClick={() => onNavigate('/new_plan')}
                            disabled={reportLoading || excelLoading}
                        >
                            Production
                        </button>
                    )}
                </div>
                <div className="w-full bg-gray-700 p-6 rounded-lg border border-emerald-700">
                    <h2 className="text-2xl font-bold text-blue-400 mb-4">Important Announcements</h2>
                    {isEditingNews && canManageNews ? (
                        <form onSubmit={handleNewsSave} className="space-y-4">
                            <div>
                                <label htmlFor="newsTitle" className="block text-gray-300 text-sm font-bold mb-1">Title:</label>
                                <input
                                    id="newsTitle"
                                    type="text"
                                    value={currentNews.title}
                                    onChange={(e) => setCurrentNews(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Announcement Title"
                                    className="p-2 rounded-lg border border-gray-500 bg-gray-700 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="newsMessage" className="block text-gray-300 text-sm font-bold mb-1">Content:</label>
                                <textarea
                                    id="newsMessage"
                                    value={currentNews.message}
                                    onChange={(e) => setCurrentNews(prev => ({ ...prev, message: e.target.value }))}
                                    placeholder="Type announcement content here..."
                                    rows="5"
                                    className="p-2 rounded-lg border border-gray-500 bg-gray-700 text-white w-full resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                ></textarea>
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    type="submit"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg flex-grow
                                             transition duration-300 ease-in-out transform hover:scale-105"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelNewsEdit}
                                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg flex-grow
                                             transition duration-300 ease-in-out transform hover:scale-105"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    ) : (
                        <>
                            {loading.news ? (
                                <p className="text-gray-400">Loading announcements...</p>
                            ) : (
                                <ul className="space-y-3">
                                    {news.length > 0 ? (
                                        news.map((item) => (
                                            <li
                                                key={item.id}
                                                className="bg-gray-800 p-3 rounded-md border border-gray-600 shadow-sm
                                                relative group"
                                            >
                                                {canManageNews && (
                                                    <button
                                                        onClick={() => handleNewsEdit(item)}
                                                        className="absolute top-3 right-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-1.5 px-3 rounded-md
                                                        opacity-0 group-hover:opacity-100 transition-opacity duration-200 transform hover:scale-105"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                {canManageNews && (
                                                    <button
                                                        onClick={() => handleNewsDelete(item.id)}
                                                        className="absolute top-3 right-20 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1.5 px-3 rounded-md
                                                        opacity-0 group-hover:opacity-100 transition-opacity duration-200 transform hover:scale-105"
                                                    >
                                                        Delete
                                                    </button>
                                                )}

                                                <h3 className="font-semibold text-purple-300 text-lg mb-2">{item.title}</h3>
                                                <p className="text-gray-300 whitespace-pre-wrap">
                                                    {item.message || item.messages?.join('\n') || 'No content'}
                                                </p>
                                                <br />
                                                {item.createdAt && (
                                                    <p className="text-gray-400 text-sm mb-2">
                                                        [{new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-US')}]
                                                    </p>
                                                )}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-gray-400">No new announcements at this time.</li>
                                    )}
                                </ul>
                            )}
                            {canManageNews && !isEditingNews && (
                                <button
                                    onClick={() => handleNewsEdit()}
                                    className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg w-full
                                             transition duration-300 ease-in-out transform hover:scale-105
                                             focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                >
                                    Add New Announcement
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
