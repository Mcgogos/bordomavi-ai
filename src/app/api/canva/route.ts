import { NextRequest, NextResponse } from 'next/server';
import { CanvaService, TRABZONSPOR_CANVA_TEMPLATES } from '@/lib/canva/canva-service';
import { verifyApiAuthorization } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;
    const checkStatus = searchParams.get('status') === '1';

    const templates = CanvaService.getTemplates(category);
    if (checkStatus) {
      const status = await CanvaService.verifyConnection();
      const creds = await CanvaService.getCredentials();
      return NextResponse.json({
        success: true,
        templates,
        status,
        clientId: creds.clientId || '',
        hasClientSecret: Boolean(creds.clientSecret),
        hasAccessToken: Boolean(creds.accessToken),
        hasRecoveryCodes: Boolean(creds.recoveryCodes),
      });
    }

    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await verifyApiAuthorization(req);
  if (!authCheck.authorized) {
    return authCheck.unauthorizedResponse!;
  }

  try {
    const body = await req.json();
    const {
      action,
      title,
      width,
      height,
      templateId,
      customTitle,
      clientId,
      clientSecret,
      accessToken,
      recoveryCodes,
    } = body;

    if (action === 'save_credentials') {
      await CanvaService.saveCredentials({
        clientId,
        clientSecret,
        accessToken,
        recoveryCodes,
      });
      const status = await CanvaService.verifyConnection();
      return NextResponse.json({
        success: true,
        status,
        message: 'Canva API ve güvenlik bilgileri veritabanına kaydedildi.',
      });
    }

    if (action === 'editor_url') {
      const template =
        TRABZONSPOR_CANVA_TEMPLATES.find((t) => t.id === templateId) ||
        TRABZONSPOR_CANVA_TEMPLATES[0];
      const url = CanvaService.generateDirectEditorUrl(template, customTitle || title);
      return NextResponse.json({ success: true, url, template });
    }

    if (action === 'create') {
      const result = await CanvaService.createDesignWithConnectApi({
        title: title || 'Trabzonspor Tasarımı',
        width: width || 1080,
        height: height || 1080,
      });
      return NextResponse.json(result);
    }

    if (action === 'list_designs') {
      const items = await CanvaService.listDesigns(title);
      return NextResponse.json({ success: true, items });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz eylem' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
