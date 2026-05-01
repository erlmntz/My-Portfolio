// Vercel Serverless Function — proxies chat requests to Google Gemini.
// Frontend posts { messages: [{ role: 'user'|'assistant', text: string }, ...] }
// Response: { reply: string } on success, { error: string } on failure.
//
// Required env var (set in Vercel project settings):
//   GEMINI_API_KEY  — get one from https://aistudio.google.com/app/apikey

const PORTFOLIO_INFO = `
Name: Earl Montañez Sumalbag (also known as "Earl" or "EmS").
Role: Fresh IT graduate seeking opportunities as a Junior Web Developer and Web Designer.
Location: Philippines (San Rafael, Bulacan area).

Short bio:
Earl is a fresh IT graduate looking for opportunities as a Junior Web Developer and Web Designer. He loves crafting clean websites and automated solutions, and he is always ready to learn something new.

Technical & computer skills:
- Web Technologies: HTML, CSS, Bootstrap, JavaScript
- Scripting & Automation: Google Apps Script, Spreadsheet, Docs
- Software Suite: Microsoft Office, Google Workspace
- Design & Prototyping: Figma, UI/UX Design, Wireframing, Interactive Prototyping, User Flows

Internship experience:
- Company: NIA Region III (National Irrigation Administration), Tambubong, San Rafael, Bulacan, Philippines (3008).
- Location: San Rafael, Bulacan, Philippines.
- Dates: January – April 2026.
- Responsibilities and achievements:
  * Developed an automated IT service ticket system using Google Apps Script to streamline request tracking and resolution.
  * Developed a Google Apps Script system that stores equipment history and past issues, accessible via QR code scanning to display equipment information.
  * Inspected new equipment to verify compliance with specifications and ensure proper functionality.
  * Updated and optimized data sorting in Excel to improve organization and accessibility.
  * Set up and managed live streaming for NIA events.

Seminars attended:
- "Data Privacy, Freedom of Information, and AI Safety" — DICT - Region V Provincial Office of Catanduanes, February 3, 2026. Topics: data privacy principles, freedom of information laws, and AI safety protocols.
- "Data Privacy Awareness" — DICT Region 2 Cagayan, February 18, 2026. Topics: data privacy awareness, best practices for personal data protection, compliance with privacy regulations.

Courses completed (Cisco Networking Academy, 2026):
- HTML Essentials — HTML5, semantic tags, forms, tables, multimedia, web accessibility.
- IT Customer Support Basics — help desk operations, troubleshooting, remote device support, record keeping, customer service.
- Computer Hardware Basics — component installation, preventive maintenance, laptops, mobile devices, safety standards.
- Introduction to Data Science — data analytics, AI/ML basics, machine learning, Python.

Certificates: HTML Essentials, IT Customer Support Basics, Computer Hardware Basics, Introduction to Data Science, Data Privacy Awareness, Data Privacy/Freedom of Information/AI Safety.

Contact information:
- Email: earlsumalbag@gmail.com
- Mobile: +63 949 648 8368
- LinkedIn: https://www.linkedin.com/in/earl-sumalbag-9a43b8353/
- JobStreet: https://ph.jobstreet.com/profiles/earl-sumalbag-WxyMhH7KJj
- OnlineJobs PH: https://v2.onlinejobs.ph/jobseekers/info/2237739
- GitHub: https://github.com/erlmntz
- Facebook: https://www.facebook.com/erlmntz.inc/
- Instagram: https://www.instagram.com/erlmntz.inc/
- Messenger: https://m.me/erlmntz.inc
`.trim();

const SYSTEM_PROMPT = `
You are "Earl's Portfolio Assistant", a friendly AI assistant embedded on Earl Montañez Sumalbag's personal portfolio website. Your job is to answer questions visitors have about Earl — his skills, experience, internship, courses, certificates, and how to contact or hire him.

Guidelines:
- Only answer questions about Earl based on the information below. If asked something that is not covered, say you don't have that information and suggest the visitor reach out to Earl directly via email (earlsumalbag@gmail.com) or LinkedIn.
- Politely decline off-topic requests (e.g., general knowledge, coding help, jokes unrelated to Earl). Redirect the conversation back to Earl's profile.
- Speak about Earl in third person ("Earl has...", "He worked on...").
- Be warm, concise, and professional. Keep replies under 120 words unless the visitor explicitly asks for more detail.
- Respond in plain text only. Do NOT use markdown formatting (no asterisks, no backticks, no headings, no bullet point characters). Use simple line breaks if you need to list things.
- If the visitor asks how to contact, hire, or reach Earl, share his email and one or two of his contact links from the information below.
- Do not invent skills, projects, dates, or experience that are not listed in the information below.

INFORMATION ABOUT EARL:
${PORTFOLIO_INFO}
`.trim();

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAX_MESSAGES = 20;
const MAX_TEXT_LEN = 2000;

function sanitizeMessages(input) {
  if (!Array.isArray(input)) return [];
  const cleaned = [];
  for (const m of input) {
    if (!m || typeof m.text !== 'string') continue;
    const text = m.text.trim();
    if (!text) continue;
    const role = m.role === 'assistant' ? 'model' : 'user';
    cleaned.push({ role, parts: [{ text: text.slice(0, MAX_TEXT_LEN) }] });
  }
  return cleaned.slice(-MAX_MESSAGES);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured.');
    res.status(500).json({ error: "The chatbot isn't configured yet. Please try again later." });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const contents = sanitizeMessages(body.messages);
  if (contents.length === 0) {
    res.status(400).json({ error: 'Please send a message.' });
    return;
  }
  if (contents[contents.length - 1].role !== 'user') {
    res.status(400).json({ error: 'The last message must be from the user.' });
    return;
  }

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 512,
      topP: 0.9,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  try {
    const upstream = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.error('Gemini API error:', upstream.status, text.slice(0, 500));
      res.status(502).json({ error: 'The AI service is temporarily unavailable. Please try again in a moment.' });
      return;
    }

    const data = await upstream.json();
    const candidate = data && Array.isArray(data.candidates) ? data.candidates[0] : null;
    const parts = candidate && candidate.content && Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
    const reply = parts.map(p => (p && typeof p.text === 'string' ? p.text : '')).join('').trim();

    if (!reply) {
      const finishReason = candidate && candidate.finishReason ? candidate.finishReason : 'unknown';
      console.error('Empty Gemini reply, finishReason:', finishReason);
      res.status(502).json({ error: "I couldn't come up with a reply. Please try rephrasing your question." });
      return;
    }

    res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat handler error:', err);
    res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
  }
};
