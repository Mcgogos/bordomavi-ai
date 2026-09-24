import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { BORDOMAVI_BRAND_LOGO_DATA_URI } from '@/lib/canva/brand-logo-data';

interface SharePageProps {
  params: Promise<{ id: string }> | { id: string };
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const post = await prisma.content.findUnique({
    where: { id: resolvedParams.id },
    include: { sourceNews: true }
  });

  if (!post) {
    return { title: 'Bordo Mavi | Trabzonspor Haber Merkezi' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://bordomavi-ai.vercel.app';
  const cleanTitle = post.title.replace(/\*\*/g, '').trim();
  const cleanDesc = (post.body || '').replace(/\*\*/g, '').slice(0, 180).trim();
  const ogImageUrl = `${appUrl}/api/og?title=${encodeURIComponent(cleanTitle)}&template=BREAKING`;

  return {
    title: `${cleanTitle} | Bordo Mavi`,
    description: cleanDesc,
    openGraph: {
      title: cleanTitle,
      description: cleanDesc,
      url: `${appUrl}/share/${post.id}`,
      siteName: 'Bordo Mavi',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: cleanTitle,
        }
      ],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: cleanTitle,
      description: cleanDesc,
      images: [ogImageUrl],
    }
  };
}

export default async function PublicSharePage({ params }: SharePageProps) {
  const resolvedParams = await Promise.resolve(params);
  const post = await prisma.content.findUnique({
    where: { id: resolvedParams.id },
    include: { sourceNews: true }
  });

  if (!post) {
    notFound();
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://bordomavi-ai.vercel.app';
  const cleanTitle = post.title.replace(/\*\*/g, '').trim();
  const cleanBody = (post.body || '').replace(/\*\*/g, '').trim();
  const postShareUrl = `${appUrl}/share/${post.id}`;
  const ogImageUrl = `/api/og?title=${encodeURIComponent(cleanTitle)}&template=BREAKING`;
  const facebookSharerUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postShareUrl)}`;

  // Paragraflara ayır
  const paragraphs = cleanBody.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col font-sans selection:bg-[#781324] selection:text-white">
      {/* ÜST BAR */}
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img 
              src={BORDOMAVI_BRAND_LOGO_DATA_URI} 
              alt="BordoMavi Logo" 
              className="w-9 h-9 rounded-full object-contain bg-white/10 p-0.5 border border-amber-400/80 shadow-md"
            />
            <div className="flex flex-col">
              <span className="text-base font-black tracking-wider text-white">BORDOMAVI</span>
              <span className="text-[9px] font-bold text-amber-400 tracking-widest -mt-0.5">HABER MERKEZİ</span>
            </div>
          </div>

          <a
            href={facebookSharerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold shadow-md transition-all"
          >
            <span>Facebook'ta Paylaş</span>
          </a>
        </div>
      </header>

      {/* ANA İÇERİK */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8 flex-1 space-y-6">
        
        {/* Kategori & Tarih */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-[#781324]/30 border border-[#781324]/50 text-rose-300 font-bold uppercase tracking-wider text-[10px]">
            BORDO MAVİ ÖZEL HABER
          </span>
          <span className="text-slate-400">
            {new Date(post.publishedAt || post.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Başlık */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight">
          {cleanTitle}
        </h1>

        {/* Görsel Kartı */}
        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl aspect-video relative bg-slate-900">
          <img 
            src={ogImageUrl} 
            alt={cleanTitle} 
            className="w-full h-full object-cover"
          />
        </div>

        {/* Metin Paragrafları */}
        <article className="space-y-4 text-slate-200 text-base sm:text-lg leading-relaxed pt-2">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-slate-200/95 leading-relaxed font-normal">
              {para}
            </p>
          ))}
        </article>

        {/* Alt Eylem ve Takip Kartı */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#781324]/20 via-[#164E7A]/20 to-slate-900 border border-white/10 space-y-4 mt-8">
          <div className="flex items-center gap-3">
            <img 
              src={BORDOMAVI_BRAND_LOGO_DATA_URI} 
              alt="BordoMavi Logo" 
              className="w-12 h-12 rounded-full object-contain bg-white/10 p-1 border border-amber-400 shadow-md"
            />
            <div>
              <h3 className="font-bold text-white text-base">Trabzonspor Gündemini Kaçırmayın!</h3>
              <p className="text-xs text-slate-300">En sıcak gelişmeler, flaş transferler ve analizler için resmi sayfamızı takip edin.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a
              href="https://www.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs sm:text-sm font-bold shadow-md transition-all"
            >
              <span>Facebook'ta Takip Edin</span>
            </a>

            <a
              href={facebookSharerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-bold transition-all"
            >
              <span>Haberi Gruplarda Paylaş</span>
            </a>
          </div>
        </div>

      </main>

      {/* ALT FOOTER */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Bordo Mavi — Trabzonspor Bağımsız Taraftar Medya Platformu</p>
      </footer>
    </div>
  );
}
