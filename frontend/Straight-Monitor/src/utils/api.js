import axios from 'axios';

const api = axios.create({
    baseURL: "https://straight-monitor-684d4006140b.herokuapp.com",
    withCredentials: true,
});

export default api;