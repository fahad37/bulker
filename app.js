(() => {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  const yearEl = document.getElementById('year');
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  const emailjsPanel = document.getElementById('emailjsPanel');
  const smtpPanel = document.getElementById('smtpPanel');
  const csvFileInput = document.getElementById('csvFile');
  const csvPreview = document.getElementById('csvPreview');
  const fromNameEl = document.getElementById('fromName');
  const subjectEl = document.getElementById('subject');
  const messageEl = document.getElementById('message');
  const ejPublicKey = document.getElementById('ejPublicKey');
  const ejServiceId = document.getElementById('ejServiceId');
  const ejTemplateId = document.getElementById('ejTemplateId');
  const smtpHost = document.getElementById('smtpHost');
  const smtpPort = document.getElementById('smtpPort');
  const smtpSecure = document.getElementById('smtpSecure');
  const smtpUser = document.getElementById('smtpUser');
  const smtpPass = document.getElementById('smtpPass');
  const sendDelayEl = document.getElementById('sendDelay');
  const testEmailEl = document.getElementById('testEmail');
  const sendTestBtn = document.getElementById('sendTest');
  const sendBulkBtn = document.getElementById('sendBulk');
  const cancelBtn = document.getElementById('cancelSend');
  const logEl = document.getElementById('log');
  const progressEl = document.getElementById('progress');
  const contactForm = document.getElementById('contactForm');
  const contactStatus = document.getElementById('contactStatus');

  let recipients = [];
  let cancelRequested = false;
  let emailjsInited = false;
  let smtpTriedDynamicLoad = false;

  function setYear() {
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  function toggleMenu() {
    navLinks.classList.toggle('open');
  }

  function switchTab(tab) {
    tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'emailjs') {
      emailjsPanel.classList.remove('hidden');
      smtpPanel.classList.add('hidden');
    } else {
      smtpPanel.classList.remove('hidden');
      emailjsPanel.classList.add('hidden');
    }
  }

  function log(msg, type = 'info') {
    const li = document.createElement('li');
    li.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    if (type === 'error') li.style.color = '#dc2626';
    if (type === 'success') li.style.color = '#16a34a';
    logEl.appendChild(li);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setProgress(text) {
    progressEl.textContent = text;
  }

  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(el);
    });
  }

  function parseCSVFile(file) {
    return new Promise((resolve, reject) => {
      const usePapa = typeof window.Papa !== 'undefined';
      if (usePapa) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            resolve(results.data);
          },
          error: (err) => reject(err)
        });
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result;
          const lines = String(text).split(/\r?\n/).filter(l => l.trim().length);
          const header = lines.shift().split(',').map(h => h.trim().toLowerCase());
          const rows = lines.map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj = {};
            header.forEach((h, i) => obj[h] = values[i] || '');
            return obj;
          });
          resolve(rows);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      }
    });
  }

  function renderTemplate(str, data) {
    return str.replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key] || '');
  }

  function previewCSV(rows) {
    if (!rows.length) {
      csvPreview.textContent = 'No rows detected.';
      return;
    }
    const count = rows.length;
    const sample = rows.slice(0, 3).map(r => `${r.email || ''} • ${r.name || ''}`).join(' | ');
    csvPreview.textContent = `${count} recipients loaded. Sample: ${sample}`;
  }

  function activeMethod() {
    const btn = tabButtons.find(b => b.classList.contains('active'));
    return btn ? btn.dataset.tab : 'emailjs';
    }

  async function ensureEmailJSInit() {
    if (emailjsInited) return;
    const key = ejPublicKey.value.trim();
    if (!key) throw new Error('EmailJS public key is required');
    if (typeof emailjs !== 'undefined' && emailjs.init) emailjs.init(key);
    emailjsInited = true;
  }

  async function ensureSMTPLoaded() {
    if (window.Email && typeof Email.send === 'function') return;
    if (smtpTriedDynamicLoad) throw new Error('SMTP.js not loaded (network blocked or offline)');
    smtpTriedDynamicLoad = true;
    try {
      log('Loading SMTP.js...', 'info');
      await loadScript('https://smtpjs.com/v3/smtp.js');
    } catch (e) {
      throw new Error('SMTP.js failed to load. Check internet/ad-blockers or use EmailJS.');
    }
    if (!(window.Email && typeof Email.send === 'function')) {
      throw new Error('SMTP.js loaded but Email.send unavailable. Use EmailJS or try another network.');
    }
  }

  async function sendWithEmailJS(to, name, subject, body, fromName) {
    await ensureEmailJSInit();
    const serviceId = ejServiceId.value.trim();
    const templateId = ejTemplateId.value.trim();
    if (!serviceId || !templateId) throw new Error('EmailJS service and template IDs are required');
    const params = {
      to_email: to,
      to_name: name || '',
      subject,
      message: body,
      from_name: fromName || ''
    };
    const res = await emailjs.send(serviceId, templateId, params);
    return res && res.status ? String(res.status) : 'ok';
  }

  async function sendWithSMTPJS(to, name, subject, body, fromName) {
    await ensureSMTPLoaded();
    const host = smtpHost.value.trim();
    const user = smtpUser.value.trim();
    const pass = smtpPass.value.trim();
    const port = Number(smtpPort.value) || undefined;
    if (!host || !user || !pass) throw new Error('SMTP host, username, and app password are required');
    const from = `${fromName || user} <${user}>`;
    const payload = {
      Host: host,
      Username: user,
      Password: pass,
      To: to,
      From: from,
      Subject: subject,
      Body: body
    };
    if (port) payload.Port = port;
    const res = await Email.send(payload);
    return String(res || 'ok');
  }

  async function sendSingle(to, name, subject, body, fromName) {
    const method = activeMethod();
    if (method === 'emailjs') {
      return sendWithEmailJS(to, name, subject, body, fromName);
    }
    return sendWithSMTPJS(to, name, subject, body, fromName);
  }

  async function doSendBulk(list, isTest = false) {
    cancelRequested = false;
    const fromName = fromNameEl.value.trim();
    const subject = subjectEl.value.trim();
    const message = messageEl.value.trim();
    const delayMs = Math.max(0, Number(sendDelayEl.value || 0));
    if (!subject || !message) {
      log('Subject and message are required', 'error');
      return;
    }
    const items = isTest ? list.slice(0, 1) : list;
    const total = items.length;
    if (!total) {
      log('No recipients to send', 'error');
      return;
    }
    let sent = 0;
    setProgress(`Sending 0/${total}`);
    for (const r of items) {
      if (cancelRequested) {
        setProgress(`Cancelled at ${sent}/${total}`);
        log('Sending cancelled', 'error');
        break;
      }
      const to = (r.email || '').trim();
      const name = (r.name || '').trim();
      if (!to) {
        log('Skipping row with empty email', 'error');
        continue;
      }
      const subj = renderTemplate(subject, r);
      const body = renderTemplate(message, r);
      try {
        const res = await sendSingle(to, name, subj, body, fromName);
        sent += 1;
        setProgress(`Sending ${sent}/${total}`);
        log(`Sent to ${to}: ${res}`, 'success');
      } catch (e) {
        log(`Failed to ${to}: ${e.message || e}`, 'error');
      }
      if (!cancelRequested && delayMs > 0) await delay(delayMs);
    }
    if (!cancelRequested) setProgress(`Done ${sent}/${total}`);
  }

  function onCSVChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    parseCSVFile(file).then(rows => {
      recipients = rows.map(r => ({
        email: r.email || r.Email || r.EMAIL || '',
        name: r.name || r.Name || r.NAME || ''
      })).filter(r => String(r.email).trim().length);
      previewCSV(recipients);
      log(`CSV loaded with ${recipients.length} recipients`);
    }).catch(err => {
      log(`CSV parse error: ${err.message || err}`, 'error');
    });
  }

  function onSendTest() {
    const testTo = testEmailEl.value.trim();
    if (testTo) {
      const name = 'Test';
      const rec = [{ email: testTo, name }];
      doSendBulk(rec, true);
    } else if (recipients.length > 0) {
      doSendBulk(recipients, true);
    } else {
      log('Enter a test email or load a CSV', 'error');
    }
  }

  function onSendBulk() {
    if (!recipients.length) {
      log('Load a CSV first', 'error');
      return;
    }
    doSendBulk(recipients, false);
  }

  function onCancel() {
    cancelRequested = true;
  }

  function onContactSubmit(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('cName').value.trim(),
      email: document.getElementById('cEmail').value.trim(),
      subject: document.getElementById('cSubject').value.trim(),
      message: document.getElementById('cMessage').value.trim(),
      time: Date.now()
    };
    try {
      const k = 'contactSubmissions';
      const prev = JSON.parse(localStorage.getItem(k) || '[]');
      prev.push(payload);
      localStorage.setItem(k, JSON.stringify(prev).slice(0, 50000));
      contactStatus.textContent = 'Thanks for your feedback.';
      contactStatus.style.color = '#16a34a';
      (e.target).reset();
    } catch {
      contactStatus.textContent = 'Unable to save feedback locally.';
      contactStatus.style.color = '#dc2626';
    }
  }

  function bind() {
    if (navToggle) navToggle.addEventListener('click', toggleMenu);
    tabButtons.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    csvFileInput.addEventListener('change', onCSVChange);
    sendTestBtn.addEventListener('click', onSendTest);
    sendBulkBtn.addEventListener('click', onSendBulk);
    cancelBtn.addEventListener('click', onCancel);
    contactForm.addEventListener('submit', onContactSubmit);
  }

  setYear();
  switchTab('emailjs');
  bind();
})(); 

