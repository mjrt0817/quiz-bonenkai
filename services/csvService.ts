import { QuizQuestion } from "../types";

export const parseCSVQuiz = async (inputUrl: string): Promise<QuizQuestion[]> => {
  let csvUrl = inputUrl.trim();

  // --- 1. Google Sheets URL Automatic Conversion ---
  // Detects standard Google Sheets URLs and converts them to CSV export URLs.
  // Example: https://docs.google.com/spreadsheets/d/ABC123_ID/edit#gid=0 -> https://docs.google.com/spreadsheets/d/ABC123_ID/export?format=csv
  const googleSheetRegex = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const match = csvUrl.match(googleSheetRegex);
  
  if (match && match[1]) {
    const sheetId = match[1];
    // Attempt to preserve the sheet GID if present
    let gidParam = '';
    try {
      const urlObj = new URL(csvUrl);
      const gid = urlObj.searchParams.get('gid');
      if (gid) {
        gidParam = `&gid=${gid}`;
      }
    } catch (e) {
      // Ignore URL parsing errors for partial inputs
    }
    
    csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
    console.log("Converted to CSV URL:", csvUrl);
  }

  try {
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      if (response.status === 404) throw new Error("ファイルが見つかりません (404)。URLを確認してください。");
      if (response.status === 401 || response.status === 403) throw new Error("アクセス権限がありません。「リンクを知っている全員」に公開設定してください。");
      throw new Error(`ダウンロード失敗: ${response.status} ${response.statusText}`);
    }

    // Check for HTML response (common mistake when URL is wrong)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      throw new Error("CSVではなくHTMLが返されました。「ウェブに公開」から「CSV形式」を選択したURLを使用するか、スプレッドシートのURLを正しく入力してください。");
    }

    const text = await response.text();
    const lines = text.split('\n');
    const questions: QuizQuestion[] = [];

    // Helper to parse CSV line handling quotes
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

    // Skip header (index 0) and process rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseLine(line);
      
      // Determine format based on column count
      // A:Text, B-E:Opts, F-I:Imgs, J:Correct, K:Exp
      
      // We need at least Question + 4 Options (5 cols)
      if (cols.length < 5) continue;

      let correctIndex = 0;
      let explanation = "";
      let optionImages: string[] = [];

      // Logic to detect format (With Images vs Without Images)
      // New Format (With Images) usually has > 9 columns if images are used, or at least placeholders.
      // Standard Format: Q, O1, O2, O3, O4, Correct, Exp
      // Image Format:    Q, O1, O2, O3, O4, I1, I2, I3, I4, Correct, Exp
      
      // Heuristic: Check if column 9 (J) is a number (Correct Index for Image Format)
      const isImageFormat = cols.length >= 10 && !isNaN(parseInt(cols[9], 10));

      if (isImageFormat) {
         // NEW FORMAT
         optionImages = [cols[5] || "", cols[6] || "", cols[7] || "", cols[8] || ""];
         const correctNum = parseInt(cols[9], 10);
         correctIndex = isNaN(correctNum) ? 0 : correctNum - 1;
         explanation = cols[10] || "解説はありません";
      } else {
         // OLD FORMAT fallback
         // Try to find correct index at col 5
         const correctNum = parseInt(cols[5], 10);
         correctIndex = isNaN(correctNum) ? 0 : correctNum - 1;
         explanation = cols[6] || "解説はありません";
      }

      questions.push({
        id: `csv-${Date.now()}-${i}`,
        text: cols[0] || "無題の問題",
        options: [cols[1] || "", cols[2] || "", cols[3] || "", cols[4] || ""],
        optionImages: optionImages.some(img => img && img.trim() !== "") ? optionImages : undefined,
        correctIndex: Math.max(0, Math.min(3, correctIndex)), // Ensure 0-3 range
        explanation: explanation
      });
    }

    if (questions.length === 0) {
      throw new Error("有効な問題が見つかりませんでした。列の形式を確認してください。");
    }

    return questions;
  } catch (error) {
    console.error("CSV Parse Error:", error);
    throw error;
  }
};
