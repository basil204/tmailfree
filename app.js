const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const axios = require('axios');
const path = require('path');

const app = express();

const API_KEY = 'QLNiaP7mmXtfWCcwnhao6dSoLT2xVvE';
const API_BASE = 'https://tmail.mekongmmo.com/api';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);
app.set('layout', 'layout');

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const allowedDomains = ['manhnl.dev', 'userdhieu.id.vn', 'phimmoichillf.com'];

// Trang chủ
app.get('/', (req, res) => {
  const domains = allowedDomains.map(d => ({ domain: d, type: 'Free' }));
  res.render('index', { domains, title: 'Danh sách Domains', error: null });
});

// Form tạo email
app.get('/create-email', (req, res) => {
  res.render('create_email', { domains: allowedDomains, error: null, title: 'Tạo Email Mới' });
});

// POST tạo email - trả JSON
app.post('/create-email', async (req, res) => {
  let { username, domain } = req.body;

  // Nếu domain không chọn hoặc không hợp lệ thì random domain
  if (!domain || !allowedDomains.includes(domain)) {
    const randomIndex = Math.floor(Math.random() * allowedDomains.length);
    domain = allowedDomains[randomIndex];
  }

  try {
    const createResp = await axios.post(`${API_BASE}/emails/${API_KEY}`);
    if (!createResp.data.status) {
      return res.status(500).json({ success: false, message: 'Tạo email thất bại ở bước tạo mặc định' });
    }

    let finalEmailData = createResp.data.data;

    if (username && username.trim() !== '') {
      username = username.trim();

      if (!/^[a-zA-Z0-9._%+-]+$/.test(username)) {
        return res.status(400).json({ success: false, message: 'Username chứa ký tự không hợp lệ' });
      }

      const oldEmail = finalEmailData.email;
      const updateResp = await axios.post(`${API_BASE}/emails/${API_KEY}/${encodeURIComponent(oldEmail)}/${encodeURIComponent(username)}/${encodeURIComponent(domain)}`);

      if (!updateResp.data.status) {
        return res.status(500).json({ success: false, message: 'Cập nhật email thất bại' });
      }

      finalEmailData = updateResp.data.data;
    } else {
      // Nếu username trống, check domain có khác domain mặc định API không để update domain
      if (finalEmailData.domain !== domain) {
        const oldEmail = finalEmailData.email;
        const oldUsername = oldEmail.split('@')[0];
        const updateResp = await axios.post(`${API_BASE}/emails/${API_KEY}/${encodeURIComponent(oldEmail)}/${encodeURIComponent(oldUsername)}/${encodeURIComponent(domain)}`);

        if (!updateResp.data.status) {
          return res.status(500).json({ success: false, message: 'Cập nhật domain email thất bại' });
        }

        finalEmailData = updateResp.data.data;
      }
    }

    res.json({ success: true, email: finalEmailData });

  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi kết nối API' });
  }
});

// Trang emails đọc từ localStorage
app.get('/emails', (req, res) => {
  res.render('emails_localstorage', { title: 'Danh sách Email đã tạo' });
});

// API lấy số lượng messages và OTP cho email
app.get('/api/email-info/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const response = await axios.get(`${API_BASE}/messages/${API_KEY}/${email}`);
    if (!response.data.status) return res.json({ success: false });

    const messages = response.data.messages || [];

    const findOtp = (msg) => {
      const regex = /\b\d{4,8}\b/g;
      if (msg.subject) {
        const m = msg.subject.match(regex);
        if (m && m.length) return m[0];
      }
      if (msg.content) {
        const text = msg.content.replace(/<[^>]*>?/gm, '');
        const m = text.match(regex);
        if (m && m.length) return m[0];
      }
      return null;
    };

    let otp = null;
    for (const msg of messages) {
      otp = findOtp(msg);
      if (otp) break;
    }

    res.json({
      success: true,
      count: messages.length,
      otp: otp || '',
    });
  } catch (e) {
    res.json({ success: false });
  }
});

// Xem tin nhắn email
app.get('/emails/:email/messages', async (req, res) => {
  try {
    const email = req.params.email;
    const response = await axios.get(`${API_BASE}/messages/${API_KEY}/${email}`);
    if (response.data.status) {
      res.render('messages', { email, messages: response.data.messages, title: `Tin nhắn của ${email}`, error: null });
    } else {
      res.send('Lỗi lấy tin nhắn');
    }
  } catch (e) {
    res.send('Lỗi kết nối API');
  }
});

// Xem chi tiết message
app.get('/messages/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const response = await axios.get(`${API_BASE}/messages/${API_KEY}/message/${id}`);
    if (response.data.status) {
      res.render('message_detail', { message: response.data.data, title: 'Chi tiết tin nhắn', error: null });
    } else {
      res.send('Lỗi lấy chi tiết tin nhắn');
    }
  } catch (e) {
    res.send('Lỗi kết nối API');
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server chạy trên http://localhost:${PORT}`));
