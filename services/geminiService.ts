import { GoogleGenAI, Type } from "@google/genai";
import { QuizQuestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateQuizQuestions = async (topic: string, count: number = 5): Promise<QuizQuestion[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create a fun and engaging multiple-choice quiz about "${topic}" in Japanese. 
      Generate ${count} questions. 
      Ensure the questions are suitable for a general audience.
      Provide 4 options for each question.
      The content must be in Japanese language.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "The question text in Japanese" },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING }, 
                description: "Array of 4 distinct options in Japanese" 
              },
              correctIndex: { type: Type.INTEGER, description: "Index (0-3) of the correct answer" },
              explanation: { type: Type.STRING, description: "Brief explanation of the answer in Japanese" }
            },
            required: ["text", "options", "correctIndex", "explanation"]
          }
        }
      }
    });

    const rawData = response.text;
    if (!rawData) throw new Error("No data returned from Gemini");

    const parsedData = JSON.parse(rawData);
    
    // Add IDs to the questions
    return parsedData.map((q: any, index: number) => ({
      ...q,
      id: `q-${Date.now()}-${index}`
    }));

  } catch (error) {
    console.error("Failed to generate quiz:", error);
    throw error;
  }
};
