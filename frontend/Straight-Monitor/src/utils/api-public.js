import axios from 'axios';

const apiPublic = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

// Optional: You can add interceptors here if needed, 
// but typically public tokens are passed per-component or via query params.
// If you want to standardize error handling for public pages:
apiPublic.interceptors.response.use(
  res => res,
  err => {
    // Determine if we should handle specific public errors globally
    // For now, just reject so the component handles the error UI
    return Promise.reject(err);
  }
);

export default apiPublic;
