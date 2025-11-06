'use strict';

class StorageManager {
    static save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    static load(key) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }

    static saveCurrentUser(user) {
        this.save('promptcraft_user', user);
    }

    static loadCurrentUser() {
        return this.load('promptcraft_user');
    }
}

function handleLoginSubmit(event) {
    event.preventDefault();

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert('이메일과 비밀번호를 모두 입력해주세요.');
        return;
    }

    const user = {
        email,
        name: email.split('@')[0]
    };

    StorageManager.saveCurrentUser(user);
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    const existingUser = StorageManager.loadCurrentUser();
    if (existingUser) {
        window.location.href = 'index.html';
        return;
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
});
