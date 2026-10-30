"use client";

import React, { useState } from "react";
import {
  Play,
  ExternalLink,
  Flame,
  Film,
  CheckCircle2,
  Clock,
  RefreshCw,
  Send,
  X,
  Eye,
  ThumbsUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PublishedPostItem {
  id: string;
  title: string;
  type: string;
  publishedAt: string | null;
  facebookPostId: string | null;
  aiReasoning?: string | null;
  sourceImageUrl?: string | null;
}

export interface TrendingVideoItem {
  videoId: string;
  url: string;
  cleanTitle: string;
  channelName: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSeconds: number;
  viralScore: number;
  thumbnailUrl?: string;
  category: string;
}

interface SimpleAutonomousHubProps {
  publishedReelsAndPosts: PublishedPostItem[];
  initialTrendingVideos: TrendingVideoItem[];
  trendingUpdatedAt: string | null;
  publishedSlotsToday: string[];
}

export default function SimpleAutonomousHub({
  publishedReelsAndPosts,
  initialTrendingVideos,
  trendingUpdatedAt,
  publishedSlotsToday,
}: SimpleAutonomousHubProps) {
  const [trendingVideos, setTrendingVideos] = useState<TrendingVideoItem[]>(initialTrendingVideos);
  const [isRefreshingTrends, setIsRefreshingTrends] = useState(false);
  const [publishingVideoId, setPublishingVideoId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sayfa içi aktif video oynatıcı modalı (Hem Paylaşılan Facebook Reels hem Trend Videolar için)
  const [activePlayer, setActivePlayer] = useState<{
    title: string;
    facebookReelId?: string | null;
    youtubeVideoId?: string | null;
    directFacebookUrl?: string | null;
  } | null>(null);

  const extractYoutubeIdFromReasoning = (reasoning?: string | null): string | null => {
    if (!reasoning) return null;
    const m = reasoning.match(/(?:v=|shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  const handleRefreshTrends = async () => {
    setIsRefreshingTrends(true);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/viral?limit=8");
      const data = await res.json();
      if (data.success && Array.isArray(data.candidates)) {
        setTrendingVideos(data.candidates);
        setStatusBanner({
          type: "success",
          text: `✅ İnternet tarandı ve en trend ${data.candidates.length} Trabzonspor videosu güncellendi.`,
        });
      } else {
        setStatusBanner({
          type: "error",
          text: data.error || "Trend videolar güncellenemedi.",
        });
      }
    } catch (e: any) {
      setStatusBanner({
        type: "error",
        text: e.message || "Bağlantı hatası oluştu.",
      });
    } finally {
      setIsRefreshingTrends(false);
    }
  };

  const handlePublishViral = async (video?: TrendingVideoItem) => {
    const targetId = video?.videoId || "AUTO_TOP";
    setPublishingVideoId(targetId);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/viral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customVideoUrl: video?.url,
          customHeadline: video?.cleanTitle,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({
          type: "success",
          text: `🎉 "${data.cleanTitle}" yabancı logoları temizlenip 2x Bordo-Mavi logomuzla Facebook Reels olarak paylaşıldı!`,
        });
      } else {
        setStatusBanner({
          type: "error",
          text: data.error || "Paylaşım sırasında hata oluştu.",
        });
      }
    } catch (e: any) {
      setStatusBanner({
        type: "error",
        text: e.message || "Paylaşım isteği başarısız oldu.",
      });
    } finally {
      setPublishingVideoId(null);
    }
  };

  const dailySlots = [
    { id: "SLOT_0700_REELS", time: "07:00", label: "Sabah Reels Bülteni", badge: "REELS" },
    { id: "SLOT_1100_TEXT", time: "11:00", label: "Öğle Haber Kartı", badge: "HABER" },
    { id: "SLOT_1500_REELS", time: "15:00", label: "İkindi Viral Reels", badge: "VİRAL REELS" },
    { id: "SLOT_2030_REELS", time: "20:30", label: "Akşam Ana Viral Reels", badge: "VİRAL REELS" },
  ];

  return (
    <div className="space-y-6">
      {/* 1. GÜNLÜK 4 OTOMATİK YAYIN TAKVİMİ (SADE ÖZET) */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              7/24 Tam Otomatik Yayın Takvimi (Günde 4 Paylaşım)
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Bilgisayarınız kapalıyken de bulut sistemi bu saatlerde otomatik paylaşım yapar
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {dailySlots.map((slot) => {
            const isDone = publishedSlotsToday.includes(slot.id);
            return (
              <div
                key={slot.id}
                className={`rounded-xl p-3 border flex flex-col justify-between gap-1.5 transition-all ${
                  isDone
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-muted/30 border-border/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-foreground">{slot.time}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold px-2 py-0 border-primary/30 text-primary"
                  >
                    {slot.badge}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-muted-foreground font-medium truncate">{slot.label}</span>
                  {isDone ? (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Yayınlandı
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" /> Otomatikte
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Durum Bildirimi */}
      {statusBanner && (
        <div
          className={`rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 ${
            statusBanner.type === "success"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
              : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
          }`}
        >
          <span>{statusBanner.text}</span>
          <button onClick={() => setStatusBanner(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. PAYLAŞILAN REELS VE GÖNDERİLERİ İZLE */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Paylaşılan Reels Videoları ve Gönderiler
              </h2>
              <p className="text-xs text-muted-foreground">
                Facebook sayfanızda yayınlanan tüm Reels videolarını buradan doğrudan izleyebilir veya Facebook üzerinde açabilirsiniz
              </p>
            </div>
          </div>
          <a
            href="https://www.facebook.com/1415192102080896/reels/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline shrink-0"
          >
            Tüm Facebook Reels Sayfasını Aç <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {publishedReelsAndPosts.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Henüz yayınlanmış içerik bulunmuyor.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {publishedReelsAndPosts.map((post) => {
              const isReel = post.type === "REELS_SCRIPT" || post.title.includes("[VİRAL REELS]");
              const fbId = post.facebookPostId;
              const ytId = extractYoutubeIdFromReasoning(post.aiReasoning);
              const fbUrl = fbId
                ? isReel
                  ? `https://www.facebook.com/reel/${fbId}`
                  : `https://www.facebook.com/${fbId}`
                : "https://www.facebook.com/1415192102080896";

              return (
                <div
                  key={post.id}
                  className="rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/35 p-3.5 flex flex-col justify-between gap-3 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          className={`text-[10px] font-bold px-2 py-0.5 ${
                            isReel
                              ? "bg-[#781324] text-white"
                              : "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
                          }`}
                        >
                          {isReel ? "🎬 REELS VİDEO" : "📰 HABER KARTI"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {post.publishedAt
                            ? new Date(post.publishedAt).toLocaleString("tr-TR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">
                        {post.title}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {isReel && (fbId || ytId) && (
                      <Button
                        size="sm"
                        onClick={() =>
                          setActivePlayer({
                            title: post.title,
                            facebookReelId: fbId,
                            youtubeVideoId: ytId,
                            directFacebookUrl: fbUrl,
                          })
                        }
                        className="flex-1 bg-[#781324] hover:bg-[#5e0e1c] text-white font-bold text-xs h-9"
                      >
                        <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                        Panelde İzle
                      </Button>
                    )}

                    <a
                      href={fbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs h-9 px-3 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-sky-500" />
                      {isReel ? "Facebook Reels'te İzle" : "Facebook'ta Gör"}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. GÜNLÜK BELİRLENEN EN TREND TRABZONSPOR VİDEOLARI */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-foreground">
                  Günlük Belirlenen En Trend Trabzonspor Videoları
                </h2>
                {trendingUpdatedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    (Son Tarama:{" "}
                    {new Date(trendingUpdatedAt).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    )
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Sistem interneti tarayarak en yüksek etkileşimli Trabzonspor videolarını belirler. Videoları aşağıdan izleyebilir veya tek tıkla logomuzla paylaşabilirsiniz.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshingTrends || Boolean(publishingVideoId)}
              onClick={handleRefreshTrends}
              className="text-xs font-semibold h-9"
            >
              {isRefreshingTrends ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Trendleri Şimdi Yenile
            </Button>
          </div>
        </div>

        {trendingVideos.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Günlük trend video listesini görmek için &ldquo;Trendleri Şimdi Yenile&rdquo; butonuna tıklayın.
            </p>
            <Button size="sm" onClick={handleRefreshTrends} disabled={isRefreshingTrends}>
              <Flame className="w-4 h-4 mr-1.5" /> Trend Videoları Getir
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trendingVideos.map((video, idx) => {
              const isPublishingThis = publishingVideoId === video.videoId;
              const thumb =
                video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hq720_2.jpg`;

              return (
                <div
                  key={video.videoId}
                  className="rounded-xl border border-border/80 bg-card overflow-hidden flex flex-col justify-between shadow-xs hover:border-primary/40 transition-all group"
                >
                  {/* Video Önizleme Kapak Görseli */}
                  <div
                    onClick={() =>
                      setActivePlayer({
                        title: video.cleanTitle,
                        youtubeVideoId: video.videoId,
                        directFacebookUrl: video.url,
                      })
                    }
                    className="relative aspect-[9/13] w-full bg-black cursor-pointer overflow-hidden"
                  >
                    <img
                      src={thumb}
                      alt={video.cleanTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40" />

                    {/* Sıra & Viral Skor Rozeti */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <Badge className="bg-amber-500 text-black font-extrabold text-[10px] px-2 py-0.5">
                        #{idx + 1} TREND
                      </Badge>
                      <span className="text-[10px] font-bold bg-black/70 text-white px-2 py-0.5 rounded-full border border-white/15">
                        {video.durationSeconds} sn
                      </span>
                    </div>

                    {/* Orta Oynat Butonu */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/25 backdrop-blur-md border border-white/50 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg">
                        <Play className="w-5 h-5 ml-0.5 fill-current" />
                      </div>
                    </div>

                    {/* Alt İstatistik & Başlık */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 space-y-1.5">
                      <div className="flex items-center gap-3 text-[11px] font-bold text-amber-300">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {video.viewCount?.toLocaleString("tr-TR")}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {video.likeCount?.toLocaleString("tr-TR")}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white line-clamp-2 leading-snug">
                        {video.cleanTitle}
                      </p>
                    </div>
                  </div>

                  {/* Aksiyon Butonları */}
                  <div className="p-2.5 bg-card flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setActivePlayer({
                          title: video.cleanTitle,
                          youtubeVideoId: video.videoId,
                          directFacebookUrl: video.url,
                        })
                      }
                      className="flex-1 h-8 text-[11px] font-bold"
                    >
                      <Play className="w-3 h-3 mr-1" /> İzle
                    </Button>
                    <Button
                      size="sm"
                      disabled={Boolean(publishingVideoId)}
                      onClick={() => handlePublishViral(video)}
                      className="flex-1 h-8 text-[11px] font-bold bg-[#781324] hover:bg-[#5e0e1c] text-white"
                    >
                      {isPublishingThis ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-3 h-3 mr-1" /> Paylaş
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. SAYFA İÇİ VİDEO İZLEME MODALI (Reels & Trend Videolar İçin) */}
      {activePlayer && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActivePlayer(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl max-w-md w-full overflow-hidden shadow-2xl space-y-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
              <h3 className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">
                {activePlayer.title}
              </h3>
              <button
                onClick={() => setActivePlayer(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-[9/16] w-full max-h-[70vh] bg-black rounded-xl overflow-hidden flex items-center justify-center">
              {activePlayer.facebookReelId ? (
                <iframe
                  src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
                    `https://www.facebook.com/reel/${activePlayer.facebookReelId}`
                  )}&show_text=false&width=360`}
                  className="w-full h-full border-0"
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : activePlayer.youtubeVideoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${activePlayer.youtubeVideoId}?autoplay=1&rel=0`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : null}
            </div>

            {activePlayer.directFacebookUrl && (
              <div className="flex justify-end pt-1">
                <a
                  href={activePlayer.directFacebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                  Yeni Sekmede Aç <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
