import "dotenv/config";
const userToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const pageId = process.env.FACEBOOK_PAGE_ID;

const res = await fetch("https://graph.facebook.com/v21.0/" + pageId + "?fields=access_token&access_token=" + userToken);
const data = await res.json();
console.log("PAGE TOKEN RESPONSE:", JSON.stringify(data, null, 2));

