import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/database';
// Note: Backend services are not available in frontend build
// import { AdvancedScraperService } from '../../../../../backend/src/services/advanced-scraper.service';
// import { SourceConfigService } from '../../../../../backend/src/services/source-config.service';
// import { SchedulerService } from '../../../../../backend/src/services/scheduler.service';

// POST /api/admin/sources/scrape - Trigger scraping
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    // Note: Backend services are not available in frontend build
    // This endpoint would need to be implemented differently for production
    return NextResponse.json({
      success: false,
      error: 'Scraping service not available in frontend build. Use backend API directly.'
    }, { status: 501 });
  } catch (error) {
    console.error('Error triggering scraping:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to trigger scraping' },
      { status: 500 }
    );
  }
}

// GET /api/admin/sources/scrape/status - Get scraping status
export async function GET() {
  try {
    await connectDB();
    
    // Note: Backend services are not available in frontend build
    return NextResponse.json({
      success: false,
      error: 'Scraping status not available in frontend build. Use backend API directly.'
    }, { status: 501 });
  } catch (error) {
    console.error('Error getting scraping status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get scraping status' },
      { status: 500 }
    );
  }
}
