import { checkContentQuality } from './src/lib/content/content-quality-checker';

(async () => {
  const result = await checkContentQuality(5);
  console.log("RESULT:", JSON.stringify(result, null, 2));
})();
