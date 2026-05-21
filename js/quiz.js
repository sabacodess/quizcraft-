const supabaseClient = window.supabase.createClient(
  "https://bvpfmvgjtfjfvquxduku.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cGZtdmdqdGZqZnZxdXhkdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc5OTIsImV4cCI6MjA4ODEwMzk5Mn0.F7PpoHyqAaI2N05uPDjdZvOsdeBW6TzaQfb30lz2i6U",
);

let quizData = [];
let currentQuestion = 0;
let selectedAnswers = [];
let quizId = null;
let quizCategory = "uncategorized";
let quizStartTime = null;
let currentUserId = null; // set on load — scopes localStorage to this user
let _pendingResumeProgress = null; // set when resume modal is shown

// ===================== ENTRY POINT =====================
window.onload = async () => {
  // Resolve logged-in user ID first — used to scope localStorage keys
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "../pages/login.html";
    return;
  }
  if (session?.user?.id) {
    currentUserId = session.user.id;
    // Store in sessionStorage so sync functions (nextQuestion) can always read it
    sessionStorage.setItem("quizcraft_uid", currentUserId);
  }

  const params = new URLSearchParams(window.location.search);
  const existingQuizId = params.get("quizId");
  const pdfId = params.get("id");

  if (existingQuizId) {
    await loadExistingQuiz(existingQuizId);
  } else if (pdfId) {
    await generateNewQuiz(pdfId);
  } else {
    alert("Koi PDF select nahi ki!");
    window.location.href = "../pages/upload.html";
  }
};

// ===================== TIMER =====================
let timer;
let timeLeft = 30;

function startTimer() {
  clearInterval(timer);
  timeLeft = 30;
  document.getElementById("timerDisplay").innerText = `⏱ 30s`;
  document.getElementById("timerDisplay").style.color = "#0f172a";

  timer = setInterval(() => {
    timeLeft--;
    document.getElementById("timerDisplay").innerText = `⏱ ${timeLeft}s`;

    if (timeLeft <= 10) {
      document.getElementById("timerDisplay").style.color = "#ef4444";
    } else {
      document.getElementById("timerDisplay").style.color = "#0f172a";
    }

    if (timeLeft === 0) {
      clearInterval(timer);
      autoAdvance();
    }
  }, 1000);
}

// Auto-advance when timer hits 0 — no popup
function autoAdvance() {
  if (selectedAnswers[currentQuestion] === undefined) {
    selectedAnswers[currentQuestion] = -1; // -1 = timed out / skipped
  }
  loadQuestion();
  renderPalette();

  if (currentQuestion < quizData.length - 1) {
    setTimeout(() => {
      currentQuestion++;
      loadQuestion();
      renderPalette();
      startTimer();
    }, 900);
  } else {
    setTimeout(() => submitQuiz(), 900);
  }
}

// ===================== GENERATE NEW QUIZ =====================
async function generateNewQuiz(pdfId) {
  try {
    const { data: pdfData, error: pdfError } = await supabaseClient
      .from("pdfs")
      .select("pdf_content, file_name, category")
      .eq("id", pdfId)
      .single();

    if (pdfError || !pdfData) {
      alert("PDF not found!");
      window.location.href = "../pages/upload.html";
      return;
    }

    const text = pdfData.pdf_content;
    const title = pdfData.file_name || "Quiz";
    quizCategory = pdfData.category || "uncategorized";

    if (!text || text.trim().length === 0) {
      alert("PDF mein text nahi mila!");
      window.location.href = "../pages/upload.html";
      return;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    const randomSeed = Math.random().toString(36).substring(2, 8);
    const focusTypes = [
      "definitions and key terms",
      "concepts and theories",
      "examples and applications",
      "cause and effect relationships",
      "comparisons and differences",
    ];
    const difficulties = ["easy", "medium", "hard"];
    const randomFocus =
      focusTypes[Math.floor(Math.random() * focusTypes.length)];
    const randomDiff =
      difficulties[Math.floor(Math.random() * difficulties.length)];

    const res = await fetch(
      "https://bvpfmvgjtfjfvquxduku.supabase.co/functions/v1/generate-quiz",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text,
          title,
          seed: randomSeed,
          focus: randomFocus,
          difficulty: randomDiff,
        }),
      },
    );

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    quizData = data.questions;

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    console.log("[QuizCraft] Saving quiz with category:", quizCategory);
    const { data: saved, error: saveError } = await supabaseClient
      .from("quizzes")
      .insert({
        user_id: user.id,
        category: quizCategory || "uncategorized",
        title: title.replace(".pdf", ""),
        total_questions: quizData.length,
        questions: quizData,
        score: null,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Quiz save error:", saveError);
    } else {
      quizId = saved.id;
    }

    const generated = JSON.parse(localStorage.getItem("generated") || "{}");
    generated[pdfId] = { ...generated[pdfId], quiz: true };
    localStorage.setItem("generated", JSON.stringify(generated));

    startQuiz();
  } catch (err) {
    alert("Quiz generate karne mein error: " + err.message);
    window.location.href = "../pages/upload.html";
  }
}

// ===================== LOAD EXISTING QUIZ =====================
async function loadExistingQuiz(id) {
  const { data, error } = await supabaseClient
    .from("quizzes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    alert("Quiz nahi mila!");
    window.location.href = "../pages/dashboard.html";
    return;
  }

  quizData = data.questions;
  quizId = data.id;
  quizCategory = data.category || "uncategorized";
  document.querySelector(".quiz-title").innerText = data.title;
  startQuiz();
}

// ===================== START QUIZ =====================
async function startQuiz() {
  document.getElementById("resultPage").style.display = "none";

  // ── Check Supabase for saved progress (keep loader visible during query) ──
  let _supabaseProgress = null;
  if (quizId && currentUserId) {
    const { data: _sp } = await supabaseClient
      .from("quiz_progress")
      .select(
        "current_question_index, selected_answers, quiz_title, total_questions",
      )
      .eq("user_id", currentUserId)
      .eq("quiz_id", quizId)
      .maybeSingle();
    if (_sp && _sp.current_question_index > 0) {
      _supabaseProgress = {
        questionIndex: _sp.current_question_index,
        selectedAnswers: _sp.selected_answers || [],
        quizTitle: _sp.quiz_title,
        totalQuestions: _sp.total_questions,
      };
    }
  }

  document.getElementById("quizLoading").style.display = "none";
  document.querySelector(".quiz-layout").style.display = "flex";

  if (_supabaseProgress) {
    _pendingResumeProgress = _supabaseProgress;
    document.getElementById("modalQNum").innerText =
      "Question " + (_supabaseProgress.questionIndex + 1);
    document.getElementById("resumeModal").style.display = "flex";
    loadQuestion();
    renderPalette();
    return;
  }

  // No saved progress — start fresh
  _beginQuiz();
}

// ─── start (or restart) the quiz from the current state ────────────────
function _beginQuiz() {
  quizStartTime = Date.now();
  loadQuestion();
  renderPalette();
  startTimer();
}

// ─── Resume button in modal ─────────────────────────────────────────────
function resumeQuiz() {
  if (_pendingResumeProgress) {
    currentQuestion = _pendingResumeProgress.questionIndex;
    selectedAnswers = _pendingResumeProgress.selectedAnswers || [];
    _pendingResumeProgress = null;
  }
  document.getElementById("resumeModal").style.display = "none";
  _beginQuiz();
}

// ─── Start Fresh button in modal ────────────────────────────────────────
function restartQuiz() {
  // Delete saved progress from Supabase (fire-and-forget)
  if (currentUserId && quizId) {
    supabaseClient
      .from("quiz_progress")
      .delete()
      .eq("user_id", currentUserId)
      .eq("quiz_id", quizId)
      .then(({ error }) => {
        if (error)
          console.warn("[QuizCraft] progress delete failed:", error.message);
      });
  }
  _pendingResumeProgress = null;
  currentQuestion = 0;
  selectedAnswers = [];
  document.getElementById("resumeModal").style.display = "none";
  _beginQuiz();
}

// ===================== LOAD QUESTION =====================
function loadQuestion() {
  const letters = ["A", "B", "C", "D"];
  const q = quizData[currentQuestion];
  document.getElementById("questionText").innerText = q.question;
  document.querySelector(".q-count").innerText =
    `Question ${currentQuestion + 1} of ${quizData.length}`;

  // Hide any previous warning
  const warn = document.getElementById("answerWarning");
  if (warn) warn.style.display = "none";

  const container = document.getElementById("optionsContainer");

  // Slide-in animation
  container.classList.remove("slide-in");
  void container.offsetWidth; // force reflow
  container.classList.add("slide-in");
  container.innerHTML = "";

  q.options.forEach((opt, index) => {
    const div = document.createElement("div");
    div.classList.add("option");

    const cleanOpt = opt.replace(/^[A-D][.)]\s*/i, "");
    div.innerText = `${letters[index]}) ${cleanOpt}`;

    const answered = selectedAnswers[currentQuestion] !== undefined;
    const isTimeout = selectedAnswers[currentQuestion] === -1;

    if (answered) {
      if (index === q.answer) {
        div.classList.add("correct");
      }
      if (
        !isTimeout &&
        index === selectedAnswers[currentQuestion] &&
        selectedAnswers[currentQuestion] !== q.answer
      ) {
        div.classList.add("wrong");
      }
      if (isTimeout && index === q.answer) {
        div.classList.add("correct");
        div.classList.add("timeout-reveal");
      }
      div.onclick = null;
    } else {
      div.onclick = () => {
        clearInterval(timer);
        selectedAnswers[currentQuestion] = index;
        loadQuestion();
        renderPalette();
        startTimer();
      };
    }

    container.appendChild(div);
  });

  updateProgress();

  // Enable Next only when current question already has an answer
  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn)
    nextBtn.disabled = selectedAnswers[currentQuestion] === undefined;
}

// ===================== PALETTE =====================
function renderPalette() {
  const palette = document.getElementById("palette");
  palette.innerHTML = "";

  quizData.forEach((_, index) => {
    const btn = document.createElement("div");
    btn.innerText = index + 1;
    btn.classList.add("palette-btn");

    if (index === currentQuestion) btn.classList.add("active");

    if (selectedAnswers[index] !== undefined) {
      if (selectedAnswers[index] === -1) {
        btn.classList.add("skipped"); // timed out
      } else if (selectedAnswers[index] === quizData[index].answer) {
        btn.classList.add("answered");
      } else {
        btn.classList.add("wrong-answer");
      }
    }

    btn.onclick = () => {
      currentQuestion = index;
      loadQuestion();
      renderPalette();
    };

    palette.appendChild(btn);
  });
}

// ===================== PROGRESS BAR =====================
function updateProgress() {
  const percent = ((currentQuestion + 1) / quizData.length) * 100;
  document.getElementById("progressFill").style.width = percent + "%";
}

// ===================== NEXT / PREV =====================
function nextQuestion() {
  if (selectedAnswers[currentQuestion] === undefined) {
    // Show subtle inline warning — NO browser alert
    let warn = document.getElementById("answerWarning");
    if (!warn) {
      warn = document.createElement("p");
      warn.id = "answerWarning";
      warn.className = "answer-warning";
      warn.innerText = "Please select an answer to move forward.";
      document
        .getElementById("optionsContainer")
        .insertAdjacentElement("afterend", warn);
    }
    warn.style.display = "block";
    warn.classList.remove("warn-fade");
    void warn.offsetWidth;
    warn.classList.add("warn-fade");
    return;
  }

  const warn = document.getElementById("answerWarning");
  if (warn) warn.style.display = "none";

  if (currentQuestion < quizData.length - 1) {
    currentQuestion++;

    // Upsert progress to Supabase (fire-and-forget)
    if (quizId && currentUserId) {
      const qTitle = document.querySelector(".quiz-title")?.innerText || "";
      supabaseClient
        .from("quiz_progress")
        .upsert(
          {
            user_id: currentUserId,
            quiz_id: quizId,
            quiz_title: qTitle,
            current_question_index: currentQuestion,
            total_questions: quizData.length,
            selected_answers: [...selectedAnswers],
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,quiz_id" },
        )
        .then(({ error }) => {
          if (error)
            console.warn("[QuizCraft] progress upsert failed:", error.message);
        });
    }

    loadQuestion();
    renderPalette();
    startTimer();
  } else {
    submitQuiz();
  }
}

function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    loadQuestion();
    renderPalette();
  }
}

// ===================== SUBMIT QUIZ =====================
async function submitQuiz() {
  // Delete saved progress from Supabase (fire-and-forget)
  if (quizId && currentUserId) {
    supabaseClient
      .from("quiz_progress")
      .delete()
      .eq("user_id", currentUserId)
      .eq("quiz_id", quizId)
      .then(({ error }) => {
        if (error)
          console.warn("[QuizCraft] progress delete failed:", error.message);
      });
  }

  clearInterval(timer);

  const timeTakenMs = quizStartTime ? Date.now() - quizStartTime : 0;
  const timeTakenSecs = Math.round(timeTakenMs / 1000);
  const timeTakenStr =
    timeTakenSecs >= 60
      ? `${Math.floor(timeTakenSecs / 60)}m ${timeTakenSecs % 60}s`
      : `${timeTakenSecs}s`;

  let score = 0;
  let weakTopics = [];

  selectedAnswers.forEach((ans, i) => {
    if (ans === quizData[i].answer) {
      score++;
    } else {
      weakTopics.push(quizData[i].question);
    }
  });

  const total = quizData.length;
  const percent = Math.round((score / total) * 100);

  if (quizId) {
    await supabaseClient
      .from("quizzes")
      .update({ score, user_answers: selectedAnswers })
      .eq("id", quizId);
  }

  // ── Award XP ────────────────────────────────────────────────────────────────
  let xpEarned = 0;
  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (user) {
      xpEarned = score * 10;
      if (percent === 100) xpEarned += 50;
      else if (percent >= 80) xpEarned += 20;

      // Step 1: read current XP
      const { data: prof, error: profErr } = await supabaseClient
        .from("profiles")
        .select("total_xp")
        .eq("id", user.id)
        .single();

      if (profErr) console.warn("[QuizCraft] Profile read:", profErr.message);

      const currentXP =
        prof && prof.total_xp != null ? Number(prof.total_xp) : 0;
      const newXP = currentXP + xpEarned;

      // Step 2: upsert (INSERT … ON CONFLICT(id) DO UPDATE) — works even without UPDATE RLS policy
      const { data: upsertData, error: xpErr } = await supabaseClient
        .from("profiles")
        .upsert({ id: user.id, total_xp: newXP }, { onConflict: "id" })
        .select("total_xp")
        .single();

      if (xpErr) {
        console.error("[QuizCraft] XP upsert error:", xpErr.message, xpErr);
        showToast("XP save failed: " + xpErr.message, "#ef4444");
      } else {
        const confirmed = upsertData?.total_xp ?? newXP;
        console.log(
          "[QuizCraft] XP confirmed in DB — was:",
          currentXP,
          "now:",
          confirmed,
        );
        showToast(
          "+" + xpEarned + " XP earned! Total: " + confirmed + " XP",
          "#22c55e",
        );
      }

      // Achievement check after XP save
      const { count: totalQuizzes } = await supabaseClient
        .from("quizzes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const achieveMessages = [];
      if (totalQuizzes >= 1) achieveMessages.push("🎯 First Step unlocked!");
      if (totalQuizzes >= 10) achieveMessages.push("🏆 Quiz Master unlocked!");
      if (totalQuizzes >= 20) achieveMessages.push("🎓 Scholar unlocked!");
      if (percent >= 90) achieveMessages.push("⭐ Star Performer unlocked!");

      if (xpEarned > 0 || achieveMessages.length > 0) {
        const msg = ["+" + xpEarned + " XP saved!"]
          .concat(achieveMessages)
          .join(" ");
        showToast(msg, "#22c55e");
      }
    }
  } catch (e) {
    console.warn("XP update failed:", e);
    showToast("XP save failed — check connection", "#ef4444");
  }

  // ── Show Result Page ─────────────────────────────────────────────────────────
  document.querySelector(".quiz-layout").style.display = "none";
  document.getElementById("resultPage").style.display = "flex";

  // Category badge
  const catBadge = document.getElementById("categoryBadge");
  if (catBadge && quizCategory && quizCategory !== "uncategorized") {
    const isUni = quizCategory === "University";
    catBadge.textContent = isUni ? "🎓 University" : "👤 Personal";
    catBadge.className =
      "category-badge " + (isUni ? "badge-university" : "badge-personal");
    catBadge.style.display = "inline-block";
  }

  // Score text
  document.getElementById("scoreText").innerText = `${score} / ${total}`;
  document.getElementById("scorePercent").innerText = `${percent}%`;

  // SVG ring
  const ring = document.getElementById("ringFill");
  if (ring) {
    const circumference = 2 * Math.PI * 50;
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset =
      circumference - (percent / 100) * circumference;
    // Color based on score
    const ringColor =
      percent >= 80 ? "#22c55e" : percent >= 50 ? "#eab308" : "#ef4444";
    ring.style.stroke = ringColor;
    document.getElementById("scorePercent").style.color = ringColor;
  }

  // Score message
  const msgEl = document.getElementById("scoreMessage");
  if (msgEl) {
    if (percent === 100) msgEl.textContent = "🏆 Perfect Score!";
    else if (percent >= 80) msgEl.textContent = "🔥 Great Performance!";
    else if (percent >= 50) msgEl.textContent = "📈 Keep Practicing!";
    else msgEl.textContent = "💪 Don't Give Up!";
  }

  // Stat cards
  document.getElementById("correctCount").innerText = `${score} / ${total}`;
  const wrongEl = document.getElementById("wrongCount");
  if (wrongEl) wrongEl.innerText = `${total - score} / ${total}`;
  document.getElementById("timeTaken").innerText = timeTakenStr;
  document.getElementById("xpEarned").innerText = `+${xpEarned} XP`;

  // Focus area
  const focusDiv = document.getElementById("focusArea");
  if (weakTopics.length === 0) {
    focusDiv.innerHTML = `
      <div class="focus-box perfect">
        <span class="focus-icon">🎉</span>
        <p>You answered everything correctly. Outstanding!</p>
      </div>`;
  } else {
    const topicsHTML = weakTopics
      .slice(0, 6)
      .map((q, i) => {
        const short = q.length > 90 ? q.slice(0, 87) + "…" : q;
        return `<li>${short}</li>`;
      })
      .join("");
    focusDiv.innerHTML = `
      <div class="focus-box weak">
        <div class="focus-header">
          <span class="focus-icon">📌</span>
          <strong>Focus on these topics</strong>
        </div>
        <ul class="focus-list">${topicsHTML}</ul>
      </div>`;
  }
}

// ===================== TOAST =====================
function showToast(msg, bg) {
  bg = bg || "#22c55e";
  var t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = [
    "position:fixed",
    "bottom:28px",
    "left:50%",
    "transform:translateX(-50%)",
    "background:" + bg,
    "color:#fff",
    "padding:12px 24px",
    "border-radius:30px",
    "font-size:14px",
    "font-weight:600",
    "box-shadow:0 8px 24px rgba(0,0,0,0.18)",
    "z-index:99999",
    "opacity:0",
    "transition:opacity 0.35s ease",
    "white-space:nowrap",
  ].join(";");
  document.body.appendChild(t);
  requestAnimationFrame(function () {
    t.style.opacity = "1";
  });
  setTimeout(function () {
    t.style.opacity = "0";
    setTimeout(function () {
      t.remove();
    }, 400);
  }, 3200);
}
