import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface RequestBody {
  subject: string;
  concept: string;
  masteryLevel: string;
  overviewGist: string;
  deepDiveGist: string[];
  strongAreas: string[];
  weakAreas: string[];
  nextSteps: string[];
  notes: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const {
      subject,
      concept,
      masteryLevel,
      overviewGist,
      deepDiveGist,
      strongAreas,
      weakAreas,
      nextSteps,
      notes,
    } = body;

    if (!subject || !concept) {
      return NextResponse.json(
        { error: 'subject and concept are required' },
        { status: 400 }
      );
    }

    const payload = {
      subject,
      concept,
      mastery_level: masteryLevel,
      overview_gist: overviewGist,
      deep_dive_gist: deepDiveGist,
      strong_areas: strongAreas,
      weak_areas: weakAreas,
      next_steps: nextSteps,
      notes,
      last_updated: new Date().toISOString(),
    };
    
    console.log('[SAVE-CONCEPT] Attempting to save:');
    console.log('  Subject:', subject);
    console.log('  Concept:', concept);
    console.log('  Mastery Level:', masteryLevel);
    console.log('  Strong Areas:', strongAreas);
    console.log('  Weak Areas:', weakAreas);
    console.log('  Next Steps:', nextSteps);

    const { error } = await supabase
      .from('concepts')
      .upsert(payload, { onConflict: ['subject', 'concept'] });

    if (error) {
      console.error('[SAVE-CONCEPT] Supabase upsert error:', error);
      return NextResponse.json(
        { error: 'Failed to save concept' },
        { status: 500 }
      );
    }
    
    console.log('[SAVE-CONCEPT] Successfully saved concept:', subject, '-', concept);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('save-concept API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
