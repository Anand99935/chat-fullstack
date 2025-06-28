const KEY = 'unreadCounts';

export const getUnreadCounts = () => {
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export const setUnreadCount = (username, count) => {
  const counts = getUnreadCounts();
  counts[username] = count;
  localStorage.setItem(KEY, JSON.stringify(counts));
};

export const incrementUnreadCount = (username) => {
  const counts = getUnreadCounts();
  counts[username] = (counts[username] || 0) + 1;
  localStorage.setItem(KEY, JSON.stringify(counts));
};

export const resetUnreadCount = (username) => {
  const counts = getUnreadCounts();
  counts[username] = 0;
  localStorage.setItem(KEY, JSON.stringify(counts));
}; 