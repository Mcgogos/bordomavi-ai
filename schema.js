const fs = require('fs'); const txt = \generator client {
  provider = \"prisma-client-js\"
}

datasource db {
  provider = \"postgresql\"
  url      = env(\"DATABASE_URL\")
}

// --- ENUMLAR ---
enum Role {
  ADMIN
  EDITOR
}

enum NewsSourceType {
  LOCAL
  NATIONAL
  CLUB
  INTERNATIONAL
}

enum ConfidenceLevel {
  VERIFIED
  POSSIBLE
  CLAIM
  UNVERIFIED
}

enum ContentType {
  NEWS
  COLUMN
  POLL
  NOSTALGIA
  MATCH_PREVIEW
  MATCH_REPORT
  TRANSFER
  PLAYER_ANALYSIS
  MANAGEMENT_ANALYSIS
  REELS_SCRIPT
  FAN_CONTENT
  QUESTION
}

enum ContentStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  SCHEDULED
  PUBLISHED
  REJECTED
  FAILED
}

enum LogLevel {
  INFO
  WARN
  ERROR
}

// --- MODELLER ---
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // Argon2 hash
  name      String
  role      Role     @default(EDITOR)
  createdAt DateTime @default(now())
}

model NewsSource {
  id        String         @id @default(cuid())
  name      String
  url       String
  rssUrl    String?
  type      NewsSourceType
  priority  Int            @default(50)
  isActive  Boolean        @default(true)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
  news      News[]
}

model NewsCluster {
  id          String   @id @default(cuid())
  topic       String
  summary     String?
  news        News[]
  createdAt   DateTime @default(now())
}

model News {
  id               String          @id @default(cuid())
  title            String
  url              String          @unique
  publishedAt      DateTime
  summary          String?
  
  sourceId         String
  source           NewsSource      @relation(fields: [sourceId], references: [id])
  category         String?
  
  externalId       String?
  canonicalUrl     String?
  contentHash      String?
  
  // AI Scores
  importanceScore  Int?
  credibilityScore Int?
  confidenceLevel  ConfidenceLevel?
  
  isProcessed      Boolean         @default(false)
  
  clusterId        String?
  cluster          NewsCluster?    @relation(fields: [clusterId], references: [id])
  
  createdAt        DateTime        @default(now())
}

model Content {
  id               String          @id @default(cuid())
  type             ContentType
  title            String
  body             String          
  
  targetAudience   String?
  tone             String?
  aiReasoning      String?         
  hashtags         String?         
  suggestedTime    DateTime?       
  
  viralScore       Int?
  newsValueScore   Int?
  discussionScore  Int?
  shareScore       Int?
  confidenceScore  Int?
  
  status           ContentStatus   @default(DRAFT)
  
  scheduledFor     DateTime?
  publishedAt      DateTime?
  facebookPostId   String?
  
  mediaId          String?
  media            Media?          @relation(fields: [mediaId], references: [id])
  
  versions         ContentVersion[]
  analytics        Analytics[]     
  
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
}

model ContentVersion {
  id        String   @id @default(cuid())
  contentId String
  content   Content  @relation(fields: [contentId], references: [id], onDelete: Cascade)
  body      String
  createdAt DateTime @default(now())
}

model Media {
  id            String    @id @default(cuid())
  type          String    // IMAGE, VIDEO
  url           String
  concept       String?
  prompt        String?
  isAiGenerated Boolean   @default(false)
  contents      Content[]
  createdAt     DateTime  @default(now())
}

model Analytics {
  id             String   @id @default(cuid())
  contentId      String
  content        Content  @relation(fields: [contentId], references: [id], onDelete: Cascade)
  reach          Int      @default(0)
  impressions    Int      @default(0)
  reactions      Int      @default(0)
  comments       Int      @default(0)
  shares         Int      @default(0)
  engagementRate Float    @default(0.0)
  recordedAt     DateTime @default(now()) 
}

model Prompt {
  id          String   @id @default(cuid())
  category    String   @unique 
  text        String
  isActive    Boolean  @default(true)
}

model SystemLog {
  id        String   @id @default(cuid())
  level     LogLevel
  source    String   
  message   String
  details   Json?
  createdAt DateTime @default(now())
}
\; fs.writeFileSync('prisma/schema.prisma', txt, 'utf8');
