/* AI chatbot widget — frontend logic.
   Talks to /api/chat (a Vercel serverless function that proxies to Gemini). */
(function () {
  var API_ENDPOINT = '/api/chat';
  var MAX_HISTORY = 12; // last N messages sent to the API for context

  var button = document.getElementById('chatButton');
  var modal = document.getElementById('chatModal');
  var closeBtn = document.getElementById('chatCloseBtn');
  var messagesEl = document.getElementById('chatMessages');
  var form = document.getElementById('chatForm');
  var input = document.getElementById('chatInput');
  var sendBtn = document.getElementById('chatSendBtn');

  if (!button || !modal || !messagesEl || !form || !input || !sendBtn) return;

  var history = [];
  var isLoading = false;

  function open() {
    modal.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    setTimeout(function () { input.focus(); }, 200);
  }

  function close() {
    modal.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
  }

  function toggle() {
    if (modal.classList.contains('open')) close();
    else open();
  }

  function appendMessage(role, text, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'chat-message chat-message-' + role;

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    if (opts.typing) {
      wrap.classList.add('chat-typing-msg');
      bubble.innerHTML = '<span class="chat-typing"><span></span><span></span><span></span></span>';
    } else {
      bubble.textContent = text;
    }

    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function setLoading(loading) {
    isLoading = loading;
    sendBtn.disabled = loading;
    input.disabled = loading;
  }

  function sendMessage(text) {
    text = (text || '').trim();
    if (!text || isLoading) return;

    setLoading(true);
    appendMessage('user', text);
    history.push({ role: 'user', text: text });

    var typingNode = appendMessage('assistant', '', { typing: true });

    var payload = { messages: history.slice(-MAX_HISTORY) };

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        typingNode.remove();
        if (!result.ok) {
          var errMsg = (result.data && result.data.error) || "Sorry, I couldn't reach the server. Please try again later.";
          appendMessage('assistant', errMsg);
          return;
        }
        var reply = result.data && result.data.reply ? result.data.reply : "Hmm, I don't have an answer for that.";
        appendMessage('assistant', reply);
        history.push({ role: 'assistant', text: reply });
      })
      .catch(function () {
        typingNode.remove();
        appendMessage('assistant', "Sorry, I couldn't connect. Please check your internet and try again.");
      })
      .then(function () {
        setLoading(false);
        input.focus();
      });
  }

  // Welcome message on first load.
  appendMessage('assistant', "Hi! I'm Earl's AI assistant. Ask me anything about his skills, experience, or how to get in touch.");

  // Listeners
  button.addEventListener('click', toggle);
  closeBtn.addEventListener('click', close);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = input.value;
    input.value = '';
    sendMessage(value);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });
})();
