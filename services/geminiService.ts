import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";
import { AI_MODEL } from "../constants";

const getApiKey = (): string | undefined => {
  return process.env.API_KEY;
};

export const analyzeCollage = async (
  base64Image: string
): Promise<AIAnalysisResult> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key not found in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Remove data URL prefix if present for raw base64
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64,
          },
        },
        {
          text: "分析这张拼贴图片。请提供一个富有创意和艺术感的标题，以及一段简短诗意的描述（不超过2句话），用以概括这组图片的整体氛围或主题。请务必使用中文（简体）返回 JSON 格式结果。",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["title", "description"],
      },
    },
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  try {
    return JSON.parse(response.text) as AIAnalysisResult;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    throw new Error("Failed to parse AI analysis");
  }
};