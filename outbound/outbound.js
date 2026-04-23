import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import Twilio from 'twilio';
import WebSocket from 'ws';
import OpenAI from 'openai';
import fs from 'fs/promises';

// Load environment variables from .env file
dotenv.config();

// Check for required environment variables
const {
  ELEVENLABS_API_KEY,
  ELEVENLABS_AGENT_ID,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  OPENAI_API_KEY,
} = process.env;

if (
  !ELEVENLABS_API_KEY ||
  !ELEVENLABS_AGENT_ID ||
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN ||
  !TWILIO_PHONE_NUMBER ||
  !OPENAI_API_KEY
) {
  console.error('Missing required environment variables');
  throw new Error('Missing required environment variables');
}

if (!TWILIO_ACCOUNT_SID.startsWith('AC')) {
  console.error(
    'Invalid TWILIO_ACCOUNT_SID: must start with "AC".\n' +
    'Copy outbound/.env.example to outbound/.env and set real Twilio credentials from https://console.twilio.com'
  );
  throw new Error('TWILIO_ACCOUNT_SID must start with AC');
}

// Initialize Fastify server
const fastify = Fastify({ logger: true });
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

const PORT = process.env.PORT || 8000;

// Public base URL for Twilio (required when using ngrok). No trailing slash.
// e.g. https://abc123.ngrok.io
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL?.trim() || null;

// Root route for health check
fastify.get('/', async (_, reply) => {
  reply.send({ message: 'Server is running' });
});

// Initialize Twilio client
const twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// NEW: Random Scenarios List
const RANDOM_SCENARIOS = [
  {
    id: "panic_attack",
    name: "Panic Attack / Hyperventilation",
    prompt: "You are a young person having a severe panic attack. You are hyperventilating and having trouble speaking clearly. You are at 'Central Park near the fountain'. You feel like you are dying. You are scared and need help immediately. Act very distressed, breathe heavily between words. ALWAYS reply in English.",
    first_message: "I... I can't... breathe... help me..."
  },
  {
    id: "witness_fire",
    name: "Witnessing a Fire",
    prompt: "You are a bystander who just saw a house catch fire at '12 Maple Street'. You are shouting and very urgent. There might be people inside. You are coughing slightly from smoke. You are frantic and want the fire department NOW. ALWAYS reply in English.",
    first_message: "Fire! There's a fire! 12 Maple Street! Hurry!"
  },
  {
    id: "unconscious_person",
    name: "Found Unconscious Person",
    prompt: "You are a jogger who found an elderly man unconscious on the sidewalk at '45th Avenue'. He is breathing but not waking up. You are calm but concerned. You don't know who he is. You are following instructions carefully. ALWAYS reply in English.",
    first_message: "Hello? I found a man passed out on the sidewalk. He's not waking up."
  },
  {
    id: "intruder_alert",
    name: "Intruder Alert",
    prompt: "You are whispering because there is someone in your house. You are hiding in the closet. Address is '500 Oak Lane'. You hear footsteps downstairs. You are terrified and speaking very quietly. ALWAYS reply in English.",
    first_message: "Shhh... please... there's someone in my house..."
  }
];

// Helper function to get signed URL for authenticated conversations
async function getSignedUrl() {
  console.log(`[ElevenLabs] Requesting signed URL for agent: ${ELEVENLABS_AGENT_ID}`);
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ElevenLabs] Signed URL failed: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[ElevenLabs] Signed URL received successfully`);
    return data.signed_url;
  } catch (error) {
    console.error('[ElevenLabs] Fetch Signed URL Error:', error);
    throw error;
  }
}

// Route to initiate outbound calls
fastify.post('/outbound-call', async (request, reply) => {
  const { number } = request.body;

  if (!number) {
    return reply.code(400).send({ error: 'Phone number is required' });
  }

  try {
    // RANDOMLY PICK A SCENARIO
    const randomScenario = RANDOM_SCENARIOS[Math.floor(Math.random() * RANDOM_SCENARIOS.length)];
    console.log(`[Call Setup] Selected Random Scenario: ${randomScenario.name}`);

    const baseUrl = PUBLIC_BASE_URL || `https://${request.headers.host}`;

    // Encode parameters safely
    // Encode minimal parameters
    const params = new URLSearchParams({
      scenarioId: randomScenario.id
    });

    const twimlUrl = `${baseUrl}/outbound-call-twiml?${params.toString()}`;

    const call = await twilioClient.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to: number,
      url: twimlUrl,
    });

    reply.send({
      success: true,
      message: 'Call initiated with Random Scenario',
      scenario: randomScenario.name,
      callSid: call.sid,
    });
  } catch (error) {
    const message = error?.message || error?.toString?.() || 'Unknown error';
    console.error('Error initiating outbound call:', message);
    if (error?.code) console.error('Twilio error code:', error.code);
    reply.code(500).send({
      success: false,
      error: 'Failed to initiate call',
      detail: message,
    });
  }
});

// TwiML route for outbound calls
fastify.all('/outbound-call-twiml', async (request, reply) => {
  const scenarioId = request.query.scenarioId || 'unknown';
  const scenario = RANDOM_SCENARIOS.find(s => s.id === scenarioId) || RANDOM_SCENARIOS[0];

  const baseUrl = PUBLIC_BASE_URL || request.headers.host;
  const wsBase = baseUrl.replace(/^https?:\/\//, 'wss://');

  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Connect>
        <Stream url="${wsBase}/outbound-media-stream">
            <Parameter name="prompt" value="${scenario.prompt}" />
            <Parameter name="first_message" value="${scenario.first_message}" />
            <Parameter name="scenarioName" value="${scenario.name}" />
            <Parameter name="scenarioId" value="${scenario.id}" />
        </Stream>
        </Connect>
    </Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// WebSocket route for handling media streams
fastify.register(async function wsPlugin(fastifyInstance) {
  fastifyInstance.route({
    method: 'GET',
    url: '/outbound-media-stream',
    handler: (request, reply) => {
      // Normal HTTP handler (never reached for WS connections)
      reply.code(404).send();
    },
    wsHandler: (socket, req) => {
      console.info('[Server] Twilio media stream WebSocket connected');

      socket.on('error', (err) => console.error('[WS] Error:', err));

      // PCM 16-bit linear to mulaw conversion function
      function pcmToMulaw(sample) {
        let sign = (sample < 0) ? 0x80 : 0x00;
        let pcm16 = sample;
        if (pcm16 < 0) pcm16 = -pcm16;
        if (pcm16 > 32635) pcm16 = 32635;
        pcm16 += 132;

        let exponent = 7;
        for (let mask = 0x4000; (pcm16 & mask) === 0; mask >>= 1) {
            exponent--;
            if (exponent === 0) break;
        }
        let mantissa = (pcm16 >> (exponent + 3)) & 0x0F;
        let mulaw = ~(sign | (exponent << 4) | mantissa);
        return mulaw & 0xFF;
      }

      // Build mu-Law to PCM16 table
      const muLawToPcm16 = new Int16Array(256);
      for (let i = 0; i < 256; i++) {
        let mu = ~i & 0xff;
        let sign = (mu & 0x80) ? -1 : 1;
        let exponent = (mu & 0x70) >> 4;
        let data = mu & 0x0f;
        let pcm = sign * (((data << 3) + 0x84) << exponent) - 132;
        muLawToPcm16[i] = pcm;
      }

      // Variables to track the call
      let streamSid = null;
      let callSid = null;
      let elevenLabsWs = null;
      let customParameters = null;
      let conversationHistory = [];
      let callStartTime = null;

      // Setup ElevenLabs connection
      const setupElevenLabs = async () => {
        try {
          const scenarioName = customParameters?.scenarioName || 'Random Scenario';
          console.log(`[ElevenLabs] Getting signed URL for scenario: ${scenarioName}`);

          const signedUrl = await getSignedUrl();
          console.log(`[ElevenLabs] Signed URL obtained, connecting to WebSocket...`);
          elevenLabsWs = new WebSocket(signedUrl);

          elevenLabsWs.on('open', () => {
            console.log('[ElevenLabs] WebSocket Opened - Connected to Conversational AI');

            console.log('[ElevenLabs] Sending initiation data with ulaw_8000 output format');

            const initialConfig = {
              type: 'conversation_initiation_client_data',
              conversation_config_override: {
                agent: {
                  prompt: { prompt: customParameters?.prompt || "You are an AI assistant. Please speak in English." },
                  first_message: customParameters?.first_message || "Hello, how can I help you?"
                },
                tts: {
                  output_format: 'ulaw_8000'
                }
              }
            };
            elevenLabsWs.send(JSON.stringify(initialConfig));
            console.log('[ElevenLabs] Config sent successfully');
          });

          let audioLogged = false;
          elevenLabsWs.on('message', (data) => {
            try {
              const message = JSON.parse(data);
              if (message.type === 'audio') {
                if (streamSid) {
                  const payload = message.audio_event?.audio_base_64 || message.audio?.chunk;
                  if (payload) {
                    // Decode the base64 PCM audio (16kHz, 16-bit)
                    const pcmBuffer = Buffer.from(payload, 'base64');

                    if (!audioLogged) {
                      console.log(`[Audio] PCM buffer: ${pcmBuffer.length} bytes (16kHz), downsampling to 8kHz + mulaw...`);
                      audioLogged = true;
                    }

                    // Downsample 16kHz → 8kHz (skip every other sample) + convert to mulaw
                    const numSamples16k = pcmBuffer.length / 2; // 16-bit = 2 bytes per sample
                    const numSamples8k = Math.floor(numSamples16k / 2); // half the samples
                    const mulawBuffer = Buffer.alloc(numSamples8k);
                    for (let i = 0; i < numSamples8k; i++) {
                      const sample = pcmBuffer.readInt16LE(i * 4); // skip every other sample (4 bytes apart)
                      mulawBuffer[i] = pcmToMulaw(sample);
                    }

                    // Send in chunks of 320 bytes (20ms at 8kHz mulaw)
                    const CHUNK_SIZE = 320;
                    for (let offset = 0; offset < mulawBuffer.length; offset += CHUNK_SIZE) {
                      const chunk = mulawBuffer.subarray(offset, offset + CHUNK_SIZE);
                      socket.send(JSON.stringify({
                        event: 'media',
                        streamSid,
                        media: { payload: chunk.toString('base64') }
                      }));
                    }
                  }
                }
              } else if (message.type === 'agent_response') {
                const resp = message.agent_response_event?.agent_response;
                console.log(`[十一Labs] Agent: ${resp}`);
                if (resp) conversationHistory.push({ role: "assistant", content: resp });
              } else if (message.type === 'user_transcript') {
                const trans = message.user_transcription_event?.user_transcript;
                console.log(`[十一Labs] User: ${trans}`);
                if (trans) conversationHistory.push({ role: "user", content: trans });
              } else if (message.type === 'interruption') {
                if (streamSid) socket.send(JSON.stringify({ event: 'clear', streamSid }));
              }
            } catch (e) {
              console.error('[ElevenLabs] Error parsing message:', e);
            }
          });

          elevenLabsWs.on('error', (err) => console.error('[ElevenLabs] WebSocket Error:', err));
          elevenLabsWs.on('close', (code, reason) => console.log(`[ElevenLabs] WebSocket Closed - code: ${code}, reason: ${reason}`));
        } catch (error) {
          console.error('[ElevenLabs] Setup Error:', error);
        }
      };

      socket.on('message', (message) => {
        try {
          const msg = JSON.parse(message);
          if (msg.event === 'start') {
            streamSid = msg.start.streamSid;
            callSid = msg.start.callSid;
            customParameters = msg.start.customParameters;
            callStartTime = new Date();

            conversationHistory.push({ role: "system", content: customParameters?.prompt || 'Default prompt' });
            conversationHistory.push({ role: "assistant", content: customParameters?.first_message || 'Default message' });

            console.log(`[Twilio] Stream Started: ${streamSid}, Call: ${callSid}`);
            setupElevenLabs();
          } else if (msg.event === 'media') {
            if (elevenLabsWs?.readyState === WebSocket.OPEN) {
              // msg.media.payload is base64 encoded mu-law at 8kHz
              const mulawBuffer = Buffer.from(msg.media.payload, 'base64');

              // We want to send 16kHz PCM (16-bit linear).
              // For each 8kHz mu-law sample, we decode to 16-bit, and duplicate it to get 16kHz.
              const pcm16Buffer = Buffer.alloc(mulawBuffer.length * 4);
              for (let i = 0; i < mulawBuffer.length; i++) {
                const pcm = muLawToPcm16[mulawBuffer[i]];
                // Duplicate to upsample 8kHz -> 16kHz
                pcm16Buffer.writeInt16LE(pcm, i * 4);
                pcm16Buffer.writeInt16LE(pcm, i * 4 + 2);
              }

              elevenLabsWs.send(JSON.stringify({
                user_audio_chunk: pcm16Buffer.toString('base64')
              }));
            }
          } else if (msg.event === 'stop') {
            console.log(`[Twilio] Stream Stopped: ${streamSid}`);
            if (conversationHistory.length > 0) analyzeConversation(callSid, conversationHistory, customParameters);
            if (elevenLabsWs?.readyState === WebSocket.OPEN) elevenLabsWs.close();
          }
        } catch (e) {
          console.error('[Twilio] Message error:', e);
        }
      });

      socket.on('close', () => {
        console.log('[Twilio] WebSocket Closed');
        if (elevenLabsWs?.readyState === WebSocket.OPEN) elevenLabsWs.close();
      });
    }
  });
});

// Update the analyzeConversation function to include transcript in the analysis prompt
async function analyzeConversation(callSid, conversationHistory, parameters) {
  let scenarioName = parameters?.scenarioName || "Random Emergency Scenario";
  const parsedScenarioId = parameters?.scenarioId || null;

  try {
    const promptText = parameters?.prompt || '';

    // Fallback: If no name passed, try to guess (legacy support)
    if (scenarioName === "Unknown scenario" || scenarioName === "Random Emergency Scenario") {
      if (promptText.includes("John Smith")) {
        scenarioName = "John Smith - Elderly patient with chest pain";
      } else if (promptText.includes("Sarah Johnson")) {
        scenarioName = "Sarah Johnson - Unconscious teenager";
      } else if (promptText.includes("Michael Chen")) {
        scenarioName = "Michael Chen - Multi-vehicle collision";
      }
    }

    console.log(`[Analysis] Starting analysis for call ${callSid}`);
    console.log(`[Analysis] Identified scenario: ${scenarioName}`);
    console.log(`[Analysis] Conversation length: ${conversationHistory.length} messages`);

    // Format the transcript for inclusion in the prompt
    let formattedTranscript = "CALL TRANSCRIPT:\n\n";

    // Add the first message (system prompt) separately with a note
    if (conversationHistory.length > 0 && conversationHistory[0].role === "system") {
      formattedTranscript += "SCENARIO DETAILS: " + conversationHistory[0].content + "\n\n";
    }

    // Add the rest of the conversation as a transcript
    formattedTranscript += "CONVERSATION:\n";

    // Skip the system message in this part (already added above)
    const transcriptMessages = conversationHistory.slice(
      conversationHistory[0]?.role === "system" ? 1 : 0
    );

    transcriptMessages.forEach((msg, index) => {
      const role = msg.role === "assistant" ? "RESPONDER" : "CALLER";
      formattedTranscript += `[${role}]: ${msg.content}\n`;
    });

    // Create system prompt for analysis WITH transcript included
    const analysisPrompt = {
      role: "system",
      content: `You are a 999 emergency call evaluator analyzing training calls. 

TASK: Evaluate this emergency response training conversation and provide detailed feedback.

The scenario being simulated is: "${scenarioName}"

${formattedTranscript}

Based on the above transcript, analyze how well the emergency responder handled the call.

RETURN YOUR ANALYSIS AS A PROPERLY FORMATTED JSON OBJECT with the following structure:
{
  "scenario": "${scenarioName}",
  "overall_rating": {
    "score": 1-10,
    "summary": "Brief explanation of the rating"
  },
  "strengths": [
    "Specific strength 1",
    "Specific strength 2",
    "..."
  ],
  "areas_for_improvement": [
    "Specific area 1",
    "Specific area 2",
    "..."
  ],
  "information_handling": {
    "gathered_correctly": [
      "Info item 1",
      "Info item 2"
    ],
    "missed_or_incorrect": [
      "Info item 1",
      "Info item 2"
    ]
  },
  "action_assessment": {
    "appropriate_actions": [
      "Action 1",
      "Action 2"
    ],
    "inappropriate_actions": [
      "Action 1",
      "Action 2"
    ]
  },
  "efficiency": {
    "response_time_rating": 1-10,
    "comments": "Comments on efficiency"
  },
  "final_recommendation": "Detailed training recommendation paragraph",
  "pass_fail": "PASS" or "FAIL"
}

DO NOT include any explanatory text, markdown formatting, or code blocks - return ONLY the valid JSON object.`
    };

    // Since we now include the transcript in the prompt itself,
    // we only need to send the prompt to OpenAI
    const messages = [
      analysisPrompt,
      {
        role: "user",
        content: "Please provide your detailed analysis of this emergency training call."
      }
    ];

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1500
    });

    // Get the analysis
    const analysisText = response.choices[0].message.content;

    console.log(`[Analysis] Completed for call ${callSid}`);

    // Parse the JSON response from OpenAI
    let analysisData;
    try {
      // Try to parse the JSON from the OpenAI response
      analysisData = JSON.parse(analysisText);
      console.log("[Analysis] Successfully parsed OpenAI JSON response");
    } catch (parseError) {
      console.error("[Analysis] Error parsing OpenAI response as JSON:", parseError);
      console.log("[Analysis] Raw response:", analysisText);

      // Create a fallback analysis object if parsing fails
      analysisData = {
        scenario: scenarioName,
        ...(parsedScenarioId ? { scenarioId: parsedScenarioId } : {}),
        overall_rating: {
          score: 5,
          summary: "Analysis parsing failed - using fallback data"
        },
        strengths: ["Unable to parse analysis"],
        areas_for_improvement: ["System error in analysis processing"],
        information_handling: {
          gathered_correctly: [],
          missed_or_incorrect: []
        },
        action_assessment: {
          appropriate_actions: [],
          inappropriate_actions: []
        },
        efficiency: {
          response_time_rating: 5,
          comments: "Unable to assess due to parsing error"
        },
        final_recommendation: "Please review the raw conversation transcript as automated analysis failed.",
        pass_fail: "FAIL"
      };
    }

    // Ensure the analysis payload always contains scenarioId when available,
    // so the frontend can store it under the correct scenario without heuristics.
    if (parsedScenarioId && typeof analysisData === 'object' && analysisData) {
      analysisData.scenarioId = parsedScenarioId;
    }

    // Save analysis to file along with the full conversation
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const analysisFilename = `analysis_${callSid}_${timestamp}.json`;

    // Full analysis data to save locally
    const fullAnalysisData = {
      callSid,
      timestamp,
      scenarioName,
      conversation: conversationHistory,
      formattedTranscript,
      analysis: analysisData
    };

    await fs.writeFile(
      analysisFilename,
      JSON.stringify(fullAnalysisData, null, 2)
    );

    console.log(`[Analysis] Saved to ${analysisFilename}`);

    // Send the analysis to the frontend endpoint (must end with /api/analysis)
    try {
      const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
      const frontendUrl = `${base}/api/analysis`;
      console.log(`[Analysis] Sending analysis to frontend at: ${frontendUrl}`);

      const frontendResponse = await fetch(frontendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...analysisData,
          callSid: callSid
        }),
      });

      if (!frontendResponse.ok) {
        throw new Error(`Frontend API responded with status: ${frontendResponse.status}`);
      }

      const frontendResult = await frontendResponse.json();
      console.log(`[Analysis] Frontend API response:`, frontendResult);
    } catch (frontendError) {
      console.error('[Analysis] Error sending analysis to frontend:', frontendError);
    }

    return analysisData;
  } catch (error) {
    console.error('[Analysis] Error analyzing conversation:', error);

    // Send a "failed" analysis to frontend so status updates even when OpenAI fails
    const failedAnalysis = {
      scenario: scenarioName || 'Unknown',
      scenarioId: parsedScenarioId,
      overall_rating: {
        score: 0,
        summary: "Analysis could not be completed - OpenAI API error"
      },
      strengths: ["Call was completed successfully"],
      areas_for_improvement: ["Analysis unavailable - please check OpenAI API key"],
      information_handling: {
        gathered_correctly: [],
        missed_or_incorrect: []
      },
      action_assessment: {
        appropriate_actions: [],
        inappropriate_actions: []
      },
      efficiency: {
        response_time_rating: 0,
        comments: "Unable to assess - analysis failed"
      },
      final_recommendation: "Call completed but analysis failed. Please configure a valid OpenAI API key in outbound/.env to enable call analysis.",
      pass_fail: "FAIL"
    };

    // ALWAYS SAVE the failed analysis to disk so Vercel can fetch it later!
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const analysisFilename = `analysis_${callSid}_${timestamp}.json`;
    await fs.writeFile(
      analysisFilename,
      JSON.stringify({ callSid, timestamp, scenarioName, analysis: failedAnalysis }, null, 2)
    );
    console.log(`[Analysis] Saved FAILED format to ${analysisFilename}`);

    return null;
  }
}

// Add a new endpoint to retrieve analysis for a call
fastify.get('/analysis/:callSid', async (request, reply) => {
  const { callSid } = request.params;

  try {
    // Find the latest analysis file for this call
    const files = await fs.readdir('.');
    const analysisFiles = files.filter(f => f.startsWith(`analysis_${callSid}`));

    if (analysisFiles.length === 0) {
      return reply.code(404).send({ error: 'Analysis not found' });
    }

    // Sort by timestamp (which is part of the filename)
    analysisFiles.sort().reverse();

    // Read the latest analysis
    const latestAnalysis = await fs.readFile(analysisFiles[0], 'utf8');
    const analysis = JSON.parse(latestAnalysis);

    return reply.send(analysis);
  } catch (error) {
    console.error(`Error retrieving analysis for call ${callSid}:`, error);
    return reply.code(500).send({ error: 'Failed to retrieve analysis' });
  }
});

// Start the Fastify server
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log(`[Server] Listening on port ${PORT}`);
});
