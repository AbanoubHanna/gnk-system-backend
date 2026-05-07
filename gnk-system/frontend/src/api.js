import axios from 'axios';

// هنا بنقوله: لو إنت مرفوع أونلاين استخدم اللينك بتاع Render، ولو على الجهاز استخدم Localhost
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: baseURL,
});

export default api;