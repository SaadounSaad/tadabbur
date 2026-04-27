import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(StealthPlugin());

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    "Accept-Language": "ar,fr;q=0.9,en;q=0.8",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  console.log("Navigating...");
  await page.goto("https://shamela.ws/book/9776/1", { waitUntil: "domcontentloaded" });

  // Wait for Cloudflare challenge to resolve (up to 30s)
  console.log("Waiting for challenge to clear...");
  try {
    await page.waitForFunction(
      () => !document.title.toLowerCase().includes("just a moment") &&
            !document.body.innerText.includes("Vérification") &&
            !document.body.innerText.includes("vérifions"),
      { timeout: 30000, polling: 1000 }
    );
  } catch {
    console.log("Challenge still active after 30s — extracting whatever is on page");
  }
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    const bodyText = document.body.innerText.trim().slice(0, 800);
    const title = document.title;
    const url = location.href;

    const candidates: { tag: string; cls: string; text: string }[] = [];
    document.querySelectorAll("p, div, span, article, section").forEach(el => {
      const txt = el.textContent?.trim() ?? "";
      if (/[؀-ۿ]{20,}/.test(txt) && txt.length > 50 && txt.length < 5000) {
        candidates.push({
          tag: el.tagName,
          cls: (el as HTMLElement).className.slice(0, 80),
          text: txt.slice(0, 300),
        });
      }
    });

    return { bodyText, title, url, candidates: candidates.slice(0, 8) };
  });

  console.log("URL:", result.url);
  console.log("Title:", result.title);
  console.log("\n=== BODY TEXT ===\n", result.bodyText);
  console.log("\n=== ARABIC CANDIDATES ===");
  for (const c of result.candidates) {
    console.log(`\n<${c.tag} class="${c.cls}">\n${c.text}`);
  }

  await browser.close();
}

main().catch(console.error);
