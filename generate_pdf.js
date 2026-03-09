const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const htmlPath = path.resolve(__dirname, "..", "portfolio", "ilmavent", "index.html");
  const pdfPath = path.resolve(__dirname, "..", "portfolio", "ilmavent", "case_study.pdf");

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set viewport to match A4 width with margins (210mm - 36mm margins = 174mm ≈ 657px at 96dpi)
  await page.setViewport({ width: 800, height: 1200 });
  await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle0" });
  await page.emulateMediaType("print");

  // Step 1: Measure all sections
  const measurements = await page.evaluate(() => {
    const sections = document.querySelectorAll(".container > .section, .container > .footer");
    const header = document.querySelector(".header");
    const results = [];

    results.push({ name: "header", height: header.offsetHeight, top: header.offsetTop });

    sections.forEach((s, i) => {
      const label = s.querySelector(".section-label");
      const cls = s.className;
      results.push({
        name: label ? label.textContent : (cls.includes("footer") ? "footer" : `section-${i}`),
        height: s.offsetHeight,
        top: s.offsetTop,
        class: cls
      });
    });

    return results;
  });

  console.log("=== Element measurements ===");
  let totalHeight = 0;
  measurements.forEach(m => {
    console.log(`${m.name}: ${m.height}px (top: ${m.top}px)`);
    totalHeight += m.height;
  });
  console.log(`Total content: ${totalHeight}px`);

  // A4 page content area: 297mm - 40mm (top+bottom margins) = 257mm ≈ 971px at 96dpi
  const PAGE_HEIGHT = 971;
  console.log(`\nPage height: ${PAGE_HEIGHT}px`);

  // Step 2: Calculate page distribution
  let currentPageHeight = 0;
  let currentPage = 1;
  const pageBreakBefore = [];

  console.log(`\n=== Page distribution ===`);
  console.log(`Page ${currentPage}:`);

  for (const m of measurements) {
    if (currentPageHeight + m.height > PAGE_HEIGHT && currentPageHeight > 0) {
      // This element doesn't fit on current page
      currentPage++;
      currentPageHeight = 0;
      pageBreakBefore.push(m.name);
      console.log(`--- PAGE BREAK ---`);
      console.log(`Page ${currentPage}:`);
    }
    console.log(`  ${m.name}: ${m.height}px (cumulative: ${currentPageHeight + m.height}px)`);
    currentPageHeight += m.height;
  }
  console.log(`\nTotal pages: ${currentPage}`);
  console.log(`Page breaks before: ${pageBreakBefore.join(", ")}`);

  // Step 3: Remove ALL existing CSS page-break rules, then add computed ones
  await page.evaluate((breakNames) => {
    // Remove all page-break rules
    const style = document.createElement("style");
    style.textContent = `
      @media print {
        .section { page-break-inside: auto !important; }
        .details-grid { page-break-inside: auto !important; }
        .results-table { page-break-inside: auto !important; }
        .solution-card { page-break-inside: auto !important; break-inside: auto !important; }
        .section-results { page-break-before: auto !important; }
        h2, h3 { page-break-after: auto !important; break-after: auto !important; }
      }
    `;
    document.head.appendChild(style);

    // Add page breaks at calculated positions
    const sections = document.querySelectorAll(".container > .section, .container > .footer");
    const header = document.querySelector(".header");
    const allElements = [{ el: header, name: "header" }];

    sections.forEach((s, i) => {
      const label = s.querySelector(".section-label");
      const cls = s.className;
      allElements.push({
        el: s,
        name: label ? label.textContent : (cls.includes("footer") ? "footer" : `section-${i}`)
      });
    });

    for (const item of allElements) {
      if (breakNames.includes(item.name)) {
        item.el.style.pageBreakBefore = "always";
        item.el.style.breakBefore = "page";
      }
    }
  }, pageBreakBefore);

  // Step 4: Generate PDF
  await page.pdf({
    path: pdfPath,
    format: "A4",
    margin: { top: "20mm", bottom: "20mm", left: "18mm", right: "18mm" },
    printBackground: true,
    preferCSSPageSize: false
  });

  console.log(`\nPDF saved: ${pdfPath}`);
  await browser.close();
})();
