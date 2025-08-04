import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Announcements Component
function Announcements({ user, canManageNews }) {
  // State Management
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditingNews, setIsEditingNews] = useState(false);
  const [currentNews, setCurrentNews] = useState({ 
    title: '', 
    message: '', 
    id: null 
  });

  // Fetch announcements from Firestore
  useEffect(() => {
    const newsQuery = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsubscribeNews = onSnapshot(
      newsQuery, 
      (snapshot) => {
        const newsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setNews(newsData);
        setLoading(false);
      }, 
      (error) => {
        console.error('Error fetching news:', error);
        setLoading(false);
      }
    );

    return () => unsubscribeNews();
  }, []);

  // Handlers for editing news
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

  // Save or update announcement
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
    } catch (error) {
      console.error('Error saving news:', error);
      console.error('An error occurred while saving the announcement:', error.message);
    }
  };

  // Delete announcement
  const handleNewsDelete = async (newsId) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    
    try {
      await deleteDoc(doc(db, 'news', newsId));
      console.log('Announcement deleted successfully!');
    } catch (error) {
      console.error('Error deleting news:', error);
      console.error('An error occurred while deleting the announcement:', error.message);
    }
  };

  // Render
  return (
    <div className="w-full bg-gray-700 p-6 rounded-lg border border-emerald-700">
      <h2 className="text-2xl font-bold text-blue-400 mb-4">Important Announcements</h2>

      {/* Edit Form */}
      {isEditingNews && canManageNews ? (
        <form onSubmit={handleNewsSave} className="space-y-4">
          <div>
            <label htmlFor="newsTitle" className="block text-gray-300 text-sm font-bold mb-1">
              Title:
            </label>
            <input
              id="newsTitle"
              type="text"
              value={currentNews.title}
              onChange={(e) => setCurrentNews(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Announcement Title"
              className="w-full p-2 rounded-lg border border-gray-500 bg-gray-700 text-white 
                        focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="newsMessage" className="block text-gray-300 text-sm font-bold mb-1">
              Content:
            </label>
            <textarea
              id="newsMessage"
              value={currentNews.message}
              onChange={(e) => setCurrentNews(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Type announcement content here..."
              rows="5"
              className="w-full p-2 rounded-lg border border-gray-500 bg-gray-700 text-white 
                        resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex space-x-2">
            <button
              type="submit"
              className="flex-grow bg-emerald-600 hover:bg-emerald-700 text-white font-bold 
                        py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancelNewsEdit}
              className="flex-grow bg-gray-600 hover:bg-gray-700 text-white font-bold 
                        py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Announcements List */}
          {loading ? (
            <p className="text-gray-400">Loading announcements...</p>
          ) : (
            <ul className="space-y-3">
              {news.length > 0 ? (
                news.map((item) => (
                  <li
                    key={item.id}
                    className="relative bg-gray-800 p-3 rounded-md border border-gray-600 shadow-sm group"
                  >
                    {canManageNews && (
                      <>
                        <button
                          onClick={() => handleNewsEdit(item)}
                          className="absolute top-3 right-3 bg-blue-600 hover:bg-blue-700 text-white 
                                    text-sm font-bold py-1.5 px-3 rounded-md opacity-0 group-hover:opacity-100 
                                    transition-opacity duration-200 transform hover:scale-105"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleNewsDelete(item.id)}
                          className="absolute top-3 right-20 bg-red-600 hover:bg-red-700 text-white 
                                    text-sm font-bold py-1.5 px-3 rounded-md opacity-0 group-hover:opacity-100 
                                    transition-opacity duration-200 transform hover:scale-105"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    <h3 className="font-semibold text-purple-300 text-lg mb-2">{item.title}</h3>
                    <p className="text-gray-300 whitespace-pre-wrap">
                      {item.message || item.messages?.join('\n') || 'No content'}
                    </p>
                    {item.createdAt && (
                      <p className="text-gray-400 text-sm mt-2">
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

          {/* Add New Announcement Button */}
          {canManageNews && !isEditingNews && (
            <button
              onClick={() => handleNewsEdit()}
              className="mt-4 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold 
                        py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 
                        focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 
                        focus:ring-offset-gray-800"
            >
              Add New Announcement
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default Announcements;
