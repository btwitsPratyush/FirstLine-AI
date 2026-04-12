import Twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
const client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function checkCall(sid) {
    try {
        const call = await client.calls(sid).fetch();
        console.log('Call Status:', call.status);
        console.log('Call URL:', call.toFormatted);
        // Note: To see the actual URL Twilio tried to fetch, we'd need to check the logs or use the API deeper
    } catch (e) {
        console.error(e);
    }
}

checkCall('CA5a13cefc95bbc7ab3d2c889b20071cd5');
