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
      
      // Validate column count (approx 7 columns based on user spec)
      // 0:Question, 1:Opt1, 2:Opt2, 3:Opt3, 4:Opt4, 5:CorrectIndex(1-4), 6:Explanation
      if (cols.length < 7) continue;

      const correctNum = parseInt(cols[5], 10);
      const correctIndex = isNaN(correctNum) ? 0 : correctNum - 1; // Convert 1-based to 0-based

      questions.push({
        id: `csv-${Date.now()}-${i}`,
        text: cols[0],
        options: [cols[1], cols[2], cols[3], cols[4]],
        correctIndex: Math.max(0, Math.min(3, correctIndex)), // Ensure 0-3 range
        explanation: cols[6] || "解説はありません"
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
