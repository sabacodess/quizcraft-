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
          model: "meta-llama/llama-3.2-3b-instruct:free",
          messages: [
            {
              role: "user",
              content: `Summarize this in clear bullet points. Be concise and student-friendly:\n\n${text}`,
            },
          ],
        }),
      },
    );
    const data = await response.json();
    console.log("OpenRouter raw response:", JSON.stringify(data)); // add karo
    const summary =
      data.choices?.[0]?.message?.content || "Summary not generated";

    return new Response(JSON.stringify({ summary }), {
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
