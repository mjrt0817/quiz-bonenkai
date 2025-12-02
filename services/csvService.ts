import { QuizQuestion } from "../types";

export const parseCSVQuiz = async (csvUrl: string): Promise<QuizQuestion[]> => {
  try {
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);
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
      return result.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"')); // Remove surrounding quotes and unescape double quotes
    };

    // Skip header (index 0) and process rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseLine(line);
      
      // Determine format based on column count
      // Old Format: 0:Q, 1-4:Opts, 5:Correct, 6:Exp (Length ~7)
      // New Format: 0:Q, 1-4:Opts, 5-8:Images, 9:Correct, 10:Exp (Length ~11)
      
      if (cols.length < 7) continue;

      let correctIndex = 0;
      let explanation = "";
      let optionImages: string[] = [];

      // Check if column 9 exists and looks like the correct index (New Format)
      // Or if column 5 looks like correct index (Old Format)
      
      // Note: We prioritize the New Format structure if enough columns exist
      if (cols.length >= 10 && !isNaN(parseInt(cols[9], 10))) {
         // NEW FORMAT
         // 5,6,7,8 are images
         optionImages = [cols[5], cols[6], cols[7], cols[8]];
         const correctNum = parseInt(cols[9], 10);
         correctIndex = isNaN(correctNum) ? 0 : correctNum - 1;
         explanation = cols[10] || "解説はありません";
      } else {
         // OLD FORMAT fallback
         const correctNum = parseInt(cols[5], 10);
         correctIndex = isNaN(correctNum) ? 0 : correctNum - 1;
         explanation = cols[6] || "解説はありません";
      }

      questions.push({
        id: `csv-${Date.now()}-${i}`,
        text: cols[0],
        options: [cols[1], cols[2], cols[3], cols[4]],
        optionImages: optionImages.some(img => img !== "") ? optionImages : undefined,
        correctIndex: Math.max(0, Math.min(3, correctIndex)), // Ensure 0-3 range
        explanation: explanation
      });
    }

    if (questions.length === 0) {
      throw new Error("有効な問題が見つかりませんでした。列の順序を確認してください。");
    }

    return questions;
  } catch (error) {
    console.error("CSV Parse Error:", error);
    throw error;
  }
};
