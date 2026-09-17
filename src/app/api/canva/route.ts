import { NextRequest, NextResponse } from 'next/server';
import { CanvaService, TRABZONSPOR_CANVA_TEMPLATES } from '@/lib/canva/canva-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;
    const templates = CanvaService.getTemplates(category);
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, title, width, height, templateId, customTitle } = body;

    if (action === 'editor_url') {
      const template = TRABZONSPOR_CANVA_TEMPLATES.find(t => t.id === templateId) || TRABZONSPOR_CANVA_TEMPLATES[0];
      const url = CanvaService.generateDirectEditorUrl(template, customTitle || title);
      return NextResponse.json({ success: true, url, template });
    }

    if (action === 'create') {
      const result = await CanvaService.createDesignWithConnectApi({
        title: title || 'Trabzonspor Tasarımı',
        width: width || 1080,
        height: height || 1080
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Geçersiz eylem' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
