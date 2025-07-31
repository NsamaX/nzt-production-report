import React from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ProductionList Component
function ProductionList({
  productions,
  isAdmin,
  onNavigate,
  currentYear,
  currentMonth,
  currentDay,
}) {
  // Handlers
  const handleProdDelete = async (prodId) => {
    if (!isAdmin) {
      console.warn('You do not have permission to delete this production item.');
      alert('You do not have permission to delete this production item.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this production item? All related data will be deleted as well!')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'productions', prodId));
      console.log('Production item deleted successfully!');
    } catch (error) {
      console.error('Error deleting production:', error);
      alert(`An error occurred while deleting the production item: ${error.message}`);
    }
  };

  const getModelColor = (modelData) => {
    const monthlyData = modelData?.find(
      (data) => data.year === currentYear && data.month === currentMonth
    );

    if (monthlyData && monthlyData.data) {
      const hasDataForToday = Object.values(monthlyData.data).some((statusArray) =>
        statusArray.some(
          (dailyData) =>
            dailyData.day === currentDay &&
            dailyData.value !== 0 &&
            dailyData.value !== null &&
            dailyData.value !== undefined &&
            String(dailyData.value).trim() !== ''
        )
      );
      return hasDataForToday ? 'text-green-400' : 'text-gray-400';
    }

    return 'text-gray-400';
  };

  // Render
  return (
    <div className="w-full bg-gray-700 p-6 rounded-lg border border-emerald-700">
      {productions.length > 0 ? (
        <div className="space-y-6">
          {productions.map((item) => (
            <div
              key={item.id}
              className="relative cursor-pointer rounded-lg border border-gray-600 
                        bg-gray-800 p-5 shadow-md transition duration-200 
                        ease-in-out hover:bg-gray-700"
              onClick={() => onNavigate('/production', item.id)}
            >
              <div className="flex items-center justify-between">
                <h3 className="mb-2 text-xl font-bold text-emerald-300">{item.plant}</h3>
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProdDelete(item.id);
                    }}
                    className="rounded-md px-3 py-1.5 text-sm font-bold text-white 
                              transition duration-200 transform hover:scale-105"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="mb-3 text-gray-300">{item.description}</p>
              {item.models && item.models.length > 0 && (
                <>
                  <p className="mb-1 mt-3 font-semibold text-gray-300">Model List:</p>
                  <ul className="ml-4 list-inside list-disc space-y-1 text-gray-400">
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
          ))}
        </div>
      ) : (
        <p className="text-gray-400">No production data yet.</p>
      )}
    </div>
  );
}

export default ProductionList;
