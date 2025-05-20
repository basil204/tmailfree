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

const allowedDomains = ['manhnl.dev', 'userdhieu.id.vn', 'phimmoichillf.com','manhit.dev'];
let emailsCreated = [];

// Trang chủ: show 3 domain cố định
app.get('/', (req, res) => {
  const domains = allowedDomains.map(d => ({ domain: d, type: 'Free' }));
  res.render('index', { domains, title: 'Danh sách Domains', error: null });
});

// Form tạo email
app.get('/create-email', (req, res) => {
  res.render('create_email', { domains: allowedDomains, error: null, title: 'Tạo Email Mới' });
});

// Xử lý tạo email
app.post('/create-email', async (req, res) => {
  let { username, domain } = req.body;

  // Nếu domain không chọn hoặc không hợp lệ thì random domain trong 3 domain
  if (!domain || !allowedDomains.includes(domain)) {
    const randomIndex = Math.floor(Math.random() * allowedDomains.length);
    domain = allowedDomains[randomIndex];
  }

  try {
    // Bước 1: tạo email mặc định random username + domain mặc định của API
    const createResp = await axios.post(`${API_BASE}/emails/${API_KEY}`);
    if (!createResp.data.status) {
      return res.render('create_email', { domains: allowedDomains, error: 'Tạo email thất bại ở bước tạo mặc định', title: 'Tạo Email Mới' });
    }

    let finalEmailData = createResp.data.data;

    // Nếu user nhập username hợp lệ, thì update email
    if (username && username.trim() !== '') {
      username = username.trim();

      if (!/^[a-zA-Z0-9._%+-]+$/.test(username)) {
        return res.render('create_email', { domains: allowedDomains, error: 'Username chứa ký tự không hợp lệ', title: 'Tạo Email Mới' });
      }

      const oldEmail = finalEmailData.email;
      const updateResp = await axios.post(`${API_BASE}/emails/${API_KEY}/${encodeURIComponent(oldEmail)}/${encodeURIComponent(username)}/${encodeURIComponent(domain)}`);

      if (!updateResp.data.status) {
        return res.render('create_email', { domains: allowedDomains, error: 'Cập nhật email thất bại', title: 'Tạo Email Mới' });
      }

      finalEmailData = updateResp.data.data;
    } else {
      // Nếu user bỏ trống username, giữ nguyên email random của API
      // Nhưng thay domain thành domain đã random hoặc chọn nếu domain API khác
      // Nếu domain API khác với domain random/chọn, gọi update email chỉ đổi domain thôi
      if (finalEmailData.domain !== domain) {
        const oldEmail = finalEmailData.email;
        // Lấy username hiện tại từ email cũ (phần trước @)
        const oldUsername = oldEmail.split('@')[0];
        const updateResp = await axios.post(`${API_BASE}/emails/${API_KEY}/${encodeURIComponent(oldEmail)}/${encodeURIComponent(oldUsername)}/${encodeURIComponent(domain)}`);

        if (!updateResp.data.status) {
          return res.render('create_email', { domains: allowedDomains, error: 'Cập nhật domain email thất bại', title: 'Tạo Email Mới' });
        }

        finalEmailData = updateResp.data.data;
      }
    }

    emailsCreated.push(finalEmailData);
    res.redirect('/emails');

  } catch (e) {
    console.error(e);
    res.render('create_email', { domains: allowedDomains, error: 'Lỗi kết nối API', title: 'Tạo Email Mới' });
  }
});


// Danh sách email đã tạo
app.get('/emails', (req, res) => {
  res.render('emails', { emails: emailsCreated, title: 'Danh sách Email đã tạo', error: null });
});

// Xóa email khỏi cache
app.post('/emails/:email/delete', (req, res) => {
  const emailToDelete = req.params.email;
  emailsCreated = emailsCreated.filter(e => e.email !== emailToDelete);
  res.redirect('/emails');
});
// API trả về JSON tin nhắn cho email (dùng AJAX)
app.get('/api/messages/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const response = await axios.get(`${API_BASE}/messages/${API_KEY}/${email}`);
    if (response.data.status) {
      res.json({ success: true, messages: response.data.messages });
    } else {
      res.json({ success: false, messages: [] });
    }
  } catch (e) {
    res.json({ success: false, messages: [] });
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
