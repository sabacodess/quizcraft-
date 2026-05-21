// ===================== STREAK HELPER =====================
async function updateStreak(userId) {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const { data: prof } = await supabaseClient
      .from("profiles")
      .select("last_login, current_streak")
      .eq("id", userId)
      .single();

    const lastLogin = prof?.last_login;
    let newStreak = prof?.current_streak || 0;

    if (lastLogin) {
      const last = new Date(lastLogin);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate - last) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return; // already logged in today
      if (diffDays === 1)
        newStreak += 1; // consecutive day
      else newStreak = 1; // streak broken — reset to 1
    } else {
      newStreak = 1; // very first login
    }

    await supabaseClient
      .from("profiles")
      .update({ last_login: today, current_streak: newStreak })
      .eq("id", userId);
  } catch (e) {
    console.warn("Streak update failed:", e);
  }
}

// ===================== LEVELING SYSTEM =====================
function getLevel(xp) {
  if (xp < 100)
    return { rank: "Novice", icon: "🌱", color: "#6B7280", nextXP: 100 };
  if (xp < 300)
    return { rank: "Learner", icon: "📖", color: "#3B82F6", nextXP: 300 };
  if (xp < 600)
    return { rank: "Pro", icon: "⚡", color: "#D97706", nextXP: 600 };
  if (xp < 1000)
    return { rank: "Expert", icon: "🏆", color: "#7C3AED", nextXP: 1000 };
  return { rank: "Master", icon: "🎓", color: "#DC2626", nextXP: null };
}

// Supabase init
const supabaseClient = window.supabase.createClient(
  "https://bvpfmvgjtfjfvquxduku.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cGZtdmdqdGZqZnZxdXhkdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc5OTIsImV4cCI6MjA4ODEwMzk5Mn0.F7PpoHyqAaI2N05uPDjdZvOsdeBW6TzaQfb30lz2i6U",
);

// pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

// ===================== AUTH CHECK =====================
document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "../pages/login.html";
    return;
  }

  currentDashboardUserId = session.user.id; // cache for user-scoped mutations
  // Update streak on every session load (fire-and-forget)
  updateStreak(session.user.id).catch(() => {});
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");

  if (tab === "summary") {
    showPage("quizSummaryPage");
    setActive(document.getElementById("navQuizSummary"));
    switchTab("summary");
  } else if (tab === "quiz") {
    showPage("quizSummaryPage");
    setActive(document.getElementById("navQuizSummary"));
    switchTab("quiz");
  } else {
    loadDashboard();
  }
});

// ===================== SIDEBAR ACTIVE =====================
const navLinks = document.querySelectorAll(".sidebar a");
function setActive(clickedLink) {
  navLinks.forEach((link) => link.classList.remove("active"));
  clickedLink.classList.add("active");
}

// ===================== LOGOUT =====================
document.getElementById("logoutBtn").onclick = async (e) => {
  e.preventDefault();
  await supabaseClient.auth.signOut();
  window.location.href = "../pages/login.html";
};

// ===================== PAGE SWITCH =====================
const pages = document.querySelectorAll(".page");
function showPage(pageId) {
  pages.forEach((page) => (page.style.display = "none"));
  document.getElementById(pageId).style.display = "block";
}

// ===================== NAV CLICKS =====================
document.getElementById("navDashboard").addEventListener("click", (e) => {
  e.preventDefault();
  showPage("dashboardPage");
  setActive(document.getElementById("navDashboard"));
  showFolders(false);
  loadDashboard();
});

document.getElementById("navPDF").addEventListener("click", (e) => {
  e.preventDefault();
  showPage("mypdfsPage");
  setActive(document.getElementById("navPDF"));
  showFolders(true);
  loadPDFs();
});

document.getElementById("navQuizSummary").addEventListener("click", (e) => {
  e.preventDefault();
  showPage("quizSummaryPage");
  setActive(document.getElementById("navQuizSummary"));
  showFolders(false);
  selectedQSCategory = "all";
  document.querySelectorAll(".qs-cat").forEach((c) => {
    c.classList.toggle("active", c.dataset.qscat === "all");
  });
  switchTab("quiz");
  loadQuizzes();
});

document.getElementById("navProfile").addEventListener("click", (e) => {
  e.preventDefault();
  showPage("ProfilePage");
  setActive(document.getElementById("navProfile"));
  showFolders(false);
  loadProfile();
});

// Auto-refresh Profile when user switches back to this tab (e.g. after finishing a quiz)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    const profPage = document.getElementById("ProfilePage");
    if (profPage && profPage.style.display !== "none") {
      loadProfile();
    }
  }
});

// Also refresh when page is restored from browser back-cache
window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    const profPage = document.getElementById("ProfilePage");
    if (profPage && profPage.style.display !== "none") {
      loadProfile();
    }
  }
});

// ===================== FOLDER VISIBILITY =====================
function showFolders(visible) {
  const section = document.getElementById("foldersSection");
  if (!section) return;
  if (visible) {
    section.classList.add("visible");
  } else {
    section.classList.remove("visible");
    selectedFolder = "all"; // reset when leaving My PDFs
  }
}

// Folder click handlers
document.querySelectorAll(".folder-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const folder = item.dataset.folder;
    loadPDFs(folder);
  });
});

// Q&S Category chip handlers
document.querySelectorAll(".qs-cat").forEach((chip) => {
  chip.addEventListener("click", () => {
    selectedQSCategory = chip.dataset.qscat;
    document
      .querySelectorAll(".qs-cat")
      .forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    // reload whichever tab is active
    const quizTabVisible =
      document.getElementById("quizTab").style.display !== "none";
    if (quizTabVisible) {
      loadQuizzes();
    } else {
      loadSummaries();
    }
  });
});

// ===================== TAB SWITCH =====================
function switchTab(tab) {
  const quizTab = document.getElementById("quizTab");
  const summaryTab = document.getElementById("summaryTab");
  const tabQuizBtn = document.getElementById("tabQuiz");
  const tabSummaryBtn = document.getElementById("tabSummary");

  if (tab === "quiz") {
    quizTab.style.display = "block";
    summaryTab.style.display = "none";
    tabQuizBtn.classList.add("active");
    tabSummaryBtn.classList.remove("active");
    loadQuizzes();
  } else {
    quizTab.style.display = "none";
    summaryTab.style.display = "block";
    tabSummaryBtn.classList.add("active");
    tabQuizBtn.classList.remove("active");
    loadSummaries();
  }
}

// ===================== DASHBOARD =====================
// ===================== RESUME UNFINISHED QUIZ =====================
async function checkUnfinishedQuiz(userId) {
  const resumeCard = document.getElementById("resumeCard");
  if (!resumeCard) return;
  if (!userId) {
    resumeCard.style.display = "none";
    return;
  }

  // Clean up any lingering localStorage quiz_progress keys
  for (let j = localStorage.length - 1; j >= 0; j--) {
    const k = localStorage.key(j);
    if (k && k.startsWith("quiz_progress_")) localStorage.removeItem(k);
  }

  const { data: rows, error } = await supabaseClient
    .from("quiz_progress")
    .select(
      "quiz_id, quiz_title, current_question_index, total_questions, updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    console.warn("[QuizCraft Resume] Supabase error:", error.message);
    resumeCard.style.display = "none";
    return;
  }

  if (!rows || rows.length === 0) {
    resumeCard.style.display = "none";
    return;
  }

  const latest = rows[0];
  const qNum = (latest.current_question_index || 0) + 1;

  const titleEl = document.getElementById("resumeQuizTitle");
  const qNumEl = document.getElementById("resumeQNum");
  const btn = document.getElementById("resumeBtn");
  const discard = document.getElementById("resumeDiscardBtn");

  if (titleEl) titleEl.innerText = latest.quiz_title || "Unnamed Quiz";
  if (qNumEl)
    qNumEl.innerText =
      "Question " + qNum + " of " + (latest.total_questions || "?");
  if (btn) btn.href = "quiz.html?quizId=" + latest.quiz_id;
  if (discard) {
    discard.onclick = async () => {
      await supabaseClient
        .from("quiz_progress")
        .delete()
        .eq("user_id", userId)
        .eq("quiz_id", latest.quiz_id);
      resumeCard.style.display = "none";
    };
  }

  resumeCard.style.display = "flex";
}

async function loadDashboard() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  // username + greeting
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("username, created_at")
    .eq("id", user.id)
    .single();

  if (profile) {
    const hour = new Date().getHours();
    const greeting =
      hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
    document.getElementById("greetingText").innerText =
      `${greeting}, ${profile.username} `;
  }

  // total PDFs
  const { count: pdfCount } = await supabaseClient
    .from("pdfs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // total quizzes
  const { count: quizCount } = await supabaseClient
    .from("quizzes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // total summaries
  const { count: summaryCount } = await supabaseClient
    .from("summaries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  document.getElementById("totalPDFs").innerText = pdfCount || 0;
  document.getElementById("totalQuizzes").innerText = quizCount || 0;
  document.getElementById("totalSummaries").innerText = summaryCount || 0;

  // recent activity table — last 5 attempted quizzes
  const { data: recentQuizzes } = await supabaseClient
    .from("quizzes")
    .select("*")
    .eq("user_id", user.id)
    .not("score", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  renderActivityTable(recentQuizzes || []);
  await checkUnfinishedQuiz(user.id);
}

function renderActivityTable(quizzes) {
  const tbody = document.querySelector(".recent-quizzes tbody");
  if (!tbody) return;

  if (quizzes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; color:#94a3b8; padding:2rem 0;">
          No activity yet — attempt a quiz to see results here!
        </td>
      </tr>
    `;
    return;
  }

  // Mobile check
  if (window.innerWidth <= 768) {
    // Cards banao table ki jagah
    const container = document.querySelector(".recent-quizzes");
    container.innerHTML = `<h2 style="font-size:1.1rem; margin-bottom:1rem;">Your Learning Activity</h2>`;

    quizzes.forEach((q) => {
      const accuracy = q.total_questions
        ? Math.round((q.score / q.total_questions) * 100)
        : 0;
      const accuracyColor =
        accuracy >= 70 ? "#16a34a" : accuracy >= 50 ? "#ca8a04" : "#dc2626";
      const date = new Date(q.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });

      const card = document.createElement("div");
      card.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 14px 16px;
        margin-bottom: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      card.innerHTML = `
        <div>
          <p style="font-weight:600; color:#0f172a; font-size:14px;">${q.title}</p>
          <p style="font-size:12px; color:#94a3b8; margin-top:2px;">${q.total_questions} questions • ${date}</p>
        </div>
        <div style="text-align:right;">
          <p style="font-weight:600; color:#0f172a; font-size:14px;">${q.score}/${q.total_questions}</p>
          <p style="font-size:12px; font-weight:600; color:${accuracyColor};">${accuracy}%</p>
        </div>
      `;
      container.appendChild(card);
    });
    return;
  }

  // Desktop — table same rahega
  tbody.innerHTML = quizzes
    .map((q) => {
      const accuracy = q.total_questions
        ? Math.round((q.score / q.total_questions) * 100)
        : 0;
      const accuracyClass =
        accuracy >= 70 ? "high" : accuracy >= 50 ? "medium" : "low";
      const date = new Date(q.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
      return `
      <tr>
        <td>${q.title}</td>
        <td>${q.total_questions}</td>
        <td>${q.score}/${q.total_questions}</td>
        <td><span class="accuracy ${accuracyClass}">${accuracy}%</span></td>
        <td>${date}</td>
      </tr>
    `;
    })
    .join("");
}
function goToQuizFromDashboard() {
  window.location.href = "../pages/upload.html";
}

function goToSummaryFromDashboard() {
  window.location.href = "../pages/upload.html";
}
// ===================== PDFs =====================
let allPDFs = [];
let currentDashboardUserId = null; // set at DOMContentLoaded — scopes all mutations
let selectedFolder = "all"; // tracks current folder filter

// ===================== Q&S CATEGORY =====================
let selectedQSCategory = "all";
let pdfCategoryMap = {}; // pdf_id → category

async function fetchPDFCategoryMap() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const { data } = await supabaseClient
    .from("pdfs")
    .select("id, category")
    .eq("user_id", user.id);
  pdfCategoryMap = {};
  (data || []).forEach((p) => {
    pdfCategoryMap[p.id] = p.category || "uncategorized";
  });
}

async function loadPDFs(folder) {
  if (folder !== undefined) selectedFolder = folder;

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  let query = supabaseClient
    .from("pdfs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (selectedFolder && selectedFolder !== "all") {
    query = query.eq("category", selectedFolder);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return;
  }

  allPDFs = data || [];

  // Update count badge
  const badge = document.getElementById("pdfCountBadge");
  if (badge) badge.textContent = allPDFs.length + " PDFs";

  // Update folder active states
  document.querySelectorAll(".folder-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.folder === selectedFolder);
    // swap icon open/closed
    const icon = item.querySelector("i");
    if (icon) {
      icon.className =
        item.dataset.folder === selectedFolder
          ? "fa-solid fa-folder-open"
          : "fa-solid fa-folder";
    }
  });

  if (allPDFs.length === 0) {
    const msg =
      selectedFolder === "all"
        ? "No PDFs uploaded yet — upload one to get started!"
        : `No PDFs found in this category`;
    document.getElementById("pdfList").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-folder-open"></i></div>
        <h3>${msg}</h3>
        <p>${selectedFolder !== "all" ? "Move a PDF here from the menu on any PDF card." : "Click <strong>+ Upload PDF</strong> to begin."}</p>
      </div>
    `;
    return;
  }

  renderPDFs(allPDFs);
}

function renderPDFs(list) {
  const pdfList = document.getElementById("pdfList");
  pdfList.innerHTML = "";

  if (list.length === 0) {
    const msg =
      selectedFolder === "all"
        ? "No PDFs match your search."
        : `No PDFs found in this category`;
    pdfList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
        <h3>${msg}</h3>
        <p>Try a different search or folder.</p>
      </div>
    `;
    return;
  }

  list.forEach((pdf) => {
    const { data: urlData } = supabaseClient.storage
      .from("pdfs")
      .getPublicUrl(pdf.file_url);

    const generated = JSON.parse(localStorage.getItem("generated") || "{}");
    const pdfGenerated = generated[pdf.id] || {};

    const div = document.createElement("div");
    div.innerHTML = `
      <div class="pdf-card-new">
        <div class="pdf-left">
          <div class="pdf-icon">
            <i class="fa-solid fa-file-pdf"></i>
          </div>
          <div class="pdf-info">
            <h4>
              <span id="title-${pdf.id}">${pdf.file_name}</span>
              <button class="icon-btn" onclick="editPDF('${pdf.id}')">
                <i data-lucide="pencil"></i>
              </button>
            </h4>
            <p>${new Date(pdf.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
            <div class="pdf-status" style="margin-top:4px;">
              ${pdfGenerated.quiz ? '<span class="status completed">Quiz</span>' : ""}
              ${pdfGenerated.summary ? '<span class="status completed">Summary</span>' : ""}
            </div>
          </div>
        </div>
        <div class="pdf-actions-new">
          <button onclick="window.open('${urlData.publicUrl}', '_blank')" class="action-btn open-btn">
            <i data-lucide="eye"></i><span>Open</span>
          </button>
          <button onclick="deletePDF('${pdf.id}')" class="action-btn delete-btn">
            <i data-lucide="trash-2"></i><span>Delete</span>
          </button>
          <div class="pdf-menu-wrap">
            <button class="pdf-menu-btn" onclick="toggleMoveMenu('${pdf.id}')" title="More options">⋮</button>
            <div class="pdf-move-dropdown" id="moveMenu-${pdf.id}">
              <div class="dropdown-label">Move to folder</div>
              <div class="dropdown-divider"></div>
              <button onclick="movePDF('${pdf.id}', 'University')"><i class="fa-solid fa-folder"></i> University</button>
              <button onclick="movePDF('${pdf.id}', 'Personal')"><i class="fa-solid fa-folder"></i> Personal</button>
              <div class="dropdown-divider"></div>
              <button onclick="movePDF('${pdf.id}', 'uncategorized')" style="color:#9CA3AF;"><i class="fa-solid fa-folder-open" style="color:#D1D5DB;"></i> Remove from folder</button>
            </div>
          </div>
        </div>
      </div>
    `;
    pdfList.appendChild(div);
  });
  lucide.createIcons();
}

// Toggle move-to dropdown
window.toggleMoveMenu = function (id) {
  // Close all other open menus first
  document.querySelectorAll(".pdf-move-dropdown.open").forEach((el) => {
    if (el.id !== `moveMenu-${id}`) el.classList.remove("open");
  });
  const menu = document.getElementById(`moveMenu-${id}`);
  if (menu) menu.classList.toggle("open");
};

// Close menus on outside click
document.addEventListener("click", (e) => {
  if (!e.target.closest(".pdf-menu-wrap")) {
    document.querySelectorAll(".pdf-move-dropdown.open").forEach((el) => {
      el.classList.remove("open");
    });
  }
});

// Move PDF to a category
window.movePDF = async function (id, category) {
  const { error } = await supabaseClient
    .from("pdfs")
    .update({ category })
    .eq("id", id)
    .eq("user_id", currentDashboardUserId);

  // Close the menu
  const menu = document.getElementById(`moveMenu-${id}`);
  if (menu) menu.classList.remove("open");

  if (error) {
    console.error("Move failed:", error);
    return;
  }

  // Reload the current folder view
  loadPDFs();
};

window.deletePDF = async function (id) {
  const { error } = await supabaseClient
    .from("pdfs")
    .delete()
    .eq("id", id)
    .eq("user_id", currentDashboardUserId);
  if (error) {
    alert("Delete failed");
    return;
  }
  loadPDFs();
};

// PDF search
document.getElementById("searchInput").addEventListener("input", (e) => {
  const value = e.target.value.toLowerCase();
  const filtered = allPDFs.filter((pdf) =>
    (pdf.file_name || "").toLowerCase().includes(value),
  );
  renderPDFs(filtered);
});

// Add pdf count badge to header dynamically
document.getElementById("navPDF").addEventListener("click", () => {
  const header = document.querySelector("#mypdfsPage h2");
  if (header && !document.getElementById("pdfCountBadge")) {
    const badge = document.createElement("span");
    badge.id = "pdfCountBadge";
    badge.className = "pdf-count-badge";
    badge.style.marginLeft = "10px";
    badge.textContent = "0 PDFs";
    header.appendChild(badge);
  }
});

// ===================== QUIZZES =====================
let allQuizzes = [];

async function loadQuizzes() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  let query = supabaseClient
    .from("quizzes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (selectedQSCategory !== "all") {
    query = query.ilike("category", selectedQSCategory);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return;
  }

  allQuizzes = data || [];
  renderQuizzes(allQuizzes);
  updateQuizStats(allQuizzes);
}

function renderQuizzes(quizzes) {
  const quizList = document.getElementById("quizList");
  quizList.innerHTML = "";

  if (quizzes.length === 0) {
    const label =
      selectedQSCategory !== "all"
        ? selectedQSCategory.charAt(0).toUpperCase() +
          selectedQSCategory.slice(1)
        : "any";
    quizList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-brain"></i></div>
        <h3>No ${label} quizzes yet</h3>
        <p>Upload a ${label} PDF and generate a quiz to see it here.</p>
      </div>
    `;
    return;
  }

  quizzes.forEach((quiz) => {
    const isAttempted = quiz.score !== null;
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="quiz-card">
        <div class="quiz-top">
          <h3>
            <span class="quiz-title-icon"><i class="fa-solid fa-brain"></i></span>
            <span id="title-${quiz.id}">${quiz.title}</span>
            <button class="icon-btn" onclick="editQuiz('${quiz.id}')" style="margin-left:4px;">
              <i data-lucide="pencil"></i>
            </button>
          </h3>
          <span class="status ${isAttempted ? "completed" : "pending"}">
            ${isAttempted ? "Completed" : "Not Attempted"}
          </span>
        </div>
        <div class="quiz-meta">
          <span>${quiz.total_questions} questions</span>
          <span>${isAttempted ? `${quiz.score}/${quiz.total_questions}` : "Not attempted"}</span>
          <span>${new Date(quiz.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        </div>
        <div class="quiz-actions">
        ${
          isAttempted
            ? `
            <button class="view-btn" onclick="viewQuiz('${quiz.id}')">
            <i data-lucide="eye"></i>
            <span>View</span>
            </button>`
            : ""
        }
          <button class="start-btn" onclick="goToQuiz('${quiz.id}')">
            <i data-lucide="play"></i>
            <span>${isAttempted ? "Retry" : "Start"}</span>
          </button>
          <button class="delete-btn" onclick="deleteQuiz('${quiz.id}')">
            <i data-lucide="trash-2"></i>
            <span>Delete</span>
          </button>
        </div>
      </div>
    `;
    quizList.appendChild(div);
    lucide.createIcons();
  });
}
function viewQuiz(id) {
  window.location.href = `../pages/quiz-review.html?id=${id}`;
}

function updateQuizStats(quizzes) {
  const attempted = quizzes.filter((q) => q.score !== null).length;
  const unattempted = quizzes.filter((q) => q.score === null).length;
  const totalCorrect = quizzes.reduce((sum, q) => sum + (q.score || 0), 0);
  const totalQs = quizzes.reduce((sum, q) => sum + (q.total_questions || 0), 0);
  const accuracy = totalQs ? Math.round((totalCorrect / totalQs) * 100) : 0;

  document.getElementById("attempted").innerText = attempted;
  document.getElementById("correct").innerText = totalCorrect;
  document.getElementById("unattempted").innerText = unattempted;
  document.getElementById("accuracy").innerText = accuracy + "%";
  document.getElementById("progressFill").style.width = accuracy + "%";
}

window.deleteQuiz = async function (id) {
  const { error } = await supabaseClient
    .from("quizzes")
    .delete()
    .eq("id", id)
    .eq("user_id", currentDashboardUserId);
  if (error) {
    alert("Delete failed");
    return;
  }
  loadQuizzes();
};

function goToQuiz(id) {
  window.location.href = `../pages/quiz.html?quizId=${id}`;
}

// Quiz filter
document.getElementById("quizSearch").addEventListener("input", filterQuizzes);
document.getElementById("quizFilter").addEventListener("change", filterQuizzes);

function filterQuizzes() {
  const value = document.getElementById("quizSearch").value.toLowerCase();
  const filter = document.getElementById("quizFilter").value;

  let filtered = allQuizzes.filter((q) =>
    q.title.toLowerCase().includes(value),
  );

  if (filter === "completed")
    filtered = filtered.filter((q) => q.score !== null);
  else if (filter === "pending")
    filtered = filtered.filter((q) => q.score === null);

  // Category filter — case-insensitive
  if (selectedQSCategory !== "all") {
    const targetCat = selectedQSCategory.toLowerCase();
    filtered = filtered.filter(
      (q) => (q.category || "uncategorized").toLowerCase() === targetCat,
    );
  }

  renderQuizzes(filtered);
}
// ===== EDIT TITLE (ALL TYPES) =====

function editTitleUI(id, saveFn) {
  const span = document.getElementById(`title-${id}`);
  if (!span) return;

  const oldText = span.innerText;

  span.innerHTML = `<input id="input-${id}" value="${oldText}" />`;

  const input = document.getElementById(`input-${id}`);
  input.focus();

  input.onblur = () => saveFn(id);
  input.onkeydown = (e) => {
    if (e.key === "Enter") saveFn(id);
  };
}

// PDF
function editPDF(id) {
  editTitleUI(id, savePDFTitle);
}

async function savePDFTitle(id) {
  const value = document.getElementById(`input-${id}`).value;

  await supabaseClient
    .from("pdfs")
    .update({ file_name: value })
    .eq("id", id)
    .eq("user_id", currentDashboardUserId);

  document.getElementById(`title-${id}`).innerText = value;
}

// QUIZ
function editQuiz(id) {
  editTitleUI(id, saveQuizTitle);
}

async function saveQuizTitle(id) {
  const value = document.getElementById(`input-${id}`).value;

  await supabaseClient
    .from("quizzes")
    .update({ title: value })
    .eq("id", id)
    .eq("user_id", currentDashboardUserId);

  document.getElementById(`title-${id}`).innerText = value;
}

// SUMMARY
function editSummary(id) {
  editTitleUI(id, saveSummaryTitle);
}

async function saveSummaryTitle(id) {
  const value = document.getElementById(`input-${id}`).value;

  await supabaseClient
    .from("summaries")
    .update({ title: value })
    .eq("id", id)
    .eq("user_id", currentDashboardUserId);

  document.getElementById(`title-${id}`).innerText = value;
}
// ===================== SUMMARIES =====================
let allSummaries = [];

async function loadSummaries() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  let query = supabaseClient
    .from("summaries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (selectedQSCategory !== "all") {
    query = query.ilike("category", selectedQSCategory);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return;
  }

  allSummaries = data || [];
  renderSummaries(allSummaries);
}

function renderSummaries(list) {
  const container = document.getElementById("summaryList");
  container.innerHTML = "";

  if (list.length === 0) {
    const label =
      selectedQSCategory !== "all"
        ? selectedQSCategory.charAt(0).toUpperCase() +
          selectedQSCategory.slice(1)
        : "any";
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-file-lines"></i></div>
        <h3>No ${label} summaries yet</h3>
        <p>Upload a ${label} PDF and generate a summary to see it here.</p>
      </div>
    `;
    return;
  }

  list.forEach((item) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="summary-card">
        <h4>
        <span id="title-${item.id}">${item.title}</span>
        <button class="icon-btn" onclick="editSummary('${item.id}')">
        <i data-lucide="pencil"></i>
        </button>
        <p>${(item.content || "").slice(0, 100)}...</p>
        <div class="summary-actions">
          <button class="view-btn" onclick="viewSummary('${item.id}')">
            <i data-lucide="eye"></i><span>View</span>
          </button>
          <button class="delete-btn" onclick="deleteSummary('${item.id}')">
            <i data-lucide="trash-2"></i><span>Delete</span>
          </button>
        </div>
      </div>
    `;
    container.appendChild(div);
    lucide.createIcons();
  });
}
window.deleteSummary = async function (id) {
  const { error } = await supabaseClient
    .from("summaries")
    .delete()
    .eq("id", id)
    .eq("user_id", currentDashboardUserId);
  if (error) {
    alert("Delete failed");
    return;
  }
  loadSummaries();
};

function viewSummary(id) {
  window.location.href = `../pages/summary.html?summaryId=${id}`;
}

// Summary search
document.getElementById("summarySearch").addEventListener("input", (e) => {
  const value = e.target.value.toLowerCase();
  const filtered = allSummaries.filter((s) =>
    (s.title || "").toLowerCase().includes(value),
  );
  renderSummaries(filtered);
});

// ===================== PROFILE =====================
async function loadProfile() {
  // ── Loading state ─────────────────────────────────────────────────────
  const profileEl = document.getElementById("ProfilePage");
  let spinEl = document.getElementById("profileSpinner");
  if (!spinEl) {
    spinEl = document.createElement("div");
    spinEl.id = "profileSpinner";
    spinEl.innerHTML = '<div class="prof-spinner"></div>';
    profileEl.prepend(spinEl);
  }
  spinEl.style.display = "flex";

  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    // ── 1. Profile row (username, joined, streak reference) ───────────────
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("username, created_at, current_streak, last_login")
      .eq("id", user.id)
      .single();

    if (profile) {
      document.getElementById("profileName").innerText = profile.username;
      document.getElementById("profileAvatar").innerText = profile.username
        .charAt(0)
        .toUpperCase();
      const joined = new Date(profile.created_at).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });
      document.getElementById("profileJoined").innerText = "Joined " + joined;
    }

    // ── 2. Fetch all quizzes ──────────────────────────────────────────────
    console.log("[QuizCraft Profile] user.id =", user.id);
    const { data: rawQuizzes, error: quizFetchErr } = await supabaseClient
      .from("quizzes")
      .select("id, score, total_questions, created_at, title, category")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (quizFetchErr)
      console.error("[QuizCraft] Quiz fetch error:", quizFetchErr.message);

    let allUserQuizzes = rawQuizzes || [];
    if (allUserQuizzes.length === 0) {
      const { data: rlsQuizzes } = await supabaseClient
        .from("quizzes")
        .select("id, score, total_questions, created_at, title, category")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (rlsQuizzes && rlsQuizzes.length > 0) allUserQuizzes = rlsQuizzes;
    }

    const attempted = allUserQuizzes.filter(
      (q) => q.score !== null && q.total_questions,
    );
    console.log(
      "[QuizCraft Profile] All quizzes:",
      allUserQuizzes.length,
      "| Scored:",
      attempted.length,
    );

    // ── 3. Derive XP from quiz scores (profiles.total_xp blocked by RLS) ──
    let totalXP = 0;
    attempted.forEach((q) => {
      const pct = Math.round((q.score / q.total_questions) * 100);
      let xp = q.score * 10;
      if (pct === 100) xp += 50;
      else if (pct >= 80) xp += 20;
      totalXP += xp;
    });

    const level = getLevel(totalXP);
    document.getElementById("totalXP").innerText =
      totalXP.toLocaleString() + " XP";
    console.log("[QuizCraft Profile] Computed XP:", totalXP);

    const rankEl = document.getElementById("profileRank");
    if (rankEl)
      rankEl.innerHTML =
        '<span style="color:' +
        level.color +
        ';">' +
        level.icon +
        " " +
        level.rank +
        "</span>";

    const xpBarEl = document.getElementById("xpProgressBar");
    const xpLabelEl = document.getElementById("xpProgressLabel");
    if (xpBarEl) {
      if (level.nextXP) {
        const thresholds = [0, 100, 300, 600, 1000];
        const prevT = thresholds.filter((t) => t <= totalXP).pop() || 0;
        const pct = Math.min(
          ((totalXP - prevT) / (level.nextXP - prevT)) * 100,
          100,
        );
        xpBarEl.style.width = pct + "%";
        if (xpLabelEl)
          xpLabelEl.innerText =
            totalXP +
            " / " +
            level.nextXP +
            " XP to " +
            getLevel(level.nextXP).rank;
      } else {
        xpBarEl.style.width = "100%";
        if (xpLabelEl) xpLabelEl.innerText = "Maximum rank reached! 🎓";
      }
    }

    // ── 4. Stats overview ─────────────────────────────────────────────────
    const questionsSolved = attempted.reduce(
      (sum, q) => sum + (q.total_questions || 0),
      0,
    );
    const totalCorrect = attempted.reduce((sum, q) => sum + (q.score || 0), 0);
    const accuracyPct =
      questionsSolved > 0
        ? Math.round((totalCorrect / questionsSolved) * 100)
        : null;

    document.getElementById("questionsSolved").innerText =
      questionsSolved.toLocaleString();
    document.getElementById("quizzesDone").innerText = attempted.length;

    const accEl = document.getElementById("accuracyStat");
    if (accEl) {
      accEl.innerText = accuracyPct !== null ? accuracyPct + "%" : "—";
      if (accuracyPct !== null) {
        accEl.style.color =
          accuracyPct >= 80
            ? "#16a34a"
            : accuracyPct >= 50
              ? "#d97706"
              : "#dc2626";
      }
    }

    // ── 5. Streak — derived from consecutive quiz days ────────────────────
    const quizDaySet = new Set(
      attempted.map((q) => new Date(q.created_at).toDateString()),
    );
    let streak = 0;
    const checkDay = new Date();
    // if no quiz today yet, start counting from yesterday
    if (!quizDaySet.has(checkDay.toDateString()))
      checkDay.setDate(checkDay.getDate() - 1);
    while (quizDaySet.has(checkDay.toDateString())) {
      streak++;
      checkDay.setDate(checkDay.getDate() - 1);
    }
    document.getElementById("streakCount").innerText = streak;

    // Light up last-7-days dots
    const today = new Date();
    const last7Active = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      last7Active.push(quizDaySet.has(d.toDateString()));
    }
    document.querySelectorAll(".streak-day").forEach((el, i) => {
      el.classList.toggle("active", last7Active[i] || false);
    });

    // ── 6. Today's Goal — dedicated Supabase query with toISOString() ───────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();
    console.log(
      "[QuizCraft Goal] querying created_at >=",
      todayISO,
      "| local day start:",
      todayStart.toLocaleString(),
    );

    let { count: completedToday, error: goalErr } = await supabaseClient
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("score", "is", null)
      .gte("created_at", todayISO);

    // RLS fallback — if user_id filter blocked, let RLS scope automatically
    if (goalErr || completedToday === null) {
      console.warn(
        "[QuizCraft Goal] user_id filter failed, trying RLS-only:",
        goalErr?.message,
      );
      const { count: fbCount } = await supabaseClient
        .from("quizzes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("score", "is", null)
        .gte("created_at", todayISO);
      completedToday = fbCount || 0;
    }

    const todayDone = completedToday || 0;
    const goalTarget = 2;
    const goalPct = Math.min((todayDone / goalTarget) * 100, 100);
    console.log(
      "[QuizCraft Goal] completedToday:",
      todayDone,
      "| pct:",
      goalPct + "%",
    );

    const goalFillEl = document.getElementById("goalFill");
    if (goalFillEl) {
      goalFillEl.style.width = goalPct + "%";
      goalFillEl.style.background =
        todayDone >= goalTarget
          ? "linear-gradient(90deg,#16a34a,#22c55e)"
          : "linear-gradient(90deg,#f59e0b,#eab308)";
    }
    document.getElementById("goalText").innerText =
      todayDone + " / " + goalTarget;
    const goalDoneMsg = document.getElementById("goalDoneMsg");
    if (goalDoneMsg)
      goalDoneMsg.style.display = todayDone >= goalTarget ? "flex" : "none";

    // ── 7. Best performance highlight ─────────────────────────────────────
    const highlightBox = document.getElementById("highlightBox");
    if (attempted.length > 0 && highlightBox) {
      const best = attempted.reduce((prev, curr) =>
        curr.score / curr.total_questions > prev.score / prev.total_questions
          ? curr
          : prev,
      );
      const bestPct = Math.round((best.score / best.total_questions) * 100);
      highlightBox.innerHTML =
        "🏆 Best performance: <strong>" +
        best.score +
        "/" +
        best.total_questions +
        " (" +
        bestPct +
        "%)</strong> in <em>" +
        best.title +
        "</em>";
      highlightBox.style.display = "block";
    } else if (highlightBox) {
      highlightBox.style.display = "none";
    }

    // ── 8. Subject Mastery — use q.category directly ─────────────────────
    const categoryStats = {};
    attempted.forEach((q) => {
      const cat =
        q.category && q.category !== "uncategorized" ? q.category : null;
      if (!cat) return;
      if (!categoryStats[cat]) categoryStats[cat] = { correct: 0, total: 0 };
      categoryStats[cat].correct += q.score || 0;
      categoryStats[cat].total += q.total_questions || 0;
    });

    const masteryEl = document.getElementById("masteryBars");
    const catEntries = Object.entries(categoryStats);
    if (catEntries.length === 0) {
      masteryEl.innerHTML =
        '<p class="mastery-no-data">No categorised quizzes yet.</p>';
    } else {
      const catIcons = { University: "fa-graduation-cap", Personal: "fa-user" };
      masteryEl.innerHTML = catEntries
        .map(([cat, stats]) => {
          const acc = stats.total
            ? Math.round((stats.correct / stats.total) * 100)
            : 0;
          const icon = catIcons[cat] || "fa-folder";
          const color =
            acc >= 80 ? "#16a34a" : acc >= 50 ? "#d97706" : "#dc2626";
          return (
            '<div class="mastery-row">' +
            '<span class="mastery-label"><i class="fa-solid ' +
            icon +
            '"></i> ' +
            cat +
            "</span>" +
            '<div class="mastery-bar-track"><div class="mastery-bar-fill" style="width:' +
            acc +
            "%;background:" +
            color +
            '"></div></div>' +
            '<span class="mastery-pct" style="color:' +
            color +
            '">' +
            acc +
            "%</span>" +
            "</div>"
          );
        })
        .join("");
    }

    // ── 9. Badges ─────────────────────────────────────────────────────────
    await loadBadges(user.id, allUserQuizzes);
  } finally {
    // Always hide spinner, even if an error occurred mid-load
    spinEl.style.display = "none";
  }
}
// ===================== BADGES =====================
async function loadBadges(userId, allQuizzes) {
  // allQuizzes = ALL quizzes for the user (scored + unscored)
  const attempted = allQuizzes.filter((q) => q.score !== null);
  const attemptCount = allQuizzes.length;

  // Re-confirm quiz count directly from DB (exact row count)
  const { count: quizCount } = await supabaseClient
    .from("quizzes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: pdfCount } = await supabaseClient
    .from("pdfs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: summaryCount } = await supabaseClient
    .from("summaries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const totalQuizzes = quizCount || attemptCount;

  console.log(
    "[QuizCraft Badges] Quiz Count:",
    totalQuizzes,
    "| PDF Count:",
    pdfCount,
    "| Summary Count:",
    summaryCount,
  );

  // Star Performer: any scored quiz with ≥ 90% accuracy
  const starPerformer = attempted.some(
    (q) => q.total_questions > 0 && q.score / q.total_questions >= 0.9,
  );

  const badgeRules = {
    "badge-first-quiz": totalQuizzes >= 1,
    "badge-star": starPerformer,
    "badge-bookworm": (pdfCount || 0) >= 5,
    "badge-quiz-master": totalQuizzes >= 10,
    "badge-summary-king": (summaryCount || 0) >= 5,
    "badge-scholar": totalQuizzes >= 20,
  };

  console.log("[QuizCraft Badges] Rules:", badgeRules);

  Object.entries(badgeRules).forEach(([id, unlocked]) => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn("[QuizCraft Badges] Element not found:", id);
      return;
    }

    const wasUnlocked = el.classList.contains("unlocked");

    el.classList.toggle("unlocked", unlocked);
    el.classList.toggle("locked", !unlocked);

    // Show/hide lock icon
    const lockEl = el.querySelector(".badge-lock");
    if (lockEl) lockEl.style.display = unlocked ? "none" : "flex";

    // Trigger pop animation only when freshly unlocked
    if (unlocked && !wasUnlocked) {
      el.classList.remove("unlocked");
      void el.offsetWidth;
      el.classList.add("unlocked");
    }

    console.log(
      `[QuizCraft Badges] ${id}: ${unlocked ? "UNLOCKED" : "locked"}`,
    );
  });
}
document.getElementById("close-btn").onclick = () => {
  document.querySelector("aside").classList.remove("open");
};
document.querySelectorAll(".sidebar a").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelector("aside").classList.remove("open");
  });
});
