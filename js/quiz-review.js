const supabaseClient = window.supabase.createClient(
  "https://bvpfmvgjtfjfvquxduku.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cGZtdmdqdGZqZnZxdXhkdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc5OTIsImV4cCI6MjA4ODEwMzk5Mn0.F7PpoHyqAaI2N05uPDjdZvOsdeBW6TzaQfb30lz2i6U",
);

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const quizId = params.get("id");

  if (!quizId) {
    window.location.href = "../pages/dashboard.html";
    return;
  }
  document.querySelector(".top-nav button").onclick = () => {
    window.location.href = "../pages/dashboard.html?tab=quiz";
  };

  const { data, error } = await supabaseClient
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .single();

  if (error || !data) {
    alert("Quiz not found!");
    window.location.href = "../pages/dashboard.html";
    return;
  }

  const questions = data.questions || [];
  const score = data.score || 0;
  const total = data.total_questions || questions.length;
  const percent = Math.round((score / total) * 100);

  // Hide loader, show result
  document.getElementById("loadingBox").style.display = "none";
  document.getElementById("loadingBox").style.visibility = "hidden";
  document.getElementById("reviewResult").style.display = "block";

  document.getElementById("quizTitle").innerText = ` ${data.title}`;
  document.getElementById("scoreText").innerText = `${score} / ${total}`;
  document.getElementById("accuracyText").innerText = `${percent}%`;

  // Focus area — we don't have selectedAnswers stored so show score based message
  const focusDiv = document.getElementById("focusArea");
  if (percent >= 90) {
    focusDiv.innerHTML = `<p style="color:#22c55e; text-align:center;">🎉 Excellent performance!</p>`;
  } else if (percent >= 60) {
    focusDiv.innerHTML = `<p style="color:#eab308; text-align:center;"> Good job! Review the questions below to improve.</p>`;
  } else {
    focusDiv.innerHTML = `<p style="color:#ef4444; text-align:center;">📌 Needs improvement — review all questions carefully.</p>`;
  }

  // Review section
  const reviewDiv = document.getElementById("reviewSection");
  const letters = ["A", "B", "C", "D"];

  questions.forEach((q, i) => {
    const qDiv = document.createElement("div");
    qDiv.style.cssText =
      "margin-bottom:20px; text-align:left; background:#f8fafc; padding:16px; border-radius:12px;";
    qDiv.innerHTML = `<p style="font-weight:600; margin-bottom:10px; color:#0f172a;">${i + 1}. ${q.question}</p>`;

    q.options.forEach((opt, idx) => {
      let bg = "#f1f5f9";
      let color = "#475569";
      let icon = "";

      if (idx === q.answer) {
        bg = "#dcfce7";
        color = "#16a34a";
        icon = "✅";
      }

      qDiv.innerHTML += `
        <div style="padding:8px 12px; border-radius:8px; margin-bottom:6px; background:${bg}; color:${color}; font-size:14px;">
          ${icon} ${letters[idx]}) ${opt}
        </div>
      `;
    });

    reviewDiv.appendChild(qDiv);
  });

  // Download button
  document.getElementById("downloadBtn").onclick = () => {
    let text = `${data.title} - Quiz Review\n`;
    text += `Score: ${score}/${total} (${percent}%)\n\n`;

    questions.forEach((q, i) => {
      text += `${i + 1}. ${q.question}\n`;
      q.options.forEach((opt, idx) => {
        const isCorrect = idx === q.answer;
        text += `   ${letters[idx]}) ${opt} ${isCorrect ? "✅" : ""}\n`;
      });
      text += "\n";
    });

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title}-review.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Show user answers with correct/wrong highlighting
  const userAnswers = data.user_answers || [];

  userAnswers.length &&
    questions.forEach((q, i) => {
      const userAns = userAnswers[i];
      const correct = q.answer;

      // Find and update the already-rendered qDiv at position i
      const existingCards = reviewDiv.querySelectorAll("div[data-qi]");
      // We'll rebuild the review section entirely with user answer context
    });

  // Rebuild review with user answer highlighting if user_answers exist
  if (userAnswers.length) {
    reviewDiv.innerHTML = "";
    questions.forEach((q, i) => {
      const userAns = userAnswers[i];
      const correct = q.answer;

      const qDiv = document.createElement("div");
      qDiv.style.cssText =
        "margin-bottom:20px; text-align:left; background:#f8fafc; padding:16px; border-radius:12px;";
      qDiv.innerHTML = `<p style="font-weight:600; margin-bottom:10px; color:#0f172a;">${i + 1}. ${q.question}</p>`;

      q.options.forEach((opt, idx) => {
        let bg = "#f1f5f9";
        let color = "#475569";
        let icon = "";

        if (idx === correct) {
          bg = "#dcfce7";
          color = "#16a34a";
          icon = "✅";
        }
        if (idx === userAns && userAns !== correct) {
          bg = "#fee2e2";
          color = "#dc2626";
          icon = "❌";
        }

        qDiv.innerHTML += `
          <div style="padding:8px 12px; border-radius:8px; margin-bottom:6px; background:${bg}; color:${color}; font-size:14px;">
            ${icon} ${letters[idx]}) ${opt}
          </div>
        `;
      });

      reviewDiv.appendChild(qDiv);
    });
  }
});
