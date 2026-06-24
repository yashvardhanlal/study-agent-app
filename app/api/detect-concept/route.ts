import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { NextRequest, NextResponse } from 'next/server';

interface RequestBody {
  userMessage: string;
}

interface DetectionResult {
  subject: string;
  concept: string;
}

function sanitizeJsonResponseText(text: string) {
  let cleaned = text.trim();

  // strip markdown code fences and language hints
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // extract the first JSON object if there is extra markdown or text
  const match = cleaned.match(/(\{[\s\S]*\})/);
  if (match) {
    return match[1].trim();
  }

  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { userMessage } = body;

    if (!userMessage) {
      return NextResponse.json({ error: 'userMessage is required' }, { status: 400 });
    }

    const prompt = `Extract the subject and concept from the following message. Return only valid JSON with two fields: subject and concept. If the message is not about studying a concept, return subject: '' and concept: ''.\n\nMessage:\n${userMessage}`;

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const keyExists = Boolean(anthropicApiKey);
    const keyLength = anthropicApiKey?.length ?? 0;
    const keyFirst10 = anthropicApiKey ? `${anthropicApiKey.slice(0, 10)}...` : 'none';
    const keyLast5 = anthropicApiKey ? `...${anthropicApiKey.slice(-5)}` : 'none';
    const hasLeadingSpace = anthropicApiKey ? anthropicApiKey[0] === ' ' : false;
    const hasTrailingSpace = anthropicApiKey ? anthropicApiKey[keyLength - 1] === ' ' : false;
    
    console.log('=== /api/detect-concept Auth Debug ===');
    console.log('Route: /api/detect-concept');
    console.log('ANTHROPIC_API_KEY exists:', keyExists);
    console.log('Key length:', keyLength);
    console.log('Key start:', keyFirst10);
    console.log('Key end:', keyLast5);
    console.log('Has leading space:', hasLeadingSpace);
    console.log('Has trailing space:', hasTrailingSpace);
    console.log('ANTHROPIC_AUTH_TOKEN exists:', Boolean(process.env.ANTHROPIC_AUTH_TOKEN));
    console.log('Model:', 'claude-haiku-4-5');
    console.log('AI SDK method: generateText');
    if (!keyExists) {
      console.error('ERROR: ANTHROPIC_API_KEY is not set!');
    }
    console.log('=========================================');

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      prompt,
    });
    console.log('[DETECT-CONCEPT] Raw Anthropic response text:', JSON.stringify(text));
    const cleanedText = sanitizeJsonResponseText(text);
    console.log('[DETECT-CONCEPT] Sanitized JSON text:', JSON.stringify(cleanedText));
    let result: DetectionResult = { subject: '', concept: '' };

    try {
      const parsed = JSON.parse(cleanedText) as DetectionResult;
      result = {
        subject: typeof parsed.subject === 'string' ? parsed.subject.trim() : '',
        concept: typeof parsed.concept === 'string' ? parsed.concept.trim() : '',
      };
      console.log('[DETECT-CONCEPT] Parsed JSON successfully:', result);
    } catch (jsonError) {
      console.error(
        '[DETECT-CONCEPT] Failed to parse JSON from Anthropic response:',
        jsonError,
        'Raw text was:',
        text,
        'Sanitized text was:',
        cleanedText
      );
    }
    
    console.log('[DETECT-CONCEPT] Final result to return:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('detect-concept API error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    if (error && typeof error === 'object' && 'status' in error) {
      console.error('HTTP Status:', (error as any).status);
    }
    if (error && typeof error === 'object' && 'error' in error) {
      console.error('API Error details:', (error as any).error);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
