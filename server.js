require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const twilio = require('twilio');

const app = express();

// ✅ CORS
app.use(
  cors({
    origin: [
      'https://heartsinthemiddle.org',
      'https://heartmessage.onrender.com',
    ],
    methods: ['GET', 'POST'],
    credentials: false,
  })
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ✅ Twilio setup
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);
const twilioNumber = process.env.TWILIO_PHONE;

// ✅ Map options
const optionsMap = {
  A: 'I love you, son ❤️',
  B: 'You’re doing great!',
  C: 'Keep going! Proud of you.',
  D: 'Stay strong and focused!',
};

// ✅ Home route
app.get('/', (req, res) => {
  res.send('Twilio SMS + LRS backend is running.');
});

// ✅ Send message to father
app.post('/start-webhook', async (req, res) => {
  const message = `Your child has started the course!\nPlease choose one of the following responses:\n\nA) I love you, son ❤️\nB) You’re doing great!\nC) Keep going! Proud of you.\nD) Stay strong and focused!\n\nReply with A, B, C, or D.`;

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: twilioNumber,
      to: '+923216832148', // ✅ Hardcoded father number
    });

    console.log('✅ SMS sent to father:', result.sid);

    res.json({
      status: '✅ SMS sent successfully!',
      message:
        'A motivational message was sent to the father. Awaiting reply (A, B, C, or D).',
      sid: result.sid, // Twilio message ID
      to: result.to,
      from: result.from,
    });
  } catch (error) {
    console.error('❌ Twilio send error:', error.message);
    res.status(500).json({
      error: '❌ Failed to send SMS to father.',
      details: error.message,
    });
  }
});

// ✅ Receive reply from father and store in LRS
app.post('/twilio-reply', async (req, res) => {
  console.log('twillio reply received:', req.body);
  const selectedOption = req.body.Body?.trim().toUpperCase();
  const fromNumber = req.body.From;

  console.log(`📩 Father replied: ${selectedOption}`);

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
            id: 'https://heartsinthemiddle.org/student/unknown',
            definition: {
              name: { 'en-US': 'Response from Father' },
            },
          },
        ],
      },
    },
  };

  try {
    await axios.post(process.env.LRS_URL, statement, {
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
  } catch (error) {
    console.error('❌ LRS save error:', error.message);
    res.status(500).send('Failed to save to LRS');
  }
});

// ✅ Get Father's response from LRS
app.get('/father-response', async (req, res) => {
  try {
    const lrsResponse = await axios.get(process.env.LRS_URL, {
      auth: {
        username: process.env.LRS_USER_NAME,
        password: process.env.LRS_PASSWORD,
      },
      headers: {
        'X-Experience-API-Version': '1.0.3',
      },
      params: {
        verb: 'http://adlnet.gov/expapi/verbs/answered',
        activity: 'https://heartsinthemiddle.org/page8/father-response',
        limit: 1,
        ascending: false,
      },
    });

    const statement = lrsResponse.data.statements?.[0];
    const raw = statement?.result?.response || 'No response yet';
    const response = optionsMap[raw] || 'Unknown response';

    res.json({ response, raw });
  } catch (error) {
    console.error('❌ Error fetching from LRS:', error.message);
    res.status(500).json({ error: 'Could not fetch response' });
  }
});

// ✅ Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server is live: http://localhost:${port}`);
});
