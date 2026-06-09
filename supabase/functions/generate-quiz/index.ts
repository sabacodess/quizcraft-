//@ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const { text, title } = await req.json();
    const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY1");

    const MODELS = [
      // "google/gemma-3-4b-it:free",
      // "mistralai/mistral-7b-instruct:free",
      // "meta-llama/llama-3.2-3b-instruct:free",
      // "qwen/qwen-2.5-7b-instruct:free",
     "google/gemma-3-12b-it:free",
     "google/gemma-3-4b-it:free", 
     "meta-llama/llama-3.1-8b-instruct:free",
     "mistralai/mistral-7b-instruct:free",
    "deepseek/deepseek-r1-0528:free",
    ];

    const prompt = `Generate exactly 10 multiple choice questions from this text.
Return ONLY a valid JSON array. No explanation. No markdown. No extra text.
Format:
[
  {
    "question": "Question here?",
    "options": ["A", "B", "C", "D"],
    "answer": 0
  }
]
"answer" is the index (0-3) of the correct option.

Text:
${text.slice(0, 3000)}`;

    let questions = null;
    let lastError = null;

    for (const model of MODELS) {
      console.log("Trying model:", model);
      try {
        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${OPENROUTER_KEY}`,
              "HTTP-Referer": "https://quizcraft.app",
              "X-Title": "QuizCraft",
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: prompt }],
            }),
          },
        );

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          lastError = data.error?.message || "No content";
          continue;
        }

        // JSON parse karo
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          lastError = "No JSON found in response";
          continue;
        }

        questions = JSON.parse(jsonMatch[0]);
        console.log("Questions generated:", questions.length);
        break;
      } catch (e) {
        lastError = e.message;
        console.log("Model failed:", model, e.message);
      }
    }

    if (!questions) {
      return new Response(
        JSON.stringify({ error: `All models failed: ${lastError}` }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    return new Response(JSON.stringify({ questions }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});
