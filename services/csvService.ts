import { QuizQuestion } from "../types";

export const parseCSVQuiz = async (inputUrl: string): Promise<QuizQuestion[]> => {
  let csvUrl = inputUrl.trim();

  // --- 1. Google Sheets URL Normalization ---
  // If the URL already contains 'output=csv' or 'format=csv', we assume it's a direct download link
  const isDirectCsvLink = csvUrl.includes('output=csv') || csvUrl.includes('format=csv');

  if (!isDirectCsvLink) {
    // Detects standard Google Sheets URLs and converts them to CSV export URLs.
    const googleSheetRegex = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/;
    const match = csvUrl.match(googleSheetRegex);
    
    if (match && match[1]) {
      const sheetId = match[1];
      let gidParam = '';
      try {
        const urlObj = new URL(csvUrl);
        const gid = urlObj.searchParams.get('gid');
        if (gid) {
          gidParam = `&gid=${gid}`;
        }
      } catch (e) {
        // Ignore URL parsing errors
      }
      // If it looks like a published html link, we might not be able to simply convert. 
      // But standard edit links convert well.
      csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
      console.log("Converted to CSV URL:", csvUrl);
    }
  }

  // --- 2. Fetching Data with CORS Handling ---
  let text = '';
  try {
    console.log("Fetching CSV from:", csvUrl);
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
        // This usually happens when the sheet is not published properly or requires login
        throw new Error("HTML_RESPONSE"); 
    }
    
    text = await response.text();
    
    if (text.trim().toLowerCase().startsWith("<!doctype html")) {
        throw new Error("HTML_RESPONSE");
    }

  } catch (error: any) {
    console.warn("Direct fetch failed or returned HTML. Trying CORS proxy...", error);
    
    // Fallback: Use a CORS proxy (corsproxy.io is reliable for this)
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(csvUrl)}`;
    
    try {
        const proxyResponse = await fetch(proxyUrl);
        if (!proxyResponse.ok) throw new Error(`Proxy Error: ${proxyResponse.status}`);
        
        text = await proxyResponse.text();
        
        if (text.trim().toLowerCase().startsWith("<!doctype html") || text.includes("Google Accounts")) {
             throw new Error("Googleスプレッドシートの読み込みに失敗しました。URLが「リンクを知っている全員」に公開されているか、または「ウェブに公開」設定で「CSV形式」が選択されているか確認してください。");
        }
    } catch (proxyError: any) {
        throw new Error(`CSVの読み込みに失敗しました: ${error.message || 'Network Error'}`);
    }
  }

  // --- 3. Parsing CSV ---
  try {
    const lines = text.split('\n');
    const questions: QuizQuestion[] = [];

    // Simple CSV Line Parser handling quotes
    const parseLine = (line: string) => {
      const result = [];
      let cell = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(cell.trim());
          cell = '';
        } else {
          cell += char;
        }
      }
      result.push(cell.trim());
      return result.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
    };

    // Process rows (Skip header index 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseLine(line);
      
      // Need at least Question + 4 Options (5 cols)
      if (cols.length < 5) continue;

      let correctIndex = 0;
      let explanation = "";
      let optionImages: string[] = [];

      // Detection: Image Format vs Standard Format
      // Image Format usually has 11 columns: Q, O1-O4, I1-I4, Correct, Exp
      // Standard Format has 7 columns: Q, O1-O4, Correct, Exp
      
      // Check column J (index 9) for correct answer index
      const colJ = cols[9] ? parseInt(cols[9], 10) : NaN;
      // Check column F (index 5) for correct answer index (Standard format)
      const colF = cols[5] ? parseInt(cols[5], 10) : NaN;

      const isImageFormat = cols.length >= 7 && !isNaN(colJ);

      if (isImageFormat) {
         // NEW FORMAT with Images
         // F, G, H, I are images
         optionImages = [cols[5] || "", cols[6] || "", cols[7] || "", cols[8] || ""];
         correctIndex = isNaN(colJ) ? 0 : colJ - 1;
         explanation = cols[10] || "解説はありません";
      } else {
         // OLD FORMAT
         // F is Correct Index
         correctIndex = isNaN(colF) ? 0 : colF - 1;
         explanation = cols[6] || "解説はありません";
      }

      questions.push({
        id: `csv-${Date.now()}-${i}`,
        text: cols[0] || "無題の問題",
        options: [cols[1] || "", cols[2] || "", cols[3] || "", cols[4] || ""],
        optionImages: optionImages.some(img => img && img.trim() !== "") ? optionImages : undefined,
        correctIndex: Math.max(0, Math.min(3, correctIndex)), // Bound to 0-3
        explanation: explanation
      });
    }

    if (questions.length === 0) {
      throw new Error("有効な問題データが見つかりませんでした。CSVの列形式を確認してください。");
    }

    return questions;

  } catch (error: any) {
    console.error("CSV Parse Error:", error);
    throw error;
  }
};
