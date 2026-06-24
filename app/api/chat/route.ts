import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ConceptRow {
  subject: string;
  concept: string;
  mastery_level: 'Introduced' | 'Developing' | 'Proficient' | 'Strong';
  weak_areas: string[];
  strong_areas: string[];
}

interface RequestBody {
  userMessage: string;
  subject?: string;
  concept?: string;
}

function buildSystemPrompt(conceptRow: ConceptRow | null): string {
  let systemPrompt = '';

  if (!conceptRow) {
    // Mode A: Beginner friendly, analogy-first, define all terms
    systemPrompt = `You are a helpful tutor using a beginner-friendly approach. 
Your teaching style:
- Use analogies and relatable examples to explain concepts
- Define all technical terms clearly before using them
- Break down complex ideas into simple, digestible parts
- Encourage questions and curiosity
- Provide clear, step-by-step explanations

Keep responses clear and accessible for someone new to the topic.`;
  } else {
    const { mastery_level, weak_areas, strong_areas, subject, concept } = conceptRow;

    if (mastery_level === 'Introduced' || mastery_level === 'Developing') {
      // Mode B: Reference prior knowledge, mention weak areas, moderate pace
      systemPrompt = `You are a tutor for a student learning about "${subject}: ${concept}".

Student's learning profile:
- Current level: ${mastery_level}
- Areas of strength: ${strong_areas.length > 0 ? strong_areas.join(', ') : 'general foundations'}
- Areas to focus on: ${weak_areas.length > 0 ? weak_areas.join(', ') : 'building foundational understanding'}

Your teaching approach:
- Reference what the student already knows well as a foundation for new concepts
- Pay special attention to their weak areas with clear explanations
- Use a moderate pace that builds on their existing knowledge
- Connect new concepts to areas where they're already strong
- Provide concrete examples related to their strong areas

Help the student progress by building bridges between known concepts and new material.`;
    } else {
      // Mode C: Technical, skip basics, focus on nuance
      systemPrompt = `You are an advanced tutor for a student who has strong understanding of "${subject}: ${concept}".

Student's learning profile:
- Current level: ${mastery_level}
- Areas of strength: ${strong_areas.length > 0 ? strong_areas.join(', ') : 'advanced fundamentals'}
- Areas to deepen: ${weak_areas.length > 0 ? weak_areas.join(', ') : 'advanced nuances'}

Your teaching approach:
- Skip introductory explanations and basic definitions
- Focus on nuanced, technical details and advanced concepts
- Discuss edge cases and deeper implications
- Reference advanced applications and connections to related fields
- Challenge assumptions and explore subtleties
- Dive into the "why" behind advanced concepts

Help the student deepen their expertise by exploring advanced perspectives and nuanced understanding.`;
    }
  }

  return systemPrompt;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { userMessage, subject, concept } = body;

    if (!userMessage) {
      return NextResponse.json(
        { error: 'userMessage is required' },
        { status: 400 }
      );
    }

    let conceptRow: ConceptRow | null = null;

    // Query Supabase if subject and concept are provided
    if (subject && concept) {
      const { data, error } = await supabase
        .from('concepts')
        .select('subject, concept, mastery_level, weak_areas, strong_areas')
        .eq('subject', subject)
        .eq('concept', concept)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows found" error, which is expected
        console.error('Supabase query error:', error);
      }

      if (data) {
        conceptRow = data as ConceptRow;
      }
    }

    // Build system prompt based on query results
    const systemPrompt = buildSystemPrompt(conceptRow);

    // Debug Anthropic auth loading
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const keyExists = Boolean(anthropicApiKey);
    const keyLength = anthropicApiKey?.length ?? 0;
    const keyFirst10 = anthropicApiKey ? `${anthropicApiKey.slice(0, 10)}...` : 'none';
    const keyLast5 = anthropicApiKey ? `...${anthropicApiKey.slice(-5)}` : 'none';
    const hasLeadingSpace = anthropicApiKey ? anthropicApiKey[0] === ' ' : false;
    const hasTrailingSpace = anthropicApiKey ? anthropicApiKey[keyLength - 1] === ' ' : false;
    
    console.log('=== /api/chat Auth Debug ===');
    console.log('Route: /api/chat');
    console.log('ANTHROPIC_API_KEY exists:', keyExists);
    console.log('Key length:', keyLength);
    console.log('Key start:', keyFirst10);
    console.log('Key end:', keyLast5);
    console.log('Has leading space:', hasLeadingSpace);
    console.log('Has trailing space:', hasTrailingSpace);
    console.log('ANTHROPIC_AUTH_TOKEN exists:', Boolean(process.env.ANTHROPIC_AUTH_TOKEN));
    console.log('Model:', 'claude-sonnet-4-6');
    console.log('AI SDK method: streamText');
    if (!keyExists) {
      console.error('ERROR: ANTHROPIC_API_KEY is not set!');
    }
    console.log('============================');

    // Stream response from Anthropic API
    const stream = await streamText({
      model: anthropic('claude-sonnet-4-6'),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    return stream.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
