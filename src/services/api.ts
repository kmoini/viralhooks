import axios from 'axios';

// =============================================
// ⚠️  REPLACE the IP below with YOUR computer's
//     LAN IP so your iPhone can reach the server.
//
//  How to find it:
//    1. Open Command Prompt
//    2. Run:  ipconfig
//    3. Find "Wi-Fi" → "IPv4 Address"
//       (e.g. 192.168.1.42)
//    4. Paste it below instead of 192.168.1.XXX
// =============================================

const BASE_URL = 'http://192.168.2.75:3001';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

export default api;
