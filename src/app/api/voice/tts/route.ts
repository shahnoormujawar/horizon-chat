import { NextRequest } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';

async function getVoiceId(): Promise<string | null> {
  // If user set a specific voice ID, use it
  if (VOICE_ID) return VOICE_ID;

  // Otherwise, fetch user's available voices and pick the first one
  // This works on free tier (uses your own cloned/generated voices)
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY! },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Prefer user's own voices, then any available voice
    const voices = data.voices || [];
    const ownVoice = voices.find((v: { category: string }) =>
      v.category === 'cloned' || v.category === 'generated'
    );
    return ownVoice?.voice_id || voices[0]?.voice_id || null;
  } catch {
    return null;
  }
}

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' code block omitted ')
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/\[TASK:.*?\]/g, '')
    .replace(/\[\/TASK\]/g, '')
    .replace(/\[(SEARCH|ANALYZE|THINK|CREATE|EDIT|READ)\]/g, '')
    .replace(/\[SOURCE:.*?\]/g, '')
    .replace(/[#*_~>\[\]]/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  if (!ELEVENLABS_API_KEY) {
    return Response.json(
      { error: 'ElevenLabs API key not configured', fallback: true },
      { status: 500 }
    );
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return Response.json({ error: 'Text is required' }, { status: 400 });
    }

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) {
      return Response.json({ error: 'No speakable text' }, { status: 400 });
    }

    const voiceId = await getVoiceId();
    if (!voiceId) {
      return Response.json(
        { error: 'No voices available. Add a voice at elevenlabs.io or set ELEVENLABS_VOICE_ID.', fallback: true },
        { status: 422 }
      );
    }

    const truncated = cleanText.slice(0, 5000);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: truncated,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('ElevenLabs TTS error:', response.status, errorBody);

      // 402 = free tier can't use library voices — signal client to use browser fallback
      if (response.status === 402) {
        return Response.json(
          { error: 'ElevenLabs free plan limitation. Using browser voice instead.', fallback: true },
          { status: 402 }
        );
      }

      return Response.json(
        { error: `ElevenLabs error ${response.status}: ${errorBody}` },
        { status: response.status }
      );
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('TTS API error:', error);
    return Response.json({ error: 'Internal server error', fallback: true }, { status: 500 });
  }
}
