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
  Mountain,
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
  videoSourceUrl?: string | null;
  thumbnailUrl?: string | null;
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
  const [loadingPlayerId, setLoadingPlayerId] = useState<string | null>(null);
  const [inlinePlayingPostId, setInlinePlayingPostId] = useState<string | null>(null);
  const [resolvedStreams, setResolvedStreams] = useState<Record<string, string>>({});
  const [statusBanner, setStatusBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sayfa içi aktif video/görsel oynatıcı modalı
  const [activePlayer, setActivePlayer] = useState<{
    title: string;
    videoSourceUrl?: string | null;
    imageUrl?: string | null;
    youtubeVideoId?: string | null;
    directExternalUrl?: string | null;
  } | null>(null);

  const extractYoutubeIdFromReasoning = (reasoning?: string | null): string | null => {
    if (!reasoning) return null;
    const m = reasoning.match(/(?:v=|shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  const handleWatchPublishedPost = async (post: PublishedPostItem, playInline = false) => {
    const isReel =
      post.type === "REELS_SCRIPT" ||
      post.title.includes("[VİRAL REELS]") ||
      post.title.includes("[TRABZON YÖRESİ VİRAL]");
    const fbId = post.facebookPostId;
    const ytId = extractYoutubeIdFromReasoning(post.aiReasoning);
    const fbUrl = fbId
      ? isReel
        ? `https://www.facebook.com/reel/${fbId}`
        : `https://www.facebook.com/${fbId}`
      : "https://www.facebook.com/1415192102080896";

    let streamUrl = resolvedStreams[post.id] || post.videoSourceUrl || null;
    let imageUrl = post.thumbnailUrl || null;

    // Eğer doğrudan MP4 akışı henüz çözülmediyse Facebook Graph API üzerinden anlık çek
    if (isReel && !streamUrl && fbId) {
      setLoadingPlayerId(post.id);
      try {
        const res = await fetch(`/api/viral/media?postId=${encodeURIComponent(fbId)}`);
        const data = await res.json();
        if (data.success && data.videoSourceUrl) {
          streamUrl = data.videoSourceUrl;
          setResolvedStreams((prev) => ({ ...prev, [post.id]: data.videoSourceUrl }));
        }
        if (data.success && data.thumbnailUrl && !imageUrl) {
          imageUrl = data.thumbnailUrl;
        }
      } catch {}
      setLoadingPlayerId(null);
    }

    if (playInline && streamUrl) {
      setInlinePlayingPostId(post.id);
      return;
    }

    setActivePlayer({
      title: post.title,
      videoSourceUrl: streamUrl,
      imageUrl: !isReel ? imageUrl : null,
      youtubeVideoId: !streamUrl ? ytId : null,
      directExternalUrl: fbUrl,
    });
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
          text: `✅ İnternet tarandı: Trabzonspor ve Trabzon yöresine ait en trend ${data.candidates.length} viral video güncellendi.`,
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
          preferCategory: video?.category === "Trabzon Yöresi" ? "Trabzon Yöresi" : "Trabzonspor",
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
    { id: "SLOT_1500_REELS", time: "15:00", label: "Trabzon Yöresi Viral Reels", badge: "YÖRE VİRAL" },
    { id: "SLOT_2030_REELS", time: "20:30", label: "Akşam Trabzonspor Viral Reels", badge: "TS VİRAL" },
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
            Her gün Trabzonspor ve Trabzon yöresinin en viral videoları otomatik çekilip yayınlanır
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
                <div className="flex items-center justify-between text-xs mt-1 gap-1">
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
                Yayınlanan tüm Reels videolarını doğrudan kartın içinde veya tam ekran oynatıcıda sesli olarak izleyebilirsiniz
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publishedReelsAndPosts.map((post) => {
              const isRegionReel = post.title.includes("[TRABZON YÖRESİ VİRAL]");
              const isReel =
                post.type === "REELS_SCRIPT" ||
                post.title.includes("[VİRAL REELS]") ||
                isRegionReel;
              const fbId = post.facebookPostId;
              const ytId = extractYoutubeIdFromReasoning(post.aiReasoning);
              const fbUrl = fbId
                ? isReel
                  ? `https://www.facebook.com/reel/${fbId}`
                  : `https://www.facebook.com/${fbId}`
                : "https://www.facebook.com/1415192102080896";

              const streamUrl = resolvedStreams[post.id] || post.videoSourceUrl || null;
              const thumbUrl =
                post.thumbnailUrl ||
                (ytId ? `https://i.ytimg.com/vi/${ytId}/hq720_2.jpg` : null);
              const isPlayingInline = inlinePlayingPostId === post.id && Boolean(streamUrl);
              const isLoadingThis = loadingPlayerId === post.id;

              return (
                <div
                  key={post.id}
                  className="rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/35 overflow-hidden flex flex-col justify-between transition-all"
                >
                  {/* Video veya Görsel Önizleme Alanı */}
                  {isPlayingInline && streamUrl ? (
                    <div className="relative aspect-[9/14] w-full bg-black">
                      <video
                        src={streamUrl}
                        poster={thumbUrl || undefined}
                        controls
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain bg-black"
                      />
                      <button
                        onClick={() => setInlinePlayingPostId(null)}
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/75 text-white flex items-center justify-center hover:bg-black"
                        title="Oynatıcıyı Kapat"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleWatchPublishedPost(post, true)}
                      className="relative aspect-[16/10] w-full bg-zinc-900 cursor-pointer overflow-hidden group"
                    >
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={post.title}
                          className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#781324] via-zinc-900 to-[#0c4a6e]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/30" />

                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                        <Badge
                          className={`text-[10px] font-bold px-2 py-0.5 ${
                            isRegionReel
                              ? "bg-emerald-600 text-white"
                              : isReel
                              ? "bg-[#781324] text-white"
                              : "bg-sky-600 text-white"
                          }`}
                        >
                          {isRegionReel
                            ? "🌲 TRABZON YÖRESİ REELS"
                            : isReel
                            ? "🎬 REELS VİDEO"
                            : "📰 HABER KARTI"}
                        </Badge>
                        <span className="text-[10px] text-white/90 bg-black/60 px-2 py-0.5 rounded-full font-medium">
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

                      {isReel && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-[#781324]/90 border-2 border-white/80 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-xl">
                            {isLoadingThis ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Play className="w-5 h-5 ml-0.5 fill-current" />
                            )}
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-2.5 left-2.5 right-2.5">
                        <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug drop-shadow">
                          {post.title}
                        </h3>
                      </div>
                    </div>
                  )}

                  {/* Alt Butonlar */}
                  <div className="p-3 flex items-center gap-2 bg-card">
                    <Button
                      size="sm"
                      disabled={isLoadingThis}
                      onClick={() => handleWatchPublishedPost(post, false)}
                      className="flex-1 bg-[#781324] hover:bg-[#5e0e1c] text-white font-bold text-xs h-9"
                    >
                      {isLoadingThis ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                      )}
                      {isReel ? "Panelde İzle" : "Görseli Aç"}
                    </Button>

                    <a
                      href={fbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs h-9 px-3 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-sky-500" />
                      {isReel ? "Facebook'ta Aç" : "Facebook'ta Gör"}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. GÜNLÜK BELİRLENEN EN TREND TRABZONSPOR & TRABZON YÖRESİ VİDEOLARI */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-foreground">
                  Günlük Belirlenen En Trend Trabzonspor & Trabzon Yöresi Videoları
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
                Sistem her gün en yüksek etkileşimli Trabzonspor videoları ile Trabzon yöresine ait günün en viral videolarını belirler ve logomuzla yayınlar.
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
              const isRegionVideo = video.category === "Trabzon Yöresi";
              const thumb =
                video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hq720_2.jpg`;

              return (
                <div
                  key={video.videoId}
                  className={`rounded-xl border bg-card overflow-hidden flex flex-col justify-between shadow-xs transition-all group ${
                    isRegionVideo
                      ? "border-emerald-500/50 hover:border-emerald-500"
                      : "border-border/80 hover:border-primary/40"
                  }`}
                >
                  {/* Video Önizleme Kapak Görseli */}
                  <div
                    onClick={() =>
                      setActivePlayer({
                        title: video.cleanTitle,
                        youtubeVideoId: video.videoId,
                        directExternalUrl: video.url,
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

                    {/* Sıra & Kategori Rozeti */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
                      {isRegionVideo ? (
                        <Badge className="bg-emerald-600 text-white font-extrabold text-[10px] px-2 py-0.5 flex items-center gap-1">
                          <Mountain className="w-3 h-3" /> TRABZON YÖRESİ VİRAL
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500 text-black font-extrabold text-[10px] px-2 py-0.5">
                          #{idx + 1} TS TREND
                        </Badge>
                      )}
                      <span className="text-[10px] font-bold bg-black/70 text-white px-2 py-0.5 rounded-full border border-white/15 shrink-0">
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
                          directExternalUrl: video.url,
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
                      className={`flex-1 h-8 text-[11px] font-bold text-white ${
                        isRegionVideo
                          ? "bg-emerald-700 hover:bg-emerald-800"
                          : "bg-[#781324] hover:bg-[#5e0e1c]"
                      }`}
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

      {/* 4. SAYFA İÇİ DOĞRUDAN VİDEO İZLEME MODALI (HTML5 MP4 & YouTube Shorts) */}
      {activePlayer && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
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

            <div className="aspect-[9/16] w-full max-h-[72vh] bg-black rounded-xl overflow-hidden flex items-center justify-center">
              {activePlayer.videoSourceUrl ? (
                <video
                  src={activePlayer.videoSourceUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              ) : activePlayer.imageUrl ? (
                <img
                  src={activePlayer.imageUrl}
                  alt={activePlayer.title}
                  className="w-full h-full object-contain bg-black"
                />
              ) : activePlayer.youtubeVideoId ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${activePlayer.youtubeVideoId}?autoplay=1&playsinline=1&rel=0`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="p-6 text-center text-xs text-white/80 space-y-3">
                  <p>Video akışı doğrudan bağlantıda hazır.</p>
                  {activePlayer.directExternalUrl && (
                    <a
                      href={activePlayer.directExternalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#781324] text-white font-bold"
                    >
                      Videoyu Aç <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {activePlayer.directExternalUrl && (
              <div className="flex justify-end pt-1">
                <a
                  href={activePlayer.directExternalUrl}
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
