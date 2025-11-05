// 전역 상태 관리
const APP_STATE = {
    currentUser: null,
    currentChatId: null,
    chats: {},
    apiKey: null,
    selectedPromptOption: null,
    conversationHistory: []
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
const SYSTEM_PROMPT = `당신은 고급 AI 프롬프트 엔지니어입니다. 사용자와 대화하면서 그들이 원하는 AI 프롬프트를 만들어주는 역할입니다.

작업 흐름:
1. 사용자가 원하는 프롬프트에 대해 설명하면, suggest_prompt_options 함수를 호출하여 정확히 2개의 프롬프트 옵션을 제안합니다.
2. 사용자가 하나를 선택하면, 그것을 기반으로 대화를 이어가며 필요시 update_prompt 함수로 프롬프트를 개선합니다.
3. 사용자가 만족하면 finalize_prompt 함수를 호출하여 최종 프롬프트를 확정합니다.
4. 사용자에게 물어볼 것이 있다면 가급적 request_survey 함수를 사용하여 설문을 만듭니다. 여러 개, 여러 종류의 설문을 이어서 많이 제시하세요. 많이 제시할 수록 좋습니다. 설문을 통해 최대한 구체화를 진행해야 합니다. 질문의 종류별로 적절한 설문 형태를 선택하세요.

규칙:
- 항상 친근하고 전문적으로 대화합니다
- 프롬프트는 명확하고 구체적이며 실행 가능해야 합니다
- 사용자의 요구사항을 정확히 파악하기 위해 필요시 질문합니다
- 함수는 적절한 시점에만 호출합니다

프롬프트 작성 필수 준수 원칙:
1. 역할 부여: AI가 수행할 역할을 명확히 정의하세요. 또한 AI에게 가상의 전문가 페르소나를 부여하는 것도 효과적입니다.
2. 구체적인 지침: 원하는 출력 형식, 톤, 스타일에 대한 구체적인 지침을 제공하세요. 최대한 구체적이고 상세하며 명확해야 합니다.
3. 맥락 제공: 필요한 경우 배경 정보나 맥락을 제공하여 AI가 더 나은 응답을 생성할 수 있도록 도와주세요.
4. 예시 포함: 원하는 출력 형식에 대한 예시를 포함하면 AI가 기대치를 이해하는 데 도움이 됩니다.
5. 할루시네이션 방지: 사실에 기반한 응답을 요구하고, 출처가 필요한 경우 명확히 지시하세요. 또한 95% 이상의 확신이 없는 정보는 제공하지 않도록 하세요.
6. 단계별 접근: 복잡한 작업의 경우, AI가 단계별로 작업을 수행하도록 안내하세요. AI가 스스로 계획을 짜고 이를 수행하도록 하는 것도 좋습니다.
7. 피드백 루프: AI의 출력을 검토하고 필요한 경우 추가 지침이나 수정 사항을 제공하여 프롬프트를 반복적으로 개선하세요.
8. 지시할 때 하지마 보다는 ~와 같이 해줘 형태로 긍정적인 방향으로 안내하세요. 
9. 불필요한 예의 어휘(부탁해, 고마워)를 제외하세요.
이 지침을 따라 사용자가 원하는 최적의 영문 프롬프트를 생성해 주세요.`;

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
    // 페이지
    loginPage: document.getElementById('login-page'),
    appPage: document.getElementById('app-page'),
    
    // 로그인
    loginForm: document.getElementById('login-form'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    
    // 사이드바
    sidebar: document.getElementById('sidebar'),
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
    APP_STATE.chats = StorageManager.loadChats();
    APP_STATE.apiKey = StorageManager.loadApiKey();
    
    // API 키가 있으면 입력창에 표시
    if (APP_STATE.apiKey) {
        elements.openaiApiKeyInput.value = APP_STATE.apiKey;
    }
    
    // 로그인 상태 확인
    if (APP_STATE.currentUser) {
        showApp();
    } else {
        showLogin();
    }
    
    // 이벤트 리스너 등록
    registerEventListeners();
    
    // 요금제 토글 초기화
    setupPricingModal();
}

// 이벤트 리스너 등록
function registerEventListeners() {
    // 로그인
    elements.loginForm.addEventListener('submit', handleLogin);
    
    // 사이드바
    elements.newChatBtn.addEventListener('click', createNewChat);
    elements.settingsBtn.addEventListener('click', () => openModal(elements.settingsModal));
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.toggleSidebarBtn.addEventListener('click', toggleSidebar);
    
    if (elements.upgradeBtn && elements.pricingModal) {
        elements.upgradeBtn.addEventListener('click', () => openModal(elements.pricingModal));
    }
    if (elements.closePricing && elements.pricingModal) {
        elements.closePricing.addEventListener('click', () => closeModal(elements.pricingModal));
    }
    
    // 채팅
    elements.chatForm.addEventListener('submit', handleSendMessage);
    elements.messageInput.addEventListener('input', autoResizeTextarea);
    elements.messageInput.addEventListener('keydown', handleTextareaKeydown);
    
    // 예시 프롬프트
    document.querySelectorAll('.example-prompt').forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.messageInput.value = e.target.textContent;
            elements.messageInput.focus();
        });
    });
    
    // 설정 모달
    elements.closeSettings.addEventListener('click', () => closeModal(elements.settingsModal));
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    
}

// 로그인 처리
function handleLogin(e) {
    e.preventDefault();
    
    const email = elements.loginEmail.value;
    const password = elements.loginPassword.value;
    
    // 간단한 데모 로그인
    if (email && password) {
        APP_STATE.currentUser = {
            email: email,
            name: email.split('@')[0]
        };
        
        StorageManager.saveCurrentUser(APP_STATE.currentUser);
        showApp();
    }
}

// 로그아웃 처리
function handleLogout() {
    APP_STATE.currentUser = null;
    APP_STATE.currentChatId = null;
    APP_STATE.conversationHistory = [];
    StorageManager.clearUser();
    showLogin();
}

// 페이지 전환
function showLogin() {
    elements.loginPage.classList.add('active');
    elements.appPage.classList.remove('active');
}

function showApp() {
    elements.loginPage.classList.remove('active');
    elements.appPage.classList.add('active');
    
    // 채팅 기록 렌더링
    renderChatHistory();
    
    // 기존 채팅이 있으면 마지막 채팅 로드, 없으면 새 채팅
    const chatIds = Object.keys(APP_STATE.chats);
    if (chatIds.length > 0) {
        loadChat(chatIds[chatIds.length - 1]);
    } else {
        createNewChat();
    }
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

// 사이드바 토글
function toggleSidebar() {
    elements.sidebar.classList.toggle('collapsed');
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
}

// 채팅 로드
function loadChat(chatId) {
    const chat = APP_STATE.chats[chatId];
    if (!chat) return;
    
    APP_STATE.currentChatId = chatId;
    elements.aiServiceSelect.value = chat.selectedService || 'chatgpt';
    
    // 대화 히스토리 복원
    APP_STATE.conversationHistory = chat.messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    
    clearMessages();
    hideWelcomeScreen();
    
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
    elements.messagesContainer.innerHTML = '';
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
