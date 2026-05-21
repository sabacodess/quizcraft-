const supabaseClient = window.supabase.createClient(
  "https://bvpfmvgjtfjfvquxduku.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cGZtdmdqdGZqZnZxdXhkdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc5OTIsImV4cCI6MjA4ODEwMzk5Mn0.F7PpoHyqAaI2N05uPDjdZvOsdeBW6TzaQfb30lz2i6U",
);
document.getElementById("resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const password = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmPassword").value;

  if (password !== confirm) {
    alert("Passwords do not match!");
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({
    password: password,
  });

  if (error) {
    alert("Error: " + error.message);
  } else {
    alert("Password updated successfully!");
    window.location.href = "login.html";
  }
});
const toggles = document.querySelectorAll(".togglePassword");

toggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const input = toggle.previousElementSibling;

    if (input.type === "password") {
      input.type = "text";
      toggle.classList.remove("fa-eye-slash");
      toggle.classList.add("fa-eye");
    } else {
      input.type = "password";
      toggle.classList.remove("fa-eye");
      toggle.classList.add("fa-eye-slash");
    }
  });
});
