# BORDO MAVİ AI — IMMUTABLE MASTER PROJECT RULES (MUTLAK DEĞİŞMEZ KURALLAR)

> [!IMPORTANT]
> **KULLANICI DİREKTİFİ & DEĞİŞMEZ KURAL (IMMUTABLE RULE ZERO):**
> Projede bundan sonra yapılacak **HİÇBİR** değişiklik ve tasarım (kod, sayfa yapısı, UI/UX, veritabanı, refactor vs.) otomatik tetiklemeyi ve yayınları tam saatinde paylaşmayı **BOZAMAZ**. 
> Günde **TAM 4 PAYLAŞIM** olan günlük yayın takviminin dışına **ASLA ÇIKILAMAZ**.

---

## 1. KESİN GÜNLÜK YAYIN TAKVİMİ (GÜNDE TAM 4 PAYLAŞIM)

Türkiye Saati (Europe/Istanbul - UTC+3) bazında her gün yalnızca ve tam saatinde şu 4 paylaşım yapılır:

| Slot Saati (TR) | Format | Açıklama | Otomasyon Mekanizması |
| :--- | :--- | :--- | :--- |
| **07:00** | **REELS** | Sabah Reels Bülteni | GitHub Actions (04:00 UTC) + Cloud Engine |
| **11:00** | **METİN HABERİ** | Gün Ortası Manşet Haberi | GitHub Actions (08:00 UTC) + Cloud Engine |
| **15:00** | **REELS** | Öğleden Sonra Reels Bülteni | GitHub Actions (12:00 UTC) + Cloud Engine |
| **20:30** | **REELS** | Akşam Prime-Time Reels Bülteni | GitHub Actions (17:30 UTC) + Cloud Engine |

- Bu 4 saat ve format kombinasyonu dışında **hiçbir ekstra otomatik paylaşım yapılamaz**.
- Slot saati gelmeden veya slot kotası dolmuşken otomatik yayın tetiklenemez.

---

## 2. 7/24 BULUT TETİKLEME DOKUNULMAZLIĞI

- Bilgisayar ve web arayüzü kapalı olsa dahi sistem `.github/workflows/auto-publish.yml` ve `vercel.json` çift yedekli bulut mekanizmasıyla tam saatinde tetiklenir.
- Yapılacak arayüz, API veya backend güncellemeleri aşağıdaki kritik dosyalardaki slot ve tetikleme mantığına asla zarar vermemelidir:
  - `src/lib/content/smart-publisher.ts`
  - `scripts/trigger_workflow.ts`
  - `.github/workflows/auto-publish.yml`
  - `vercel.json`
  - `src/lib/reels/reels-publisher.ts`

---

## 3. MÜKERRER HABER VE SES KALİTE KORUMASI

1. **Sıfır Tekrar Kuralı:** Daha önce Facebook'ta paylaşılmış hiçbir haber (metin veya Reels) tekrar paylaşılamaz. 60 günlük hafıza ve çapraz format kontrolü daima devrededir.
2. **Reels Spiker Sesi:** Bayan spiker sesi tok, ciddi haber spikeri tonunda (-8Hz pitch, +8% tempo, 190-340Hz sıcaklık filtresi) üretilmelidir.
