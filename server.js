require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const twilio = require('twilio');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  cors({
    origin: [
      'https://heartsinthemiddle.org', // ✅ No trailing slash
      'https://heartmessage.onrender.com',
    ],
    methods: ['GET', 'POST'],
    credentials: false,
  })
);

// Twilio credentials from .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);
const twilioNumber = process.env.TWILIO_PHONE;

app.get('/', (req, res) => {
  res.send('Welcome to the Twilio SMS Backend!');
});

// ✅ Send SMS to specific number
app.post('/start-webhook', async (req, res) => {
  const { userId } = req.body;

  const sms = `Please choose one of the following options and reply with the letter:\nA) Option A\nB) Option B\nC) Option C\nD) Option D`;

  try {
    await twilioClient.messages.create({
      body: sms,
      from: twilioNumber,
      to: '+923267514362', // ✅ Correct format
    });

    res.json({ status: 'Message sent to Father via Twilio' });
  } catch (err) {
    console.error('Twilio error:', err.message);
    res.status(500).send('Twilio message failed');
  }
});

// ✅ Receive response and store in LRS
app.post('/twilio-reply', async (req, res) => {
  const selectedOption = req.body.Body?.trim().toUpperCase();
  const fromNumber = req.body.From;

  console.log(`Father replied: ${selectedOption}`);

  const statement = {
    actor: {
      mbox: 'mailto:father@yourdomain.com',
      name: 'Father',
    },
    verb: {
      id: 'http://adlnet.gov/expapi/verbs/answered',
      display: { 'en-US': 'answered' },
    },
    object: {
      id: 'https://heartsinthemiddle.org/page8/father-response',
      definition: {
        name: { 'en-US': 'Father Page 8 Response' },
      },
    },
    result: {
      response: selectedOption,
    },
    context: {
      contextActivities: {
        parent: [
          {
            id: `https://heartsinthemiddle.org/student/unknown`,
            definition: {
              name: { 'en-US': 'Response from Father' },
            },
          },
        ],
      },
    },
  };

  try {
    await axios.post(`${process.env.LRS_URL}`, statement, {
      auth: {
        username: process.env.LRS_USER_NAME,
        password: process.env.LRS_PASSWORD,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thanks! Your response has been recorded.</Message>
</Response>`);
  } catch (err) {
    console.error('LRS save error:', err.message);
    res.status(500).send('Failed to save to LRS');
  }
});
// ✅ Retrieve Father's Response from LRS
app.get('/father-response', async (req, res) => {
  try {
    const response = await axios.get(`${process.env.LRS_URL}`, {
      auth: {
        username: process.env.LRS_USER_NAME,
        password: process.env.LRS_PASSWORD,
      },
      headers: {
        'X-Experience-API-Version': '1.0.3',
      },
      params: {
        verb: 'http://adlnet.gov/expapi/verbs/answered',
        limit: 1,
        ascending: false,
      },
    });

    const latest = response.data.statements[0];
    const option =
      latest?.object?.definition?.name?.['en-US'] || 'No response yet';

    res.json({ response: option });
  } catch (err) {
    console.error('Error fetching LRS:', err.message);
    res.status(500).json({ error: 'Could not fetch response' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
