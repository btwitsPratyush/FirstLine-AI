import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callSid = searchParams.get('callSid');

  if (!callSid) {
    return NextResponse.json(
      { error: 'Call SID is required' },
      { status: 400 }
    );
  }

  const outboundApiUrl = process.env.OUTBOUND_CALL_API_URL;
  
  if (!outboundApiUrl) {
    return NextResponse.json(
      { error: 'OUTBOUND_CALL_API_URL is not configured' },
      { status: 500 }
    );
  }

  try {
    // Forward the polling request directly to the Render server which holds the actual analysis files!
    const backendUrl = `${outboundApiUrl.replace(/\/$/, '')}/analysis/${callSid}`;
    const res = await fetch(backendUrl);
    
    if (res.ok) {
        const fullData = await res.json();
        // Return only the inner "analysis" property which contains the actual results
        // matching what the frontend expects!
        return NextResponse.json(fullData.analysis || fullData);
    } else {
        return NextResponse.json(
          { error: 'Analysis not ready yet' },
          { status: 404 }
        );
    }
  } catch (error) {
    console.error(`Error retrieving analysis:`, error);
    return NextResponse.json(
      { error: 'Failed to retrieve analysis from backend' },
      { status: 500 }
    );
  }
}

// We don't need POST here anymore, because Render no longer needs to send it to Vercel. 
// Vercel just fetches it from Render directly now!
export async function POST(request: NextRequest) {
  return NextResponse.json({ success: true });
} 