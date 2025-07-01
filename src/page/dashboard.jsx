import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { generateReportPdf } from './report';

const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function Dashboard({ onNavigate, onLogout, user, userRole }) {
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
    const [loadingReport, setLoadingReport] = useState(false);

    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager';
    const isStaff = userRole === 'staff';

    const canAccessNewPlan = isAdmin || isManager;
    const canAccessExcel = isAdmin || isManager || isStaff;
    const canAccessReport = isAdmin || isManager || isStaff;
    const canManageNews = isAdmin || isManager;

    useEffect(() => {
        const productionsQuery = query(collection(db, 'productions'), orderBy('createdAt', 'desc'));
        const unsubscribeProductions = onSnapshot(productionsQuery, (snapshot) => {
            const productionsData = [];
            const yearsSet = new Set();
            const monthsSet = new Set();

            snapshot.forEach((doc) => {
                const item = { id: doc.id, ...doc.data() };
                productionsData.push(item);

                item.models?.forEach(model => {
                    model.data?.forEach(monthlyData => {
                        yearsSet.add(monthlyData.year);
                        monthsSet.add(monthlyData.month);
                    });
                });
            });

            setProductions(productionsData);
            setLoading(prev => ({ ...prev, productions: false }));

            const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);
            const sortedMonths = Array.from(monthsSet).sort((a, b) => a - b);

            let initialYear = currentYear;
            if (sortedYears.length === 0) {
                initialYear = currentYear;
            } else {
                if (!sortedYears.includes(currentYear)) {
                    initialYear = sortedYears[sortedYears.length - 1];
                }
            }

            let initialMonth = -1;
            if (sortedMonths.includes(currentMonth)) {
                initialMonth = currentMonth;
            } else if (sortedMonths.length > 0) {
                initialMonth = sortedMonths[sortedMonths.length - 1];
            }
            
            setSelectedYear(initialYear);
            setSelectedMonth(initialMonth);

            const monthsOptions = [-1, ...sortedMonths];

            setAvailableDates({
                years: sortedYears.length > 0 ? sortedYears : [currentYear],
                months: monthsOptions
            });

        }, (error) => {
            console.error("Error fetching productions:", error);
            setLoading(prev => ({ ...prev, productions: false }));
        });

        return () => unsubscribeProductions();
    }, [currentMonth, currentYear]);


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

    const handleEditNewsClick = (item = null) => {
        if (!canManageNews) {
            console.warn('คุณไม่มีสิทธิ์ในการจัดการประกาศ');
            return;
        }
        setIsEditingNews(true);
        setCurrentNews({
            id: item?.id || null,
            title: item?.title || '',
            message: item?.message || (item?.messages ? item.messages.join('\n') : '')
        });
    };

    const handleCancelEditNews = () => {
        setIsEditingNews(false);
        setCurrentNews({ title: '', message: '', id: null });
    };

    const handleSaveNews = async (event) => {
        event.preventDefault();
        if (currentNews.title.trim() === '' || currentNews.message.trim() === '') {
            console.warn('โปรดกรอกหัวข้อและเนื้อหาประกาศ');
            return;
        }

        const newsPayload = {
            title: currentNews.title,
            message: currentNews.message,
        };

        try {
            if (currentNews.id) {
                await updateDoc(doc(db, 'news', currentNews.id), newsPayload);
                console.log('ประกาศถูกแก้ไขเรียบร้อยแล้ว!');
            } else {
                await addDoc(collection(db, 'news'), {
                    ...newsPayload,
                    createdAt: serverTimestamp(),
                    createdBy: user?.uid || 'anonymous',
                    createdByEmail: user?.email || 'anonymous',
                    date: new Date().toLocaleDateString('th-TH'),
                });
                console.log('ประกาศใหม่ถูกบันทึกเรียบร้อยแล้ว!');
            }
            handleCancelEditNews();
        } catch (e) {
            console.error("Error saving news:", e);
            console.error('เกิดข้อผิดพลาดในการบันทึกประกาศ: ' + e.message);
        }
    };

    const handleDeleteNews = async (newsId) => {
        if (!window.confirm("คุณแน่ใจหรือไม่ที่จะลบประกาศนี้?")) return;
        try {
            await deleteDoc(doc(db, 'news', newsId));
            console.log('ประกาศถูกลบเรียบร้อยแล้ว!');
        } catch (e) {
            console.error("Error deleting news:", e);
            console.error('เกิดข้อผิดพลาดในการลบประกาศ: ' + e.message);
        }
    };

    const handleDeleteProduction = async (productionId) => {
        if (!isAdmin) {
            console.warn('คุณไม่มีสิทธิ์ในการลบรายการผลิตนี้');
            alert('คุณไม่มีสิทธิ์ในการลบรายการผลิตนี้');
            return;
        }
        if (!window.confirm("คุณแน่ใจหรือไม่ที่จะลบรายการผลิตนี้? ข้อมูลทั้งหมดที่เกี่ยวข้องจะถูกลบออกด้วย!")) return;
        try {
            await deleteDoc(doc(db, 'productions', productionId));
            console.log('รายการผลิตถูกลบเรียบร้อยแล้ว!');
        } catch (e) {
            console.error("Error deleting production:", e);
            alert('เกิดข้อผิดพลาดในการลบรายการผลิต: ' + e.message);
        }
    };

    const handleExportReport = async () => {
        if (productions.length === 0) {
            console.warn("ไม่มีข้อมูลการผลิตที่จะสร้างรายงาน.");
            alert("ไม่มีข้อมูลการผลิตที่จะสร้างรายงาน โปรดเพิ่มข้อมูลการผลิตก่อน");
            return;
        }

        setLoadingReport(true);
        try {
            const productionsForReport = productions.map(productionItem => {
                const newProductionItem = JSON.parse(JSON.stringify(productionItem));

                if (newProductionItem.models && Array.isArray(newProductionItem.models)) {
                    newProductionItem.models = newProductionItem.models.map(model => {
                        const safeModelData = Array.isArray(model?.data) ? model.data : [];

                        let filteredMonthlyData = safeModelData.filter(d => d.year === selectedYear);

                        if (selectedMonth !== -1) {
                            filteredMonthlyData = filteredMonthlyData.filter(d => d.month === selectedMonth);
                        }
                        return { ...model, data: filteredMonthlyData };
                    });
                } else {
                    newProductionItem.models = [];
                }
                return newProductionItem;
            }).filter(pItem => pItem.models && pItem.models.length > 0);

            await generateReportPdf(productionsForReport, selectedMonth, selectedYear);
            console.log("Report generation complete and download initiated.");
        } catch (error) {
            console.error("Error generating report:", error);
            alert("เกิดข้อผิดพลาดในการสร้างรายงาน: " + error.message);
        } finally {
            setLoadingReport(false);
        }
    };

    const getModelStatusColorClass = (modelData) => {
        const monthlyData = modelData?.find(data => data.year === currentYear && data.month === currentMonth);
        if (monthlyData && monthlyData.data) {
            const hasDataForToday = Object.values(monthlyData.data).some(
                (statusArray) => statusArray.some(
                    (dailyData) => dailyData.day === currentDay && dailyData.value !== 0 && dailyData.value !== null && dailyData.value !== undefined && String(dailyData.value).trim() !== ''
                )
            );
            return hasDataForToday ? 'text-green-400' : 'text-yellow-300';
        }
        return 'text-yellow-300';
    };

    const hasProductionData = productions.length > 0;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 font-inter">
            <div className="bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-4xl flex flex-col items-center space-y-6">
                <div className="w-full flex justify-between items-center mb-6">
                    <h1 className="text-4xl font-extrabold text-emerald-300">
                        แผงควบคุมการผลิต
                    </h1>
                    <button
                        onClick={onLogout}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg
                                         transition duration-300 ease-in-out transform hover:scale-105
                                         focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    >
                        ออกจากระบบ
                    </button>
                </div>

                <div className="w-full bg-gray-700 p-6 rounded-lg border border-emerald-700">
                    <h2 className="text-2xl font-bold text-blue-400 mb-4">ประกาศสำคัญ</h2>
                    {isEditingNews && canManageNews ? (
                        <form onSubmit={handleSaveNews} className="space-y-4">
                            <div>
                                <label htmlFor="newsTitle" className="block text-gray-300 text-sm font-bold mb-1">หัวข้อ:</label>
                                <input
                                    id="newsTitle"
                                    type="text"
                                    value={currentNews.title}
                                    onChange={(e) => setCurrentNews(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="หัวข้อประกาศ"
                                    className="p-2 rounded-lg border border-gray-500 bg-gray-700 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="newsMessage" className="block text-gray-300 text-sm font-bold mb-1">เนื้อหา:</label>
                                <textarea
                                    id="newsMessage"
                                    value={currentNews.message}
                                    onChange={(e) => setCurrentNews(prev => ({ ...prev, message: e.target.value }))}
                                    placeholder="พิมพ์เนื้อหาประกาศที่นี่..."
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
                                    บันทึก
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelEditNews}
                                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg flex-grow
                                         transition duration-300 ease-in-out transform hover:scale-105"
                                >
                                    ยกเลิก
                                </button>
                            </div>
                        </form>
                    ) : (
                        <>
                            {loading.news ? (
                                <p className="text-gray-400">กำลังโหลดประกาศ...</p>
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
                                                        onClick={() => handleEditNewsClick(item)}
                                                        className="absolute top-3 right-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-1.5 px-3 rounded-md
                                                        opacity-0 group-hover:opacity-100 transition-opacity duration-200 transform hover:scale-105"
                                                    >
                                                        แก้ไข
                                                    </button>
                                                )}
                                                {canManageNews && (
                                                    <button
                                                        onClick={() => handleDeleteNews(item.id)}
                                                        className="absolute top-3 right-20 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1.5 px-3 rounded-md
                                                        opacity-0 group-hover:opacity-100 transition-opacity duration-200 transform hover:scale-105"
                                                    >
                                                        ลบ
                                                    </button>
                                                )}

                                                <h3 className="font-semibold text-purple-300 text-lg mb-2">{item.title}</h3>
                                                <p className="text-gray-300 whitespace-pre-wrap">
                                                    {item.message || item.messages?.join('\n') || 'ไม่มีเนื้อหา'}
                                                </p>
                                                <br />
                                                {item.createdAt && (
                                                    <p className="text-gray-400 text-sm mb-2">
                                                        [{new Date(item.createdAt.seconds * 1000).toLocaleDateString('th-TH')}]
                                                    </p>
                                                )}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-gray-400">ยังไม่มีประกาศใหม่ในขณะนี้</li>
                                    )}
                                </ul>
                            )}
                            {canManageNews && !isEditingNews && (
                                <button
                                    onClick={() => handleEditNewsClick()}
                                    className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg w-full
                                         transition duration-300 ease-in-out transform hover:scale-105
                                         focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                >
                                    เพิ่มประกาศใหม่
                                </button>
                            )}
                        </>
                    )}
                </div>

                <div className="w-full bg-gray-700 p-6 rounded-lg border border-emerald-700">
                    <h2 className="text-2xl font-bold text-blue-400 mb-4">รายการการผลิต</h2>
                    {loading.productions ? (
                        <p className="text-gray-400">กำลังโหลดข้อมูลการผลิต...</p>
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
                                                    handleDeleteProduction(item.id);
                                                }}
                                                className="absolute top-3 right-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1.5 px-3 rounded-md
                                                opacity-0 group-hover:opacity-100 transition-opacity duration-200 transform hover:scale-105"
                                            >
                                                ลบ
                                            </button>
                                        )}
                                        <p className="text-gray-300 mb-1">
                                            <span className="font-semibold text-blue-300">ผู้รับผิดชอบ:</span> {item.responsiblePerson || 'ไม่ได้ระบุ'}
                                        </p>
                                        <p className="text-gray-300 mb-3">{item.description}</p>
                                        {item.models && item.models.length > 0 && (
                                            <>
                                                <p className="font-semibold text-gray-300 mt-3 mb-1">รายการรุ่น:</p>
                                                <ul className="list-disc list-inside text-gray-400 space-y-1 ml-4">
                                                    {item.models.map((model, index) => (
                                                        <li key={index}>
                                                            <span className={`font-medium ${getModelStatusColorClass(model.data)}`}>
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
                                <p className="text-gray-400">ยังไม่มีข้อมูลการผลิต</p>
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
                                transition duration-300 ease-in-out transform hover:scale-105
                                ${!hasProductionData ? 'bg-gray-600 text-gray-400' : 'bg-gray-700 text-white'}`}
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                disabled={!hasProductionData && selectedMonth !== -1 || loadingReport}
                            >
                                <option key="report-month--1" value={-1}>ทุกเดือน</option>
                                {availableDates.months
                                    .filter(monthNum => monthNum !== -1)
                                    .map((monthNum) => (
                                        <option key={`report-month-${monthNum}`} value={monthNum}>
                                            {thaiMonths[monthNum]}
                                        </option>
                                    ))
                                }
                                {availableDates.months.length === 1 && availableDates.months[0] === -1 && productions.length === 0 &&
                                    <option value="" disabled>ไม่มีข้อมูลเดือน</option>
                                }
                            </select>
                            <select
                                id="report-year-select"
                                className={`p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1
                                transition duration-300 ease-in-out transform hover:scale-105
                                ${!hasProductionData ? 'bg-gray-600 text-gray-400' : 'bg-gray-700 text-white'}`}
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                disabled={availableDates.years.length <= 1 && availableDates.years[0] === currentYear && !hasProductionData || loadingReport}
                            >
                                {availableDates.years.map((year) => (
                                    <option key={`report-year-${year}`} value={year}>
                                        {year + 543}
                                    </option>
                                ))}
                                {!hasProductionData && <option value="" disabled>ไม่มีข้อมูลปี</option>}
                            </select>
                            <button
                                className={`font-bold py-4 px-6 rounded-lg transition duration-300 ease-in-out transform flex-1
                                ${hasProductionData || selectedMonth === -1 ? 'bg-blue-600 hover:bg-blue-700 hover:scale-105 focus:ring-blue-500' : 'bg-gray-500'}
                                text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800`}
                                onClick={handleExportReport}
                                disabled={!hasProductionData && selectedMonth !== -1 || loadingReport}
                            >
                                {loadingReport ? 'กำลังสร้าง...' : 'ส่งออกรายงาน'}
                            </button>
                        </>
                    )}
                    {canAccessExcel && (
                        <button
                            className={`font-bold py-4 px-6 rounded-lg transition duration-300 ease-in-out transform flex-1
                            ${!hasProductionData || loadingReport
                                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 hover:scale-105 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800'
                            }
                            text-white focus:outline-none focus:ring-2`}
                            disabled={!hasProductionData || loadingReport}
                        >
                            ส่งออก Excel
                        </button>
                    )}
                    {canAccessNewPlan && (
                        <button
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6
                            rounded-lg transition duration-300 ease-in-out transform
                            hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex-1"
                            onClick={() => onNavigate('/new_plan')}
                            disabled={loadingReport}
                        >
                            แผนการผลิต
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
