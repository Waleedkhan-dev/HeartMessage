const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const twilio = require('twilio');
require('dotenv').config()
const app = express();
app.use(cors());
app.use(bodyParser.json());
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const TWILIO_PHONE = process.env.TWILIO_PHONE;
app.post('/send-message', async (req, res) => {
  const { to, message } = req.body;

  try {
    const result = await client.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to: to
    });

    res.status(200).json({ success: true, sid: result.sid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});
const port = process.env.PORT
app.listen(port, () => {
  console.log(` Server is running at http://localhost:${port}`);
});
