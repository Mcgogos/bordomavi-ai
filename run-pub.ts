import { publishReadyContent } from './src/lib/content/content-publisher';

(async () => {
  console.log("Testing publishing 1 content...");
  const result = await publishReadyContent(1);
  console.log("RESULT:", JSON.stringify(result, null, 2));
})();
