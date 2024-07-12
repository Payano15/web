document.addEventListener('DOMContentLoaded', (event) => {
    // Variables for the forgot password modal
    const forgotPasswordModal = document.getElementById("forgot-password-modal");
    const forgotPasswordBtn = document.getElementById("forgot-password");
    const forgotPasswordClose = forgotPasswordModal.getElementsByClassName("close")[0];

    // Variables for the register modal
    const registerModal = document.getElementById("register-modal");
    const registerBtn = document.getElementById("register-link");
    const registerClose = registerModal.getElementsByClassName("close")[0];

    // When the user clicks the forgot password link, open the modal
    forgotPasswordBtn.onclick = function(event) {
        event.preventDefault();
        forgotPasswordModal.style.display = "block";
    }

    // When the user clicks the register link, open the modal
    registerBtn.onclick = function(event) {
        event.preventDefault();
        registerModal.style.display = "block";
    }

    // When the user clicks on <span> (x), close the forgot password modal
    forgotPasswordClose.onclick = function() {
        forgotPasswordModal.style.display = "none";
    }

    // When the user clicks on <span> (x), close the register modal
    registerClose.onclick = function() {
        registerModal.style.display = "none";
    }

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function(event) {
        if (event.target == forgotPasswordModal) {
            forgotPasswordModal.style.display = "none";
        }
        if (event.target == registerModal) {
            registerModal.style.display = "none";
        }
    }
});