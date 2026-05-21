const supabaseClient = window.supabase.createClient(
  "https://bvpfmvgjtfjfvquxduku.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cGZtdmdqdGZqZnZxdXhkdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc5OTIsImV4cCI6MjA4ODEwMzk5Mn0.F7PpoHyqAaI2N05uPDjdZvOsdeBW6TzaQfb30lz2i6U",
);

// ===================== NAVIGATION =====================
function goToDashboard() {
  const params = new URLSearchParams(window.location.search);
  const summaryId = params.get("summaryId");
  if (summaryId) {
    window.location.href = "../pages/dashboard.html?tab=summary";
  } else {
    window.location.href = "../pages/dashboard.html";
  }
}

window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  const summaryId = params.get("summaryId");
  if (summaryId) {
    window.location.href = "../pages/dashboard.html?tab=summary";
  }
});

history.pushState({ page: "summary" }, "", window.location.href);

// ===================== UI HELPERS =====================
function showSpinner() {
  document.getElementById("loadingBox").classList.add("visible");
}
function hideSpinner() {
  document.getElementById("loadingBox").classList.remove("visible");
}
function showResult() {
  const el = document.getElementById("summaryResult");
  if (el) el.classList.remove("hidden");
}
function hideResult() {
  document.getElementById("summaryResult").classList.add("hidden");
}
function showSetup() {
  const page = document.querySelector(".summary-setup-page");
  if (page) page.style.display = "";
  const card = document.querySelector(".summary-setup");
  if (card) card.classList.remove("hidden");
}
function hideSetup() {
  const page = document.querySelector(".summary-setup-page");
  if (page) page.style.display = "none";
  const card = document.querySelector(".summary-setup");
  if (card) card.classList.add("hidden");
}

// ===================== PAGE LOAD =====================
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const summaryId = params.get("summaryId"); // dashboard se existing summary
  const pdfId = params.get("id"); // upload se naya summary

  if (summaryId) {
    // ✅ Dashboard se aaya → existing summary load karo
    hideSetup();
    hideResult();
    showSpinner();
    await loadSummary(summaryId);
  } else if (pdfId) {
    // ✅ Upload se aaya → PDF DB se lo, setup dikhao
    hideSpinner();
    hideResult();
    showSetup();

    document.getElementById("generateSummary").onclick = async () => {
      // ✅ DB se text lo — localStorage nahi
      const { data: pdfData, error: pdfError } = await supabaseClient
        .from("pdfs")
        .select("pdf_content, file_name, category")
        .eq("id", pdfId)
        .single();

      if (pdfError || !pdfData) {
        alert("PDF nahi mila!");
        return;
      }

      const fullText = pdfData.pdf_content;
      const pdfTitle = pdfData.file_name || "Untitled";
      const category = pdfData.category || "uncategorized";

      if (!fullText || fullText.trim().length === 0) {
        alert("PDF mein text nahi mila!");
        return;
      }

      const summaryType = document.getElementById("summaryType").value;
      const prompts = {
        Short:
          "Summarize this into key bullet points (around 5–10). Adjust based on content size. No extra text. No questions.",
        Detailed: `Give a detailed structured summary.
Divide into sections: Key Concepts, Important Details, Conclusion.
Use bullet points inside each section.
Do NOT ask questions. Do NOT add extra commentary.`,
        "Bullet Points":
          "Summarize into clear bullet points. Number of points should depend on content length. No introduction. No questions.",
      };

      const prompt = prompts[summaryType] || prompts["Short"];

      hideSetup();
      hideResult();
      showSpinner();
      window.scrollTo({ top: 0, behavior: "smooth" });

      try {
        // ✅ AI se summary generate karo
        const summary = await generateSummary(fullText, prompt);

        const cleanSummary = summary
          .split("Would you like")[0]
          .replace(/^Here.*?:/i, "");

        hideSpinner();
        showResult();

        // Set filename in topbar
        const filenameEl = document.getElementById("summaryFilenameDisplay");
        if (filenameEl) filenameEl.textContent = pdfTitle.replace(".pdf", "");

        // Set summary type badge
        const typeBadge = document.getElementById("summaryTypeLabel");
        if (typeBadge) typeBadge.textContent = summaryType;

        const formatted = cleanSummary
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/^\* /gm, "• ")
          .replace(/\n/g, "<br>");

        document.getElementById("summaryText").innerHTML = formatted;

        // Extract key takeaways from bullet points
        populateTakeaways(cleanSummary);

        // ✅ Summary DB mein save karo
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        console.log(
          "[QuizCraft] Saving summary with category:",
          category,
          "| PDF:",
          pdfTitle,
        );
        const { error: sumInsertErr } = await supabaseClient
          .from("summaries")
          .insert({
            user_id: user.id,
            category: category || "uncategorized",
            title: `${pdfTitle.replace(".pdf", "")} (${summaryType})`,
            content: cleanSummary,
          });
        if (sumInsertErr)
          console.error(
            "[QuizCraft] Summary insert error:",
            sumInsertErr.message,
          );

        // ✅ localStorage mein sirf badge ke liye mark karo
        const generated = JSON.parse(localStorage.getItem("generated") || "{}");
        generated[pdfId] = { ...generated[pdfId], summary: true };
        localStorage.setItem("generated", JSON.stringify(generated));
      } catch (err) {
        hideSpinner();
        showSetup();
        console.error(err);
        alert("Error: " + err.message);
      }
    };
  } else {
    // ✅ Na pdfId na summaryId — upload pe bhejo
    alert("Koi PDF select nahi ki!");
    window.location.href = "../pages/upload.html";
  }

  // ===================== COPY BUTTON =====================
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) {
    copyBtn.onclick = async () => {
      const text = document.getElementById("summaryText").innerText;
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.innerText = "Copied!";
      } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        copyBtn.innerText = "Copied!";
      }
      setTimeout(() => {
        copyBtn.innerText = "Copy Summary";
      }, 2000);
    };
  }

  // ===================== DOWNLOAD BUTTON =====================
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const text = document.getElementById("summaryText").innerText;
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "summary.txt";
      a.click();
      URL.revokeObjectURL(url);
    };
  }
});

// ===================== GENERATE SUMMARY (AI Call) =====================
async function generateSummary(text, prompt) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  const res = await fetch(
    "https://bvpfmvgjtfjfvquxduku.supabase.co/functions/v1/summarize",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ text, prompt }),
    },
  );

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.summary;
}

// ===================== LOAD EXISTING SUMMARY =====================
async function loadSummary(id) {
  const { data, error } = await supabaseClient
    .from("summaries")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error(error);
    alert("Summary nahi mili!");
    hideSpinner();
    showSetup();
    return;
  }

  hideSpinner();
  hideSetup();
  showResult();

  // Set filename in topbar
  const filenameEl = document.getElementById("summaryFilenameDisplay");
  if (filenameEl) filenameEl.textContent = data.title || "Summary";

  // Set summary type badge from title
  const typeBadge = document.getElementById("summaryTypeLabel");
  if (typeBadge) {
    const match = (data.title || "").match(/\((.+?)\)$/);
    if (match) typeBadge.textContent = match[1];
  }

  const formatted = (data.content || "")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^\* /gm, "• ")
    .replace(/\n/g, "<br>");

  document.getElementById("summaryText").innerHTML = formatted;

  // Extract key takeaways
  populateTakeaways(data.content || "");
}

// ===================== EXTRACT TAKEAWAYS =====================
function populateTakeaways(rawText) {
  const list = document.getElementById("keyTakeaways");
  if (!list) return;

  const lines = rawText
    .split("\n")
    .map(function (l) {
      return l.trim();
    })
    .filter(Boolean);
  const bullets = lines
    .filter(function (l) {
      return (
        l.startsWith("\u2022") ||
        l.startsWith("*") ||
        l.startsWith("-") ||
        /^\d+\./.test(l)
      );
    })
    .map(function (l) {
      return l
        .replace(/^[\u2022\*\-]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .trim();
    })
    .filter(function (l) {
      return l.length > 10;
    })
    .slice(0, 8);

  const items =
    bullets.length >= 2
      ? bullets
      : lines
          .join(" ")
          .split(/[.!?]/)
          .map(function (s) {
            return s.trim();
          })
          .filter(function (s) {
            return s.length > 20;
          })
          .slice(0, 6);

  if (items.length === 0) {
    list.innerHTML =
      '<li class="takeaway-placeholder">No key points found in this summary.</li>';
    return;
  }

  list.innerHTML = items
    .map(function (text, i) {
      return (
        '<li><span class="takeaway-bullet">' +
        (i + 1) +
        "</span><span>" +
        text +
        "</span></li>"
      );
    })
    .join("");
}
