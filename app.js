// 전역 상태 관리
const APP_STATE = {
    currentUser: null,
    currentChatId: null,
   chats: {},
    apiKey: null,
    selectedPromptOption: null,
    conversationHistory: []
};

const SELECTION_ASSIST = {
    tooltip: null,
    popup: null,
    popupBody: null,
    lastPosition: null,
    lastText: '',
    abortController: null,
    requestId: 0
};

// OpenAI Function Definitions
const FUNCTIONS = [
    {
        name: 'suggest_prompt_options',
        description: '사용자의 요구사항을 분석하여 2개의 프롬프트 옵션을 제안합니다.',
        parameters: {
            type: 'object',
            properties: {
                options: {
                    type: 'array',
                    description: '제안할 프롬프트 옵션 배열 (정확히 2개)',
                    items: {
                        type: 'object',
                        properties: {
                            title: {
                                type: 'string',
                                description: '프롬프트 옵션의 제목'
                            },
                            prompt: {
                                type: 'string',
                                description: '실제 프롬프트 내용'
                            }
                        },
                        required: ['title', 'prompt']
                    },
                    minItems: 2,
                    maxItems: 2
                }
            },
            required: ['options']
        }
    },
    {
        name: 'update_prompt',
        description: '선택된 프롬프트를 사용자의 피드백에 따라 업데이트합니다.',
        parameters: {
            type: 'object',
            properties: {
                updated_prompt: {
                    type: 'string',
                    description: '업데이트된 프롬프트 내용'
                }
            },
            required: ['updated_prompt']
        }
    },
    {
        name: 'finalize_prompt',
        description: '프롬프트를 최종 확정하고 대상 AI 서비스로 전송할 준비를 합니다.',
        parameters: {
            type: 'object',
            properties: {
                final_prompt: {
                    type: 'string',
                    description: '최종 확정된 프롬프트'
                },
                summary: {
                    type: 'string',
                    description: '프롬프트에 대한 간단한 설명'
                }
            },
            required: ['final_prompt', 'summary']
        }
    },
    {
        name: 'request_survey',
        description: '추가 정보가 필요할 때 사용자에게 설문을 요청합니다. 선택형 또는 입력형 설문을 지원합니다.',
        parameters: {
            type: 'object',
            properties: {
                survey_id: {
                    type: 'string',
                    description: '설문을 구분하기 위한 고유 ID'
                },
                title: {
                    type: 'string',
                    description: '설문 섹션 제목'
                },
                prompt: {
                    type: 'string',
                    description: '사용자에게 표시할 질문 문구'
                },
                survey_type: {
                    type: 'string',
                    enum: ['multiple_choice', 'input'],
                    description: '설문 형태 (옵션 선택 혹은 직접 입력)'
                },
                options: {
                    type: 'array',
                    description: '선택형 설문에서 제공할 옵션 목록',
                    items: {
                        type: 'string'
                    },
                    minItems: 1
                },
                allow_multiple: {
                    type: 'boolean',
                    description: '선택형 설문에서 다중 선택 허용 여부',
                    default: false
                },
                required: {
                    type: 'boolean',
                    description: '응답이 필수인지 여부',
                    default: true
                },
                placeholder: {
                    type: 'string',
                    description: '입력형 설문에서 보여줄 placeholder 텍스트'
                },
                submit_label: {
                    type: 'string',
                    description: '응답 제출 버튼 커스텀 문구'
                }
            },
            required: ['survey_id', 'prompt', 'survey_type']
        }
    }
];

// 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 고급 AI 프롬프트 엔지니어입니다. 
사용자와 대화하면서 그들이 원하는 목적에 맞는 **AI용 프롬프트 문장**을 함께 설계하고 완성합니다.  
당신은 프롬프트를 직접 실행하지 않으며, 오직 생성만 합니다.

작업 단계는 다음과 같습니다:

1️⃣ **요구사항 수집 단계**
   - 사용자가 원하는 프롬프트의 목적, 대상 AI, 사용 시나리오 등을 간단히 설명하면
   - 먼저 request_survey 함수를 여러 번 호출하여 설문을 통해 구체적인 요구사항을 심층적으로 파악합니다.
   - 설문은 가능한 한 많고 세분화된 형태로 제시하며, 사용자의 목표·스타일·형식·역할·출력 형태 등을 꼼꼼히 수집합니다.
   - 설문은 선택형(multiple_choice)과 입력형(input)을 다양하게 섞어 사용합니다.
   - 각 설문은 명확한 ID(survey_id), 제목(title), 질문(prompt)을 가져야 하며, 한 번의 대화에서 여러 설문을 연속적으로 제시할 수 있습니다.

2️⃣ **초안 생성 단계**
   - 충분한 정보가 수집된 후, suggest_prompt_options 함수를 호출하여 
     AI에게 직접 전달할 수 있는 **2개의 프롬프트 후보(option)**를 제시합니다.
   - 각 프롬프트는 title과 prompt를 모두 포함해야 하며, 
     실제 AI에 바로 입력해도 작동 가능한 영어 문장이어야 합니다.
    - 수집한 정보를 최대한 반영하며, 명확하고 구체적이며 실행 가능한 형태로 작성합니다. 프롬프트는 매우 자세히 설명하고 단계적으로 작성합니다.

3️⃣ **피드백 및 수정 단계**
   - 사용자가 선택한 프롬프트에 대해 의견을 주면, update_prompt 함수를 여러 번 사용해 개선합니다.
   - 사용자의 피드백을 반영해 문체, 명확성, 구체성, 구조, 단계성 등을 반복적으로 다듬습니다.
   - 사용자가 완전히 만족할 때까지 개선 과정을 반복합니다.

4️⃣ **최종 확정 단계**
   - 최종 프롬프트가 완성되면 finalize_prompt 함수를 호출하여
     final_prompt(최종 문장)과 summary(요약 설명)을 함께 제출합니다.
   - summary는 이 프롬프트가 어떤 목적과 톤으로 설계되었는지 간단히 설명합니다.

⚙️ **규칙**
- 항상 친근하고 전문적으로 대화합니다.
- 프롬프트는 명확하고 구체적이며 실행 가능한 영어 문장이어야 합니다.
- 프롬프트에는 ‘AI의 역할(Role)’과 ‘출력 지침(Instructions)’이 반드시 포함되어야 합니다.
- 설문 단계에서는 가능한 한 많은 정보를 얻기 위해 여러 차례 request_survey를 사용합니다.
- 함수 호출은 적절한 타이밍에만 하며, 명확한 논리 흐름을 유지합니다.

📘 **프롬프트 작성 필수 원칙**
1. **역할(Role)**: AI의 정체성과 직업/전문가 페르소나를 명확히 설정하세요. (예: “You are a film critic…”)
2. **출력 지침**: AI의 출력 형식, 톤, 길이, 단계 등을 구체적으로 지정하세요.
3. **맥락(Context)**: 작업 배경, 입력 데이터의 성격, 기대 결과 등을 요약해 제공합니다.
4. **예시(Example)**: 기대하는 출력의 예시를 포함하면 정확도가 높아집니다.
5. **사실 기반(Factual)**: 95% 이상 확신할 수 없는 정보는 피하고, 근거 없는 추측은 금지합니다.
6. **단계적 처리(Step-by-step)**: 복잡한 요청은 단계적으로 수행하도록 유도하세요.
7. **피드백 루프**: 사용자의 의견을 반영해 지속적으로 개선합니다.
8. **긍정적 표현**: “~하지 마” 대신 “~하도록 작성해줘”로 표현합니다.
9. **예의적 어휘 배제**: “please”, “thank you” 같은 공손어는 사용하지 않습니다.

🎯 **최종 목표**
- 사용자가 복잡한 아이디어를 명확하고 실행 가능한 프롬프트 문장으로 바꿀 수 있게 돕는 것.
- 당신은 오직 프롬프트를 “작성”하고, “개선”하고, “확정”합니다.
- 절대로 프롬프트의 내용을 “실행”하지 않습니다.`;

// 마크다운 렌더링 옵션 설정
if (window.marked) {
    window.marked.setOptions({
        gfm: true,
        breaks: true
    });
}

// 로컬스토리지 관리
class StorageManager {
    static save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    static load(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    static remove(key) {
        localStorage.removeItem(key);
    }

    static saveChats(chats) {
        this.save('promptcraft_chats', chats);
    }

    static loadChats() {
        return this.load('promptcraft_chats') || {};
    }

    static saveApiKey(apiKey) {
        this.save('promptcraft_apikey', apiKey);
    }

    static loadApiKey() {
        return this.load('promptcraft_apikey');
    }

    static saveCurrentUser(user) {
        this.save('promptcraft_user', user);
    }

    static loadCurrentUser() {
        return this.load('promptcraft_user');
    }

    static clearUser() {
        this.remove('promptcraft_user');
    }
}

// DOM 요소
const elements = {
    // 레이아웃
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    
    // 사이드바
    newChatBtn: document.getElementById('new-chat-btn'),
    chatHistory: document.getElementById('chat-history'),
    settingsBtn: document.getElementById('settings-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    toggleSidebarBtn: document.getElementById('toggle-sidebar'),
    
    // 채팅
    messagesContainer: document.getElementById('messages-container'),
    welcomeScreen: document.getElementById('welcome-screen'),
    chatForm: document.getElementById('chat-form'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    aiServiceSelect: document.getElementById('ai-service'),
    
    // 모달
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    openaiApiKeyInput: document.getElementById('openai-api-key'),
    saveSettingsBtn: document.getElementById('save-settings'),
    upgradeBtn: document.getElementById('upgrade-btn'),
    pricingModal: document.getElementById('pricing-modal'),
    closePricing: document.getElementById('close-pricing')
};

// 초기화
function init() {
    // 저장된 데이터 로드
    APP_STATE.currentUser = StorageManager.loadCurrentUser();
    if (!APP_STATE.currentUser) {
        window.location.href = 'login.html';
        return;
    }

    APP_STATE.chats = StorageManager.loadChats();
    APP_STATE.apiKey = StorageManager.loadApiKey();

    if (APP_STATE.apiKey && elements.openaiApiKeyInput) {
        elements.openaiApiKeyInput.value = APP_STATE.apiKey;
    }

    // 이벤트 리스너 등록
    registerEventListeners();
    initializeSelectionAssistant();

    // 요금제 토글 초기화
    setupPricingModal();

    handleWindowResize();

    // 채팅 기록 렌더링
    renderChatHistory();

    const chatIds = Object.keys(APP_STATE.chats);
    if (chatIds.length > 0) {
        loadChat(chatIds[chatIds.length - 1]);
    } else {
        createNewChat();
    }

    completeAppLoading();
}

// 이벤트 리스너 등록
function registerEventListeners() {
    // 사이드바
    if (elements.newChatBtn) {
        elements.newChatBtn.addEventListener('click', createNewChat);
    }
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => openModal(elements.settingsModal));
    }
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
    if (elements.toggleSidebarBtn) {
        elements.toggleSidebarBtn.addEventListener('click', toggleSidebar);
    }
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', closeSidebarOnMobile);
    }

    if (elements.upgradeBtn && elements.pricingModal) {
        elements.upgradeBtn.addEventListener('click', () => openModal(elements.pricingModal));
    }
    if (elements.closePricing && elements.pricingModal) {
        elements.closePricing.addEventListener('click', () => closeModal(elements.pricingModal));
    }

    // 채팅
    if (elements.chatForm) {
        elements.chatForm.addEventListener('submit', handleSendMessage);
    }
    if (elements.messageInput) {
        elements.messageInput.addEventListener('input', autoResizeTextarea);
        elements.messageInput.addEventListener('keydown', handleTextareaKeydown);
    }

    registerPromptStarters();

    // 설정 모달
    if (elements.closeSettings) {
        elements.closeSettings.addEventListener('click', () => closeModal(elements.settingsModal));
    }
    if (elements.saveSettingsBtn) {
        elements.saveSettingsBtn.addEventListener('click', saveSettings);
    }

    window.addEventListener('resize', handleWindowResize);
}

function registerPromptStarters() {
    if (!elements.messageInput) return;

    const starters = document.querySelectorAll('[data-prompt]');
    starters.forEach(btn => {
        if (btn.dataset.promptBound === 'true') return;
        btn.addEventListener('click', handlePromptStarterClick);
        btn.dataset.promptBound = 'true';
    });
}

function handlePromptStarterClick(event) {
    if (!elements.messageInput) return;
    
    const promptText = event.currentTarget.dataset.prompt || event.currentTarget.textContent;
    elements.messageInput.value = promptText.trim();
    elements.messageInput.focus();
    autoResizeTextarea({ target: elements.messageInput });
}

function initializeSelectionAssistant() {
    if (SELECTION_ASSIST.tooltip || !document.body) return;

    const tooltip = document.createElement('div');
    tooltip.id = 'selection-tooltip';
    tooltip.innerHTML = `<button type="button" class="selection-tooltip-btn">쉬운 설명</button>`;
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    const popup = document.createElement('div');
    popup.id = 'selection-popup';
    popup.innerHTML = `
        <div class="popup-header">
            <span class="popup-title">쉬운 설명</span>
            <button type="button" class="popup-close" aria-label="닫기">&times;</button>
        </div>
        <div class="popup-body"></div>
    `;
    popup.style.display = 'none';
    document.body.appendChild(popup);

    const explainButton = tooltip.querySelector('.selection-tooltip-btn');
    const closeButton = popup.querySelector('.popup-close');
    const popupBody = popup.querySelector('.popup-body');

    explainButton.addEventListener('mousedown', (event) => event.preventDefault());
    explainButton.addEventListener('click', handleExplainSelectionClick);
    closeButton.addEventListener('click', hideSelectionPopup);

    document.addEventListener('selectionchange', handleTextSelectionChange);
    window.addEventListener('scroll', () => hideSelectionTooltip(), { passive: true });
    window.addEventListener('resize', () => hideSelectionTooltip(), { passive: true });

    SELECTION_ASSIST.tooltip = tooltip;
    SELECTION_ASSIST.popup = popup;
    SELECTION_ASSIST.popupBody = popupBody;
}

function handleTextSelectionChange() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
        hideSelectionTooltip();
        return;
    }

    if (!isSelectionAllowed(selection)) {
        hideSelectionTooltip();
        return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) {
        hideSelectionTooltip();
        return;
    }

    if (text.length > 800) {
        hideSelectionTooltip();
        showSelectionPopup({
            content: '선택한 내용이 너무 길어요. 800자 이하로 선택해주세요.',
            isError: true
        });
        return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
        hideSelectionTooltip();
        return;
    }

    SELECTION_ASSIST.lastText = text;
    SELECTION_ASSIST.lastPosition = rectToPagePosition(rect);

    showSelectionTooltip(rect);
    hideSelectionPopup();
    cancelInlineExplanation();
}

function isSelectionAllowed(selection) {
    const anchorNode = selection.anchorNode;
    if (!anchorNode) return false;
    const parentElement = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
    if (!parentElement) return false;

    if (parentElement.closest('textarea, input, [contenteditable="true"]')) {
        return false;
    }

    if (parentElement.closest('#selection-tooltip, #selection-popup')) {
        return false;
    }

    const appPage = document.getElementById('app-page');
    if (appPage && !appPage.contains(parentElement)) {
        return false;
    }

    return true;
}

function rectToPagePosition(rect) {
    return {
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX
    };
}

function showSelectionTooltip(clientRect) {
    const tooltip = SELECTION_ASSIST.tooltip;
    if (!tooltip) return;

    tooltip.style.display = 'flex';
    tooltip.classList.add('visible');

    const tooltipHeight = tooltip.offsetHeight || 0;
    const top = Math.max(clientRect.top + window.scrollY - tooltipHeight - 12, window.scrollY + 8);
    const left = clientRect.left + clientRect.width / 2 + window.scrollX;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

function hideSelectionTooltip() {
    const tooltip = SELECTION_ASSIST.tooltip;
    if (!tooltip) return;
    tooltip.classList.remove('visible');
    tooltip.style.display = 'none';
}

function handleExplainSelectionClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const text = (SELECTION_ASSIST.lastText || '').trim();
    if (!text) {
        hideSelectionTooltip();
        return;
    }

    if (!APP_STATE.apiKey) {
        alert('OpenAI API 키를 먼저 설정해주세요.');
        if (elements.settingsModal) {
            openModal(elements.settingsModal);
        }
        hideSelectionTooltip();
        return;
    }

    const position = SELECTION_ASSIST.lastPosition;
    hideSelectionTooltip();
    showSelectionPopup({
        content: '설명을 불러오는 중...',
        position,
        isLoading: true
    });

    cancelInlineExplanation();
    const controller = new AbortController();
    SELECTION_ASSIST.abortController = controller;
    const requestId = ++SELECTION_ASSIST.requestId;

    requestInlineExplanation(text, controller.signal)
        .then((explanation) => {
            if (controller.signal.aborted || requestId !== SELECTION_ASSIST.requestId) {
                return;
            }
            SELECTION_ASSIST.abortController = null;
            showSelectionPopup({
                content: explanation,
                position,
                asMarkdown: true
            });
        })
        .catch((error) => {
            if (controller.signal.aborted || requestId !== SELECTION_ASSIST.requestId) {
                return;
            }
            SELECTION_ASSIST.abortController = null;
            console.error('Failed to fetch explanation:', error);
            showSelectionPopup({
                content: '설명을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.',
                position,
                isError: true
            });
        });
}

function showSelectionPopup({ content, position = null, isLoading = false, isError = false, asMarkdown = false }) {
    const popup = SELECTION_ASSIST.popup;
    const popupBody = SELECTION_ASSIST.popupBody;
    if (!popup || !popupBody) return;

    popup.classList.toggle('loading', isLoading);
    popup.classList.toggle('error', isError);
    popup.style.display = 'block';
    popup.classList.add('visible');

    if (position) {
        SELECTION_ASSIST.lastPosition = position;
    }

    const resolvedPosition = position || SELECTION_ASSIST.lastPosition || {
        top: window.scrollY + window.innerHeight / 2,
        left: window.scrollX + document.documentElement.clientWidth / 2
    };
    positionSelectionPopup(resolvedPosition);

    if (asMarkdown) {
        popupBody.innerHTML = renderMarkdown(content);
    } else {
        popupBody.textContent = content;
    }
}

function positionSelectionPopup(position) {
    const popup = SELECTION_ASSIST.popup;
    if (!popup || !position) return;

    const padding = 16;
    const popupWidth = popup.offsetWidth || 320;
    const viewportWidth = document.documentElement.clientWidth;
    const maxLeft = window.scrollX + viewportWidth - popupWidth - padding;
    const preferredLeft = position.left - popupWidth / 2;
    const left = Math.max(window.scrollX + padding, Math.min(preferredLeft, maxLeft));
    const top = position.top + 12;

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
}

function hideSelectionPopup() {
    const popup = SELECTION_ASSIST.popup;
    if (!popup) return;
    popup.classList.remove('visible', 'loading', 'error');
    popup.style.display = 'none';
    if (SELECTION_ASSIST.popupBody) {
        SELECTION_ASSIST.popupBody.innerHTML = '';
    }
    cancelInlineExplanation();
}

function cancelInlineExplanation() {
    if (SELECTION_ASSIST.abortController) {
        SELECTION_ASSIST.abortController.abort();
        SELECTION_ASSIST.abortController = null;
    }
}

async function requestInlineExplanation(text, signal) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APP_STATE.apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4-turbo-preview',
            temperature: 0.3,
            max_tokens: 300,
            messages: [
                {
                    role: 'system',
                    content: '너는 어려운 내용을 초등학생도 이해할 수 있게 한국어로 쉽게 설명해주는 전문가야. 항상 간결하게 설명해.'
                },
                {
                    role: 'user',
                    content: `다음 내용을 쉬운 한국어로 3문장 이내로 설명해줘.\n\n선택한 내용: """${text}"""`
                }
            ]
        }),
        signal
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'API 요청 실패');
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content?.trim();
    if (!explanation) {
        throw new Error('설명을 생성하지 못했습니다.');
    }
    return explanation;
}

function completeAppLoading() {
    const body = document.body;
    if (!body) return;
    if (body.classList.contains('app-ready')) return;
    body.classList.remove('app-loading');
    body.classList.add('app-ready');
}

// 로그아웃 처리
function handleLogout() {
    APP_STATE.currentUser = null;
    APP_STATE.currentChatId = null;
    APP_STATE.conversationHistory = [];
    StorageManager.clearUser();
    document.body.classList.add('app-loading');
    document.body.classList.remove('app-ready');
    if (elements.sidebar) {
        elements.sidebar.classList.remove('active', 'collapsed');
    }
    hideSidebarOverlay();
    window.location.href = 'login.html';
}

// 모달 관리
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

function setupPricingModal() {
    if (!elements.pricingModal) return;
    
    const billingButtons = Array.from(elements.pricingModal.querySelectorAll('[data-billing-option]'));
    const priceElements = Array.from(elements.pricingModal.querySelectorAll('.plan-amount'));
    const periodElements = Array.from(elements.pricingModal.querySelectorAll('.plan-period'));
    const subtitleElements = Array.from(elements.pricingModal.querySelectorAll('.plan-subtitle'));
    const noteElements = Array.from(elements.pricingModal.querySelectorAll('.plan-note'));
    
    if (billingButtons.length === 0) return;
    
    const applyBilling = (billing) => {
        billingButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.billingOption === billing);
        });
        
        priceElements.forEach(el => {
            const value = billing === 'yearly' ? el.dataset.priceYearly : el.dataset.priceMonthly;
            if (value !== undefined) {
                el.textContent = value;
            }
        });
        
        periodElements.forEach(el => {
            const period = billing === 'yearly' ? el.dataset.periodYearly : el.dataset.periodMonthly;
            if (period !== undefined) {
                el.textContent = period;
            }
        });
        
        subtitleElements.forEach(el => {
            const label = billing === 'yearly' ? el.dataset.labelYearly : el.dataset.labelMonthly;
            if (label) {
                el.textContent = label;
            }
        });
        
        noteElements.forEach(el => {
            const label = billing === 'yearly' ? el.dataset.labelYearly : el.dataset.labelMonthly;
            if (label) {
                el.textContent = label;
            }
        });
        
        elements.pricingModal.dataset.billing = billing;
    };
    
    billingButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            applyBilling(btn.dataset.billingOption);
        });
    });
    
    elements.pricingModal.addEventListener('click', (event) => {
        if (event.target === elements.pricingModal) {
            closeModal(elements.pricingModal);
        }
    });
    
    applyBilling('monthly');
}

// 설정 저장
function saveSettings() {
    const apiKey = elements.openaiApiKeyInput.value.trim();
    
    if (apiKey) {
        APP_STATE.apiKey = apiKey;
        StorageManager.saveApiKey(apiKey);
        alert('설정이 저장되었습니다.');
        closeModal(elements.settingsModal);
    } else {
        alert('API 키를 입력해주세요.');
    }
}

// 반응형 헬퍼
function isMobileView() {
    return window.innerWidth <= 768;
}

function showSidebarOverlay() {
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.classList.add('visible');
    }
}

function hideSidebarOverlay() {
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.classList.remove('visible');
    }
}

function closeSidebarOnMobile() {
    if (!elements.sidebar) return;
    elements.sidebar.classList.remove('active');
    hideSidebarOverlay();
}

function handleWindowResize() {
    if (!elements.sidebar) return;
    
    if (isMobileView()) {
        elements.sidebar.classList.remove('collapsed');
        if (!elements.sidebar.classList.contains('active')) {
            hideSidebarOverlay();
        }
    } else {
        elements.sidebar.classList.remove('active');
        hideSidebarOverlay();
    }
}

// 사이드바 토글
function toggleSidebar() {
    if (!elements.sidebar) return;

    if (isMobileView()) {
        const isOpen = elements.sidebar.classList.toggle('active');
        if (isOpen) {
            elements.sidebar.classList.remove('collapsed');
            showSidebarOverlay();
        } else {
            hideSidebarOverlay();
        }
    } else {
        elements.sidebar.classList.toggle('collapsed');
        hideSidebarOverlay();
    }
}

// 새 채팅 생성
function createNewChat() {
    const chatId = 'chat_' + Date.now();
    
    APP_STATE.currentChatId = chatId;
    APP_STATE.chats[chatId] = {
        id: chatId,
        title: '새 대화',
        messages: [],
        createdAt: Date.now(),
        selectedService: 'chatgpt'
    };
    
    APP_STATE.conversationHistory = [];
    
    StorageManager.saveChats(APP_STATE.chats);
    renderChatHistory();
    clearMessages();
    showWelcomeScreen();
    
    if (isMobileView()) {
        closeSidebarOnMobile();
    }
}

// 채팅 로드
function loadChat(chatId) {
    const chat = APP_STATE.chats[chatId];
    if (!chat) return;
    
    APP_STATE.currentChatId = chatId;
    elements.aiServiceSelect.value = chat.selectedService || 'chatgpt';
    
    if (isMobileView()) {
        closeSidebarOnMobile();
    }
    
    // 대화 히스토리 복원
    APP_STATE.conversationHistory = chat.messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    
    clearMessages();
    if (chat.messages.length === 0) {
        showWelcomeScreen();
    } else {
        hideWelcomeScreen();
    }
    
    chat.messages.forEach(msg => {
        switch (msg.role) {
            case 'user':
            case 'assistant':
                appendMessage(msg.role, msg.content, false);
                break;
            case 'prompt_update':
                appendPromptUpdate(msg.content, false);
                break;
            case 'final_prompt':
                try {
                    const parsed = JSON.parse(msg.content);
                    showFinalPrompt(parsed.prompt, parsed.summary, parsed.service, false);
                } catch (error) {
                    console.error('Failed to parse final prompt message:', error);
                    appendMessage('assistant', msg.content, false);
                }
                break;
            case 'prompt_options':
                try {
                    const parsed = JSON.parse(msg.content);
                    if (parsed && parsed.dismissed) {
                        break;
                    }
                    appendPromptOptionsMessage(
                        parsed?.options || [],
                        {
                            selectedIndex: typeof parsed?.selectedIndex === 'number' ? parsed.selectedIndex : null,
                            completed: Boolean(parsed?.completed),
                            dismissed: Boolean(parsed?.dismissed)
                        },
                        { timestamp: msg.timestamp },
                        false
                    );
                } catch (error) {
                    console.error('Failed to parse prompt options message:', error);
                }
                break;
            case 'survey':
                try {
                    const payload = JSON.parse(msg.content);
                    appendSurveyMessage(
                        payload?.config || {},
                        payload?.state || {},
                        { timestamp: msg.timestamp },
                        false
                    );
                } catch (error) {
                    console.error('Failed to parse survey message:', error);
                }
                break;
            default:
                appendMessage('assistant', msg.content, false);
                break;
        }
    });
    
    renderChatHistory();
}

// 채팅 기록 렌더링
function renderChatHistory() {
    elements.chatHistory.innerHTML = '';
    
    const chatIds = Object.keys(APP_STATE.chats).sort((a, b) => {
        return APP_STATE.chats[b].createdAt - APP_STATE.chats[a].createdAt;
    });
    
    chatIds.forEach(chatId => {
        const chat = APP_STATE.chats[chatId];
        const item = document.createElement('div');
        item.className = 'chat-history-item';
        if (chatId === APP_STATE.currentChatId) {
            item.classList.add('active');
        }
        item.textContent = chat.title;
        item.addEventListener('click', () => loadChat(chatId));
        elements.chatHistory.appendChild(item);
    });
}

// 메시지 처리
function handleSendMessage(e) {
    e.preventDefault();
    
    const message = elements.messageInput.value.trim();
    if (!message) return;
    
    if (!APP_STATE.apiKey) {
        alert('OpenAI API 키를 먼저 설정해주세요.');
        openModal(elements.settingsModal);
        return;
    }
    
    elements.messageInput.value = '';
    autoResizeTextarea({ target: elements.messageInput });
    
    hideWelcomeScreen();
    sendMessage(message);
}

// 메시지 전송
async function sendMessage(userMessage) {
    // 사용자 메시지 추가
    appendMessage('user', userMessage);
    saveMessageToChat('user', userMessage);
    
    // 대화 제목 업데이트 (첫 메시지인 경우)
    const currentChat = APP_STATE.chats[APP_STATE.currentChatId];
    if (currentChat.messages.length === 1) {
        currentChat.title = userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : '');
        renderChatHistory();
    }
    
    // 로딩 표시
    const loadingId = showTypingIndicator();
    
    // 대화 히스토리에 추가
    APP_STATE.conversationHistory.push({
        role: 'user',
        content: userMessage
    });
    
    try {
        // OpenAI API 호출
        const response = await callOpenAI(APP_STATE.conversationHistory);
        
        removeTypingIndicator(loadingId);
        
        // Function calling 처리
        if (response.tool_calls && response.tool_calls.length > 0) {
            await handleFunctionCalls(response);
        } else if (response.content) {
            // 일반 응답
            appendMessage('assistant', response.content);
            saveMessageToChat('assistant', response.content);
            
            APP_STATE.conversationHistory.push({
                role: 'assistant',
                content: response.content
            });
        }
        
    } catch (error) {
        removeTypingIndicator(loadingId);
        console.error('Error:', error);
        appendMessage('assistant', '죄송합니다. 오류가 발생했습니다: ' + error.message);
    }
}

// OpenAI API 호출
async function callOpenAI(messages) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APP_STATE.apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4-turbo-preview',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...messages
            ],
            tools: FUNCTIONS.map(func => ({
                type: 'function',
                function: func
            })),
            tool_choice: 'auto'
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API 호출 실패');
    }
    
    const data = await response.json();
    console.log('OpenAI Response:', data);
    
    return data.choices[0].message;
}

// Function Calls 처리
async function handleFunctionCalls(responseMessage) {
    const toolCall = responseMessage.tool_calls[0];
    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments);
    
    console.log('Function Call:', functionName, functionArgs);
    
    // Function call을 대화 히스토리에 추가
    APP_STATE.conversationHistory.push({
        role: 'assistant',
        content: null,
        tool_calls: responseMessage.tool_calls
    });
    
    let functionResult = null;
    
    switch (functionName) {
        case 'suggest_prompt_options':
            functionResult = await handleSuggestPromptOptions(functionArgs);
            break;
            
        case 'update_prompt':
            functionResult = await handleUpdatePrompt(functionArgs);
            break;
            
        case 'finalize_prompt':
            functionResult = await handleFinalizePrompt(functionArgs);
            break;
            
        case 'request_survey':
            functionResult = await handleRequestSurvey(functionArgs);
            break;
    }
    
    // Function 결과를 대화 히스토리에 추가
    APP_STATE.conversationHistory.push({
        role: 'tool',
        content: JSON.stringify(functionResult),
        tool_call_id: toolCall.id
    });
    
    // Function 결과를 바탕으로 다시 API 호출
    const followUpResponse = await callOpenAI(APP_STATE.conversationHistory);
    
    if (followUpResponse.content) {
        appendMessage('assistant', followUpResponse.content);
        saveMessageToChat('assistant', followUpResponse.content);
        
        APP_STATE.conversationHistory.push({
            role: 'assistant',
            content: followUpResponse.content
        });
    }
}

// 프롬프트 옵션 제안 처리
async function handleSuggestPromptOptions(args) {
    appendPromptOptionsMessage(args.options);
    
    return {
        success: true,
        message: '프롬프트 옵션을 사용자에게 표시했습니다.'
    };
}

// 프롬프트 업데이트 처리
async function handleUpdatePrompt(args) {
    const promptText = args.updated_prompt || '';
    appendPromptUpdate(promptText);
    
    return {
        success: true,
        message: '프롬프트가 업데이트되었습니다.'
    };
}

// 프롬프트 최종 확정 처리
async function handleFinalizePrompt(args) {
    const promptText = args.final_prompt || '';
    const summary = args.summary || '';
    const service = args.service || null;
    
    showFinalPrompt(promptText, summary, service);
    
    return {
        success: true,
        message: '프롬프트가 최종 확정되었습니다.'
    };
}

function appendPromptOptionsMessage(options, state = {}, messageMeta = {}, shouldSave = true) {
    if (!Array.isArray(options) || options.length === 0) {
        console.warn('No prompt options provided.');
        return;
    }
    
    const normalizedState = {
        selectedIndex: typeof state.selectedIndex === 'number' ? state.selectedIndex : null,
        completed: Boolean(state.completed),
        dismissed: Boolean(state.dismissed)
    };
    
    if (normalizedState.dismissed) {
        return;
    }
    
    APP_STATE.selectedPromptOption = null;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant prompt-options-message';
    messageDiv.dataset.completed = normalizedState.completed ? 'true' : 'false';
    if (normalizedState.completed) {
        messageDiv.classList.add('completed');
    }
    
    const optionsHtml = options.map((option, index) => `
        <div class="prompt-option ${normalizedState.selectedIndex === index ? 'selected' : ''}" data-index="${index}">
            <div class="prompt-option-header">
                <div class="radio-indicator"></div>
                <div class="prompt-option-title">${escapeHtml(option.title)}</div>
            </div>
            <div class="prompt-option-text markdown-body">${renderMarkdown(option.prompt)}</div>
        </div>
    `).join('');
    
    const actionsMarkup = normalizedState.completed ? '' : `
        <div class="prompt-option-actions">
            <button class="btn-secondary prompt-option-cancel">취소</button>
            <button class="btn-primary prompt-option-confirm"${normalizedState.selectedIndex === null ? ' disabled' : ''}>선택 확인</button>
        </div>
    `;
    
    const statusMarkup = `
        <div class="prompt-option-status${normalizedState.completed ? '' : ' hidden'}">선택이 완료되었습니다.</div>
    `;
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-header">
                <div class="message-avatar">M</div>
                <span>MORPHES</span>
            </div>
            <div class="message-text">프롬프트 옵션을 선택해주세요.</div>
            <div class="prompt-options">
                ${optionsHtml}
            </div>
            ${actionsMarkup}
            ${statusMarkup}
        </div>
    `;
    
    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    const payload = {
        options,
        selectedIndex: normalizedState.selectedIndex,
        completed: normalizedState.completed,
        dismissed: normalizedState.dismissed
    };
    
    let savedRecord = null;
    
    if (shouldSave) {
        savedRecord = saveMessageToChat('prompt_options', JSON.stringify(payload));
    }
    
    const timestamp = messageMeta.timestamp || (savedRecord && savedRecord.timestamp);
    if (timestamp) {
        messageDiv.dataset.messageTimestamp = timestamp;
    }
    
    const optionElements = messageDiv.querySelectorAll('.prompt-option');
    const confirmBtn = messageDiv.querySelector('.prompt-option-confirm');
    const cancelBtn = messageDiv.querySelector('.prompt-option-cancel');
    const statusEl = messageDiv.querySelector('.prompt-option-status');
    
    let currentIndex = normalizedState.selectedIndex;
    
    if (!normalizedState.completed && currentIndex !== null) {
        APP_STATE.selectedPromptOption = options[currentIndex];
    }
    
    optionElements.forEach(optionElement => {
        optionElement.addEventListener('click', () => {
            if (messageDiv.dataset.completed === 'true') return;
            
            optionElements.forEach(opt => opt.classList.remove('selected'));
            optionElement.classList.add('selected');
            
            currentIndex = Number(optionElement.dataset.index);
            APP_STATE.selectedPromptOption = options[currentIndex];
            
            if (confirmBtn) {
                confirmBtn.disabled = false;
            }
            
            updatePromptOptionsMessageState(messageDiv.dataset.messageTimestamp, {
                selectedIndex: currentIndex,
                dismissed: false
            });
        });
    });
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            if (currentIndex === null) return;
            
            handlePromptOptionConfirm(
                options[currentIndex],
                currentIndex,
                messageDiv.dataset.messageTimestamp,
                messageDiv,
                statusEl
            );
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            handlePromptOptionCancel(messageDiv.dataset.messageTimestamp, messageDiv);
        });
    }
}

function handlePromptOptionConfirm(option, selectedIndex, timestamp, container, statusElement) {
    const message = `"${option.title}" 옵션을 선택했습니다.`;
    
    appendMessage('user', message);
    saveMessageToChat('user', message);
    
    appendPromptUpdate(option.prompt);
    
    APP_STATE.conversationHistory.push({
        role: 'user',
        content: message
    });
    
    APP_STATE.selectedPromptOption = null;
    
    updatePromptOptionsMessageState(timestamp, {
        completed: true,
        selectedIndex,
        dismissed: false
    });
    
    if (container) {
        container.dataset.completed = 'true';
        container.classList.add('completed');
        const actions = container.querySelector('.prompt-option-actions');
        if (actions) {
            actions.remove();
        }
    }
    
    if (statusElement) {
        statusElement.classList.remove('hidden');
    } else if (container) {
        const statusMessage = document.createElement('div');
        statusMessage.className = 'prompt-option-status';
        statusMessage.textContent = '선택이 완료되었습니다.';
        container.querySelector('.message-content').appendChild(statusMessage);
    }
}

function handlePromptOptionCancel(timestamp, container) {
    updatePromptOptionsMessageState(timestamp, {
        dismissed: true
    });
    APP_STATE.selectedPromptOption = null;
    if (container) {
        container.remove();
    }
}

function updatePromptOptionsMessageState(timestamp, updates) {
    if (!timestamp) return;
    const chat = APP_STATE.chats[APP_STATE.currentChatId];
    if (!chat) return;
    const targetTimestamp = Number(timestamp);
    const message = chat.messages.find(msg => msg.timestamp === targetTimestamp && msg.role === 'prompt_options');
    if (!message) return;
    
    let payload;
    try {
        payload = JSON.parse(message.content);
    } catch (error) {
        console.error('Failed to parse prompt options payload:', error);
        return;
    }
    
    if (!payload || typeof payload !== 'object') {
        payload = {};
    }
    
    const updatedPayload = {
        ...payload,
        ...updates
    };
    
    message.content = JSON.stringify(updatedPayload);
    StorageManager.saveChats(APP_STATE.chats);
}

async function handleRequestSurvey(args) {
    const surveyConfig = {
        surveyId: args.survey_id || `survey_${Date.now()}`,
        title: args.title || '',
        prompt: args.prompt || '',
        type: args.survey_type || 'multiple_choice',
        options: Array.isArray(args.options) ? args.options : [],
        allowMultiple: Boolean(args.allow_multiple),
        required: args.required !== false,
        placeholder: args.placeholder || '',
        submitLabel: args.submit_label || '응답 제출'
    };
    
    appendSurveyMessage(surveyConfig);
    
    return {
        success: true,
        message: '설문을 사용자에게 표시했습니다.'
    };
}

function appendSurveyMessage(configInput, state = {}, messageMeta = {}, shouldSave = true) {
    const config = {
        surveyId: configInput.surveyId,
        title: configInput.title || '',
        prompt: configInput.prompt || '',
        type: configInput.type || 'multiple_choice',
        options: Array.isArray(configInput.options) ? configInput.options : [],
        allowMultiple: Boolean(configInput.allowMultiple),
        required: configInput.required !== false,
        placeholder: configInput.placeholder || '',
        submitLabel: configInput.submitLabel || '응답 제출'
    };
    
    if (!config.prompt) {
        console.warn('설문 질문(prompt)이 비어 있습니다.');
        return;
    }
    
    const normalizedState = {
        selectedOptions: Array.isArray(state.selectedOptions) ? state.selectedOptions : [],
        inputValue: typeof state.inputValue === 'string' ? state.inputValue : '',
        completed: Boolean(state.completed),
        dismissed: Boolean(state.dismissed),
        answers: state.answers || null,
        submittedAt: state.submittedAt || null
    };
    
    if (normalizedState.dismissed) {
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant survey-message';
    messageDiv.dataset.surveyId = config.surveyId;
    messageDiv.dataset.completed = normalizedState.completed ? 'true' : 'false';
    if (normalizedState.completed) {
        messageDiv.classList.add('completed');
    }
    
    const titleMarkup = config.title ? `<div class="survey-title">${escapeHtml(config.title)}</div>` : '';
    const promptMarkup = `<div class="survey-prompt markdown-body">${renderMarkdown(config.prompt)}</div>`;
    
    let controlMarkup = '';
    
    if (config.type === 'multiple_choice') {
        if (config.options.length === 0) {
            console.warn('선택형 설문에는 최소 1개의 옵션이 필요합니다.');
            return;
        }
        
        const inputType = config.allowMultiple ? 'checkbox' : 'radio';
        const optionName = `survey_${config.surveyId}`;
        
        controlMarkup = `
            <div class="survey-options">
                ${config.options.map((option, index) => {
                    const optionId = `${optionName}_${index}`;
                    const isSelected = normalizedState.selectedOptions.includes(option);
                    return `
                        <label class="survey-option">
                            <input 
                                type="${inputType}" 
                                name="${optionName}" 
                                value="${escapeHtml(option)}" 
                                id="${optionId}" 
                                ${isSelected ? 'checked' : ''}
                                ${normalizedState.completed ? 'disabled' : ''}
                            />
                            <span>${escapeHtml(option)}</span>
                        </label>
                    `;
                }).join('')}
            </div>
        `;
    } else {
        controlMarkup = `
            <div class="survey-input-wrapper">
                <textarea 
                    class="survey-input" 
                    rows="3" 
                    placeholder="${escapeHtml(config.placeholder || '응답을 입력해주세요.')}"
                    ${normalizedState.completed ? 'disabled' : ''}
                >${escapeHtml(normalizedState.inputValue)}</textarea>
            </div>
        `;
    }
    
    const submitLabel = escapeHtml(config.submitLabel || '응답 제출');
    const actionsMarkup = `
        <div class="survey-actions ${normalizedState.completed ? 'hidden' : ''}">
            <button class="btn-primary survey-submit-btn">${submitLabel}</button>
        </div>
    `;
    
    const statusText = normalizedState.completed ? '응답이 제출되었습니다.' : '';
    const statusMarkup = `
        <div class="survey-status ${normalizedState.completed ? '' : 'hidden'}">${statusText}</div>
    `;
    
    const summaryMarkup = `
        <div class="survey-answer-summary ${normalizedState.answers ? '' : 'hidden'}">
            ${normalizedState.answers ? renderMarkdown(formatSurveyAnswerSummary(config, normalizedState.answers)) : ''}
        </div>
    `;
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-header">
                <div class="message-avatar">M</div>
                <span>MORPHES</span>
            </div>
            <div class="survey-body">
                ${titleMarkup}
                ${promptMarkup}
                ${controlMarkup}
                ${actionsMarkup}
                ${statusMarkup}
                ${summaryMarkup}
            </div>
        </div>
    `;
    
    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    const storedPayload = {
        config,
        state: normalizedState
    };
    
    let savedRecord = null;
    
    if (shouldSave) {
        savedRecord = saveMessageToChat('survey', JSON.stringify(storedPayload));
    }
    
    const timestamp = messageMeta.timestamp || storedPayload.state?.timestamp || (savedRecord && savedRecord.timestamp);
    if (timestamp) {
        messageDiv.dataset.messageTimestamp = timestamp;
    }
    
    const surveyBody = messageDiv.querySelector('.survey-body');
    const submitBtn = surveyBody.querySelector('.survey-submit-btn');
    const statusEl = surveyBody.querySelector('.survey-status');
    const summaryEl = surveyBody.querySelector('.survey-answer-summary');
    
    const updateSummaryDisplay = (answers) => {
        if (!summaryEl) return;
        if (answers) {
            summaryEl.innerHTML = renderMarkdown(formatSurveyAnswerSummary(config, answers));
            summaryEl.classList.remove('hidden');
        } else {
            summaryEl.classList.add('hidden');
            summaryEl.innerHTML = '';
        }
    };
    
    if (config.type === 'multiple_choice') {
        const optionInputs = Array.from(surveyBody.querySelectorAll('.survey-option input'));
        
        if (!normalizedState.completed) {
            optionInputs.forEach(input => {
                input.addEventListener('change', () => {
                    const selected = optionInputs
                        .filter(opt => opt.checked)
                        .map(opt => opt.value);
                    
                    updateSurveyMessageState(messageDiv.dataset.messageTimestamp, {
                        state: {
                            selectedOptions: selected
                        }
                    });
                });
            });
        }
    } else {
        const textarea = surveyBody.querySelector('.survey-input');
        if (textarea && !normalizedState.completed) {
            textarea.addEventListener('input', () => {
                updateSurveyMessageState(messageDiv.dataset.messageTimestamp, {
                    state: {
                        inputValue: textarea.value
                    }
                });
            });
        }
    }
    
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            handleSurveySubmit({
                config,
                container: messageDiv,
                statusEl,
                summaryEl,
                getOptions: () => Array.from(surveyBody.querySelectorAll('.survey-option input')),
                textarea: surveyBody.querySelector('.survey-input')
            });
        });
    }
    
    if (normalizedState.answers) {
        updateSummaryDisplay(normalizedState.answers);
    }
}

function handleSurveySubmit({ config, container, statusEl, summaryEl, getOptions, textarea }) {
    if (container.dataset.completed === 'true') {
        return;
    }
    
    let responsePayload = null;
    
    if (config.type === 'multiple_choice') {
        const optionInputs = getOptions ? getOptions() : [];
        const selected = optionInputs
            .filter(opt => opt.checked)
            .map(opt => opt.value);
        
        if (config.required && selected.length === 0) {
            alert('하나 이상의 옵션을 선택해주세요.');
            return;
        }
        
        responsePayload = {
            type: 'multiple_choice',
            selectedOptions: selected
        };
    } else {
        const value = (textarea?.value || '').trim();
        if (config.required && value.length === 0) {
            alert('응답을 입력해주세요.');
            return;
        }
        responsePayload = {
            type: 'input',
            inputValue: value
        };
    }
    
    submitSurveyResponse(config, container, statusEl, summaryEl, responsePayload);
}

function submitSurveyResponse(config, container, statusEl, summaryEl, answers) {
    const timestamp = container.dataset.messageTimestamp;
    
    if (summaryEl) {
        summaryEl.innerHTML = renderMarkdown(formatSurveyAnswerSummary(config, answers));
        summaryEl.classList.remove('hidden');
    }
    
    if (statusEl) {
        statusEl.textContent = '응답이 제출되었습니다.';
        statusEl.classList.remove('hidden');
    }
    
    container.dataset.completed = 'true';
    container.classList.add('completed');
    
    const submitBtn = container.querySelector('.survey-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.closest('.survey-actions')?.classList.add('hidden');
    }
    
    container.querySelectorAll('.survey-option input').forEach(input => {
        input.disabled = true;
    });
    
    const textarea = container.querySelector('.survey-input');
    if (textarea) {
        textarea.disabled = true;
    }
    
    const submittedAt = Date.now();
    
    updateSurveyMessageState(timestamp, {
        state: {
            completed: true,
            answers,
            submittedAt
        }
    });
    
    const userMessage = buildSurveyAnswerMessage(config, answers);
    if (userMessage) {
        sendMessage(userMessage);
    }
}

function updateSurveyMessageState(timestamp, updates) {
    if (!timestamp) return;
    const chat = APP_STATE.chats[APP_STATE.currentChatId];
    if (!chat) return;
    
    const targetTimestamp = Number(timestamp);
    const message = chat.messages.find(msg => msg.timestamp === targetTimestamp && msg.role === 'survey');
    if (!message) return;
    
    let payload;
    try {
        payload = JSON.parse(message.content);
    } catch (error) {
        console.error('Failed to parse survey payload:', error);
        return;
    }
    
    if (!payload || typeof payload !== 'object') {
        payload = {};
    }
    
    if (updates.config) {
        payload.config = {
            ...(payload.config || {}),
            ...updates.config
        };
    }
    
    if (updates.state) {
        payload.state = {
            ...(payload.state || {}),
            ...updates.state
        };
    }
    
    message.content = JSON.stringify(payload);
    StorageManager.saveChats(APP_STATE.chats);
}

function formatSurveyAnswerSummary(config, answers) {
    if (!answers) return '';
    
    if (answers.type === 'multiple_choice') {
        const selections = Array.isArray(answers.selectedOptions) ? answers.selectedOptions : [];
        if (selections.length === 0) {
            return '선택한 옵션이 없습니다.';
        }
        const list = selections.map(option => `- ${option}`).join('\n');
        return `**선택한 옵션**\n${list}`;
    }
    
    if (answers.type === 'input') {
        const value = answers.inputValue || '';
        if (!value.trim()) {
            return '입력한 응답이 없습니다.';
        }
        return `**응답 내용**\n${value}`;
    }
    
    return '';
}

function buildSurveyAnswerMessage(config, answers) {
    if (!config || !answers) return null;
    
    const header = config.title ? `[설문 응답 - ${config.title}]` : '[설문 응답]';
    const promptLine = config.prompt ? `${config.prompt}\n` : '';
    
    if (answers.type === 'multiple_choice') {
        const selections = Array.isArray(answers.selectedOptions) ? answers.selectedOptions : [];
        const selectionLine = selections.length > 0 ? selections.join(', ') : '선택 없음';
        return `${header}\n${promptLine}선택한 옵션: ${selectionLine}`;
    }
    
    if (answers.type === 'input') {
        const value = answers.inputValue || '';
        return `${header}\n${promptLine}응답 내용: ${value}`;
    }
    
    return null;
}

// 프롬프트 업데이트 표시
function appendPromptUpdate(promptText, shouldSave = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-header">
                <div class="message-avatar">M</div>
                <span>MORPHES</span>
            </div>
            <div class="message-text">현재 프롬프트:</div>
            <div class="prompt-options">
                <div class="prompt-option selected">
                    <div class="prompt-option-text markdown-body">${renderMarkdown(promptText)}</div>
                </div>
            </div>
        </div>
    `;
    
    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    if (shouldSave) {
        saveMessageToChat('prompt_update', promptText);
    }
}

// 최종 프롬프트 표시
function showFinalPrompt(promptText, summary, selectedService = null, shouldSave = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    
    const service = selectedService || elements.aiServiceSelect.value;
    const serviceUrls = {
        'chatgpt': 'https://chatgpt.com/?q=',
        'claude': 'https://claude.ai/new?q=',
        'gemini': 'https://gemini.google.com/?q=',
        'perplexity': 'https://www.perplexity.ai/?q='
    };
    
    const encodedPrompt = encodeURIComponent(promptText);
    const targetUrl = serviceUrls[service] + encodedPrompt;
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-header">
                <div class="message-avatar">M</div>
                <span>MORPHES</span>
            </div>
            <div class="message-text markdown-body">${renderMarkdown(summary)}</div>
            <div class="final-prompt-container">
                <div class="final-prompt-header">
                    <div class="final-prompt-title">✨ 최종 프롬프트</div>
                </div>
                <div class="final-prompt-text markdown-body">${renderMarkdown(promptText)}</div>
                <button class="btn-send-to-ai" onclick="window.open('${targetUrl}', '_blank')">
                    ${service.toUpperCase()}로 전송하기 →
                </button>
            </div>
        </div>
    `;
    
    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    if (shouldSave) {
        saveMessageToChat('final_prompt', JSON.stringify({ prompt: promptText, summary, service }));
    }
}

// UI 헬퍼 함수
function appendMessage(role, content, shouldSave = true) {
    hideWelcomeScreen();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    const formattedContent = renderMarkdown(content);
    
    if (role === 'user') {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <div class="message-avatar">U</div>
                    <span>나</span>
                </div>
                <div class="message-text markdown-body">${formattedContent}</div>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <div class="message-avatar">M</div>
                    <span>MORPHES</span>
                </div>
                <div class="message-text markdown-body">${formattedContent}</div>
            </div>
        `;
    }
    
    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const loadingDiv = document.createElement('div');
    const loadingId = 'loading_' + Date.now();
    loadingDiv.id = loadingId;
    loadingDiv.className = 'message assistant';
    
    loadingDiv.innerHTML = `
        <div class="message-content">
            <div class="message-header">
                <div class="message-avatar">M</div>
                <span>MORPHES</span>
            </div>
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    
    elements.messagesContainer.appendChild(loadingDiv);
    scrollToBottom();
    
    return loadingId;
}

function removeTypingIndicator(loadingId) {
    const loadingDiv = document.getElementById(loadingId);
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

function clearMessages() {
    const welcome = elements.welcomeScreen;
    elements.messagesContainer.innerHTML = '';
    if (welcome) {
        elements.messagesContainer.appendChild(welcome);
    }
}

function showWelcomeScreen() {
    elements.welcomeScreen.style.display = 'flex';
}

function hideWelcomeScreen() {
    elements.welcomeScreen.style.display = 'none';
}

function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

function handleTextareaKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        elements.chatForm.dispatchEvent(new Event('submit'));
    }
}

function renderMarkdown(text) {
    if (text === undefined || text === null) {
        return '';
    }
    if (window.marked) {
        const rawHtml = window.marked.parse(String(text));
        if (window.DOMPurify) {
            return window.DOMPurify.sanitize(rawHtml);
        }
        return rawHtml;
    }
    return escapeHtml(text);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

// 채팅에 메시지 저장
function saveMessageToChat(role, content) {
    if (!APP_STATE.currentChatId) return null;
    
    const chat = APP_STATE.chats[APP_STATE.currentChatId];
    if (!chat) return null;
    
    const messageRecord = {
        role,
        content,
        timestamp: Date.now()
    };
    
    chat.messages.push(messageRecord);
    
    // 선택된 서비스 저장
    chat.selectedService = elements.aiServiceSelect.value;
    
    StorageManager.saveChats(APP_STATE.chats);
    
    return messageRecord;
}

// 앱 시작
document.addEventListener('DOMContentLoaded', init);
