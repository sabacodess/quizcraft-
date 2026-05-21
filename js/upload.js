//  Supabase init
const supabaseClient = window.supabase.createClient(
  "https://bvpfmvgjtfjfvquxduku.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cGZtdmdqdGZqZnZxdXhkdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc5OTIsImV4cCI6MjA4ODEwMzk5Mn0.F7PpoHyqAaI2N05uPDjdZvOsdeBW6TzaQfb30lz2i6U",
);
//pdf lib
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

// Upload logic
const uploadBox = document.getElementById("uploadBox");
const fileInput = document.getElementById("pdfInput");
const addFileBtn = document.getElementById("addFileBtn");

let selectedFile = null;

// button click
addFileBtn.onclick = () => {
  fileInput.click();
};

// select file
fileInput.onchange = () => {
  selectedFile = fileInput.files[0];

  if (selectedFile) {
    uploadBox.innerHTML = `<p>${selectedFile.name}</p>`;
  }
};

// drag
uploadBox.ondragover = (e) => {
  e.preventDefault();
};

uploadBox.ondrop = (e) => {
  e.preventDefault();
  selectedFile = e.dataTransfer.files[0];

  if (selectedFile) {
    uploadBox.innerHTML = `<p>${selectedFile.name}</p>`;
  }
};
// quiz uplod btn

const quizBtn = document.getElementById("quizBtn");
const summaryBtn = document.getElementById("summaryBtn");
function goToQuiz(pdfId) {
  window.location.href = `../pages/quiz.html?id=${pdfId}`;
}

function goToSummary(pdfId) {
  window.location.href = `../pages/summary.html?id=${pdfId}`;
}

quizBtn.onclick = async () => {
  if (!selectedFile) {
    alert("Please choose a PDF first!");
    return;
  }
  if (!selectedFile.name.endsWith(".pdf")) {
    alert("Only PDF allowed!");
    return;
  }

  const text = await extractText(selectedFile);

  if (!text || text.trim().length === 0) {
    alert("Text extract failed!");
    return;
  }

  localStorage.setItem("pdfText", text);
  localStorage.setItem("selectedPDFName", selectedFile.name);

  const category = document.getElementById("categorySelect").value;
  const success = await uploadFile(selectedFile, text, category);

  if (success) {
    goToQuiz(success);
  }
};

summaryBtn.onclick = async () => {
  if (!selectedFile) {
    alert("Please choose a PDF first!");
    return;
  }
  if (!selectedFile.name.endsWith(".pdf")) {
    alert("Only PDF allowed!");
    return;
  }

  console.log("FILE:", selectedFile);

  //  1. extract text
  const text = await extractText(selectedFile);
  console.log("EXTRACTED TEXT:", text);

  //  2. validate text
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    alert("Text extract failed!");
    return;
  }

  //  3. save text
  localStorage.setItem("pdfText", text);
  console.log("SAVED:", localStorage.getItem("pdfText"));
  localStorage.setItem("selectedPDFName", selectedFile.name);

  //  4. upload file (optional)
  const category = document.getElementById("categorySelect").value;
  const success = await uploadFile(selectedFile, text, category);

  //  5. redirect
  if (success) {
    goToSummary(success);
  }
};
async function uploadFile(file, text, category = "uncategorized") {
  try {
    // UI loading
    uploadBox.innerHTML = `<p>Uploading ${file.name}...</p>`;

    // 1. Upload to storage
    const { data, error } = await supabaseClient.storage
      .from("pdfs")
      .upload(`public/${Date.now()}_${file.name}`, file);

    if (error) throw error;

    // 2. Get user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    // 3. Save in DB
    const { data: dbData, error: dbError } = await supabaseClient
      .from("pdfs")
      .insert([
        {
          user_id: user.id,
          file_name: file.name,
          file_url: data.path,
          pdf_content: text,
          category: category || "uncategorized",
        },
      ])
      .select();

    if (dbError) throw dbError;

    // success UI
    uploadBox.innerHTML = `<p style="color:lightgreen;">Uploaded ${file.name} ✅</p>`;
    return dbData[0].id;
  } catch (err) {
    console.error(err);
    uploadBox.innerHTML = `<p style="color:red;">Upload failed ❌</p>`;
    return false;
  }
}
// pdf extraction
async function extractText(file) {
  const reader = new FileReader();

  console.log("inside extra");

  return new Promise((resolve) => {
    reader.onload = async function () {
      const typedarray = new Uint8Array(this.result);

      const pdf = await pdfjsLib.getDocument(typedarray).promise;

      let text = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        const content = await page.getTextContent();

        const strings = content.items.map((item) => item.str);

        text += strings.join(" ");
      }

      resolve(text);
    };

    reader.readAsArrayBuffer(file);
  });
}
// localStorage.setItem("selectedPDFName", pdf.file_name);
