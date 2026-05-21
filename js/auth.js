// const { createClient } = supabase;
// const supabaseClient = createClient(
//   "https://bvpfmvgjtfjfvquxduku.supabase.co",
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cGZtdmdqdGZqZnZxdXhkdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc5OTIsImV4cCI6MjA4ODEwMzk5Mn0.F7PpoHyqAaI2N05uPDjdZvOsdeBW6TzaQfb30lz2i6U",
// );

const supabaseClient = window.supabase.createClient(
  "https://bvpfmvgjtfjfvquxduku.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cGZtdmdqdGZqZnZxdXhkdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc5OTIsImV4cCI6MjA4ODEwMzk5Mn0.F7PpoHyqAaI2N05uPDjdZvOsdeBW6TzaQfb30lz2i6U",
);
document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session) {
    window.location.href = "../pages/dashboard.html";
  }
});
// for animate toggle
const container = document.getElementById("container");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");

registerBtn.addEventListener("click", () => {
  container.classList.add("active");
});

loginBtn.addEventListener("click", () => {
  container.classList.remove("active");
});

// for passwoed hide and seen
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
// mobile loginin and signup
const mobileRegister = document.getElementById("mobileRegister");
const mobileLogin = document.getElementById("mobileLogin");

if (mobileRegister) {
  mobileRegister.addEventListener("click", () => {
    container.classList.add("active");
  });
}

if (mobileLogin) {
  mobileLogin.addEventListener("click", () => {
    container.classList.remove("active");
  });
}
// for linking file
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.hash === "#signup") {
    container.classList.add("active");
  }
});
// for empty input
function showError(input, message) {
  const group = input.parentElement;
  const errorText = group.querySelector(".error-message");

  if (errorText) {
    errorText.textContent = message;
  }

  input.classList.add("input-error");
}

function clearError(input) {
  const group = input.parentElement;
  const errorText = group.querySelector(".error-message");

  if (errorText) {
    errorText.textContent = "";
  }

  input.classList.remove("input-error");
}
const loginSubmit = document.getElementById("signinbtn");
if (loginSubmit) {
  loginSubmit.addEventListener("click", async () => {
    const email = document.getElementById("signinEmail");
    const password = document.getElementById("signinPassword");

    let valid = true;

    if (email.value.trim() === "") {
      showError(email, "email is required");
      valid = false;
    } else {
      clearError(email);
    }

    if (password.value.trim() === "") {
      showError(password, "Password is required");
      valid = false;
    } else {
      clearError(password);
    }

    if (valid) {
      const form = loginSubmit.closest("form");
      const success = form.querySelector(".success-message");
      console.log(document.querySelector(".success-message"));

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email.value.trim(),
          password: password.value.trim(),
        });

        if (error) {
          success.textContent = error.message;
          success.style.color = "red";
        } else {
          success.textContent = "Login successful!";
          success.style.color = "green";

          // redirect after login
          setTimeout(() => {
            window.location.href = "../pages/dashboard.html";
          }, 1200);
        }
      } catch (err) {
        console.log(err);
        success.textContent = "Something went wrong!";
        success.style.color = "red";
      }
    }
  });
}

const signupSubmit = document.getElementById("signupbtn");
if (signupSubmit) {
  signupSubmit.addEventListener("click", async () => {
    const username = document.getElementById("signupUsername");
    const email = document.getElementById("signupEmail");
    const password = document.getElementById("signupPassword");

    let valid = true;

    // Username check
    if (username.value.trim() === "") {
      showError(username, "Username is required");
      valid = false;
    } else {
      clearError(username);
    }

    // Password check
    if (password.value.trim() === "") {
      showError(password, "Password is required");
      valid = false;
    } else if (password.value.trim().length < 6) {
      showError(password, "Minimum 6 characters required");
      valid = false;
    } else {
      clearError(password);
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (email.value.trim() === "") {
      showError(email, "Email is required");
      valid = false;
    } else if (!emailPattern.test(email.value.trim())) {
      showError(email, "Enter a valid email");
      valid = false;
    } else {
      clearError(email);
    }

    if (valid) {
      const form = signupSubmit.closest("form");
      const success = form.querySelector(".success-message");
      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email: email.value.trim(),
          password: password.value.trim(),
        });
        console.log("signup response", data);

        if (error) {
          success.textContent = error.message;
          success.style.color = "red";
        } else {
          const { error: profileError } = await supabaseClient
            .from("profiles")
            .insert([
              {
                id: data.user.id,
                username: username.value.trim(),
              },
            ]);

          if (profileError) {
            console.log(profileError);
            success.textContent = "Profile creation failed";
            success.style.color = "red";
            return;
          }
        }
        success.textContent = "Account created successfully!";
        success.style.color = "green";
        setTimeout(() => {
          window.location.href = "../pages/dashboard.html";
        }, 1200);
      } catch (err) {
        success.textContent = "Something went wrong!";
        success.style.color = "red";
      }
    }
  });
}
const forgetpassword = document.querySelector(".forget");
const form = forgetpassword.closest("form");
const success = form.querySelector(".success-message");

async function resetPassword(email) {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: "http://192.168.1.43:5500/pages/reset-password.html",
  });

  if (error) {
    success.textContent = error.message;
    success.style.color = "red";
  } else {
    success.textContent = "Reset link sent to your email!";
    success.style.color = "green";
  }
}
forgetpassword.addEventListener("click", (e) => {
  e.preventDefault();

  const email = document.getElementById("signinEmail").value;
  const form = forgetpassword.closest("form");
  const success = form.querySelector(".success-message");

  if (!email) {
    success.textContent = "please enter your email first";
    success.style.color = "red";
    return;
  }

  resetPassword(email);
});
