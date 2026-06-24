import { GoogleGenAI, Type } from "@google/genai";

// Function to fetch the API key with maximum flexibility (localStorage first, then environment)
export const getGeminiApiKey = (): string => {
  if (typeof window !== "undefined") {
    const localKey = window.localStorage.getItem("GEMINI_API_KEY");
    if (localKey && localKey.trim()) {
      return localKey.trim();
    }
  }

  // Check Vite build defines
  if (typeof process !== "undefined" && process.env) {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    if (process.env.API_KEY) return process.env.API_KEY;
  }

  // Check Vite import.meta
  try {
    const importMetaEnv = (import.meta as any).env;
    if (importMetaEnv) {
      if (importMetaEnv.VITE_GEMINI_API_KEY) return importMetaEnv.VITE_GEMINI_API_KEY;
      if (importMetaEnv.VITE_API_KEY) return importMetaEnv.VITE_API_KEY;
    }
  } catch (e) {}

  return "";
};

// Helper to save API key
export const saveGeminiApiKey = (key: string) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("GEMINI_API_KEY", key.trim());
  }
};

export const analyzeTranscriptClient = async (text: string): Promise<any> => {
  const apiKey = getGeminiApiKey();
  
  if (!apiKey) {
    throw new Error("لم يتم العثور على مفتاح API الخاص بـ Gemini. يرجى إدخال مفتاح الـ API الخاص بـ Gemini في إعدادات التطبيق أو الكود.");
  }

  try {
    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `قم بتحليل النص التالي المستخرج من تسجيل صوتي لفاتورة مبيعات في معرض سيراميك، واستخرج منه اسم الزبون (إن وجد) وقائمة المنتجات مع كمياتها (بالمتر، الحبة، أو الطقم) وأسعارها الإفرادية (إن وجدت).\n\nالنص: ${text}`,
      config: {
        systemInstruction: "أنت مساعد ذكي ونظام محاسبي لمعرض سيراميك، تقوم بتحليل الكلام وتستخرج بيانات الفاتورة بدقة وتعيدها بتنسيق JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING, description: "اسم الزبون المذكور في الطلب، اتركه فارغا إذا لم يذكر" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "اسم المنتج (مثال: سيراميك إسباني، بورسلان، شطاف، اسمنت، الخ)" },
                  quantity: { type: Type.NUMBER, description: "الكمية، إذا لم تذكر وتفهم ضمنا أنها 1 ضع 1" },
                  unit: { type: Type.STRING, description: "وحدة القياس (مثال: متر، حبة، طقم، كيس). المتر للسيراميك والبورسلان، الحبة للمواد الأخرى" },
                  price: { type: Type.NUMBER, description: "السعر الإفرادي، إذا لم يُذكر ضع 0" }
                },
                required: ["name", "quantity", "unit", "price"]
              }
            }
          },
          required: ["items"]
        }
      }
    });

    if (!response.text) {
      throw new Error("لم يستطع الذكاء الاصطناعي معالجة النص");
    }

    return JSON.parse(response.text.trim());
  } catch (error: any) {
    console.error("Client AI Error:", error);
    let errorMsg = error.message || "حدث خطأ غير معروف بالفاتورة الذكية";
    
    if (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID")) {
      throw new Error("مفتاح الـ API غير صالح. يرجى التحقق من صحة المفتاح وإعادة المحاولة.");
    }
    
    throw new Error(errorMsg);
  }
};

// Smart analysis removed as per user request.
export const analyzeLedger = async (): Promise<string> => {
  return "";
};
