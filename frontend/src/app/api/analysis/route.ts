import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Store analyses persistently in a JSON file
const ANALYSIS_FILE = path.join(process.cwd(), 'analysis_data.json');

// Initialize with empty data if file doesn't exist
async function getStoredAnalyses() {
  try {
    const data = await fs.readFile(ANALYSIS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    // Return empty object if file doesn't exist or has invalid JSON
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Log the received data for debugging
    console.log('Received analysis data:', data);

    // Extract scenario ID from the analysis data
    let scenarioId = data.scenarioId;

    if (!scenarioId) {
      // Last resort: use the callSid if scenarioId is missing
      scenarioId = data.callSid || 'unknown';
    }

    if (!scenarioId) {
      return NextResponse.json(
        { error: 'Could not identify scenario or call session' },
        { status: 400 }
      );
    }

    // Use callSid as the primary key if available, otherwise fallback to scenarioId
    const storageKey = data.callSid || scenarioId || 'unknown';

    // Store the analysis with other analyses
    const analyses = await getStoredAnalyses();
    analyses[storageKey] = {
      ...data,
      receivedAt: new Date().toISOString()
    };

    // Save updated analyses
    await fs.writeFile(ANALYSIS_FILE, JSON.stringify(analyses, null, 2));

    // Log success for debugging
    console.log(`Stored analysis for key ${storageKey}`);

    return NextResponse.json({
      success: true,
      message: 'Analysis received and stored successfully',
      scenarioId,
      status: data.pass_fail
    });
  } catch (error) {
    console.error('Error processing analysis:', error);
    return NextResponse.json(
      { error: 'Failed to process analysis data' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callSid = searchParams.get('callSid');
  const scenarioId = searchParams.get('id');

  const key = callSid || scenarioId;

  if (!key) {
    return NextResponse.json(
      { error: 'Call SID or Scenario ID is required' },
      { status: 400 }
    );
  }

  try {
    const analyses = await getStoredAnalyses();
    const result = analyses[key];

    if (!result) {
      return NextResponse.json(
        { error: 'No analysis found for this scenario' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error retrieving analysis for scenario ${scenarioId}:`, error);
    return NextResponse.json(
      { error: 'Failed to retrieve analysis' },
      { status: 500 }
    );
  }
} 