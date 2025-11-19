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

// 파티클 효과 생성
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        // 랜덤 시작 위치
        const startX = Math.random() * 100;
        const startY = Math.random() * 100;

        // 랜덤 이동 거리
        const moveX = (Math.random() - 0.5) * 200;
        const moveY = (Math.random() - 0.5) * 200;

        // CSS 변수로 이동 설정
        particle.style.setProperty('--tx', `${moveX}px`);
        particle.style.setProperty('--ty', `${moveY}px`);
        particle.style.left = `${startX}%`;
        particle.style.top = `${startY}%`;
        particle.style.animationDelay = `${Math.random() * 10}s`;
        particle.style.animationDuration = `${15 + Math.random() * 10}s`;

        particlesContainer.appendChild(particle);
    }
}

// 스플래시 스크린 타이밍 제어
function initSplashSequence() {
    const splashScreen = document.getElementById('splash-screen');
    const loginCard = document.getElementById('login-card');

    // 3.5초 후 로딩 인디케이터가 사라지고 로그인 카드 등장
    setTimeout(() => {
        if (splashScreen) {
            splashScreen.classList.add('fade-out');
        }

        setTimeout(() => {
            if (splashScreen) {
                splashScreen.classList.add('hidden');
            }
            if (loginCard) {
                loginCard.classList.add('visible');
            }
        }, 800);
    }, 3800);
}

// 로그인 처리
function handleLoginSubmit(event) {
    event.preventDefault();

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const loginButton = event.target.querySelector('.btn-login');

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        // 입력 필드에 애니메이션 효과 추가
        [emailInput, passwordInput].forEach(input => {
            if (!input.value.trim()) {
                input.style.animation = 'shake 0.5s ease';
                setTimeout(() => {
                    input.style.animation = '';
                }, 500);
            }
        });
        return;
    }

    // 로그인 버튼 로딩 상태
    if (loginButton) {
        loginButton.textContent = '로그인 중...';
        loginButton.disabled = true;
    }

    // 약간의 지연을 주어 더 자연스럽게
    setTimeout(() => {
        const user = {
            email,
            name: email.split('@')[0]
        };

        StorageManager.saveCurrentUser(user);

        // 로그인 성공 - 환영 메시지 표시
        showWelcomeMessage();
    }, 800);
}

// 환영 메시지 표시 후 메인 페이지로 이동
function showWelcomeMessage() {
    const loginCard = document.getElementById('login-card');
    const welcomeMessage = document.getElementById('welcome-message');

    // 로그인 카드 숨김
    if (loginCard) {
        loginCard.classList.add('fade-out');
        setTimeout(() => {
            loginCard.classList.add('hidden');
        }, 800);
    }

    // 환영 메시지 표시
    setTimeout(() => {
        if (welcomeMessage) {
            welcomeMessage.classList.add('visible');
        }

        // 3.5초 후 메인 페이지로 이동
        setTimeout(() => {
            // 페이지 전환 효과
            document.body.style.transition = 'opacity 0.6s ease';
            document.body.style.opacity = '0';

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 600);
        }, 3500);
    }, 1000);
}

// 입력 필드 포커스 효과
function setupInputEffects() {
    const inputs = document.querySelectorAll('.form-group input');

    inputs.forEach(input => {
        // 포커스 시 라벨 애니메이션
        input.addEventListener('focus', () => {
            const label = input.parentElement.querySelector('label');
            if (label) {
                label.style.transform = 'scale(1.05)';
                label.style.transition = 'transform 0.3s ease';
            }
        });

        input.addEventListener('blur', () => {
            const label = input.parentElement.querySelector('label');
            if (label) {
                label.style.transform = 'scale(1)';
            }
        });
    });
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    // 파티클 생성
    createParticles();

    // 입력 필드 효과 설정
    setupInputEffects();

    // 이미 로그인한 사용자는 환영 메시지 표시 후 바로 이동
    const existingUser = StorageManager.loadCurrentUser();
    if (existingUser) {
        const splashScreen = document.getElementById('splash-screen');

        // 스플래시만 표시하고 로그인 카드는 건너뜀
        setTimeout(() => {
            if (splashScreen) {
                splashScreen.classList.add('fade-out');
            }
            setTimeout(() => {
                if (splashScreen) {
                    splashScreen.classList.add('hidden');
                }
                showWelcomeMessage();
            }, 800);
        }, 3500);
    } else {
        // 새 사용자는 스플래시 → 로그인 순서
        initSplashSequence();
    }

    // 로그인 폼 이벤트 리스너
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
});

// shake 애니메이션 추가 (동적 스타일)
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
            20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
    `;
    document.head.appendChild(style);
}
