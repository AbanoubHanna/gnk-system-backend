// src/api.js
import axios from 'axios';

// ده رابط سيرفر الـ Node.js بتاعك (تأكد إنه شغال)
const API_URL = 'https://eshterikly.com/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// إضافة الـ Token لأي طلب رايح للباك إند (لو مسجل دخول)
api.interceptors.request.use((config) => {
  const userStr = sessionStorage.getItem('gnk_user');
  if (userStr) {
    const user = JSON.parse(userStr);
    if (user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
  }
  return config;
});

export default api;
