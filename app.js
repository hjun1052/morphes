// 전역 상태 관리
const APP_STATE = {
    currentUser: null,
    currentChatId: null,
    chats: {},
    apiKey: null,
    selectedPromptOption: null,
    conversationHistory: [],
    userProfile: null,
    memories: [],
    projects: {},
    promptLibrary: [],
    promptGallery: [],
    currentProjectId: null
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

const ONBOARDING_QUESTIONS = [
    {
        id: 'role',
        title: '주로 어떤 역할로 MORPHES를 사용하시나요?',
        options: [
            { value: 'creator', label: '콘텐츠 크리에이터', description: '블로그·뉴스레터·SNS' },
            { value: 'developer', label: '개발자 / 엔지니어', description: '기술 문서·코드 해설' },
            { value: 'marketer', label: '마케팅/기획', description: '캠페인·전략·GTM' },
            { value: 'educator', label: '교육·강의', description: '수업 자료·학습 가이드' }
        ]
    },
    {
        id: 'goal',
        title: '이번 프로젝트에서 가장 중요한 것은 무엇인가요?',
        options: [
            { value: 'speed', label: '빠른 초안 생성', description: '아이디어를 재빠르게 확인' },
            { value: 'quality', label: '완성도 높은 품질', description: '디테일과 정확도가 최우선' },
            { value: 'experiment', label: '새로운 시도', description: '다양한 버전을 실험하고 싶어요' },
            { value: 'consistency', label: '브랜드 일관성', description: '톤 & 메시지 유지' }
        ]
    },
    {
        id: 'tone',
        title: 'AI가 어떤 말투로 응답하면 좋을까요?',
        options: [
            { value: 'professional', label: '전문적이고 격식 있는 톤', description: '보고서·비즈니스용' },
            { value: 'friendly', label: '친근하고 대화체', description: '가볍고 읽기 쉬운 톤' },
            { value: 'playful', label: '재치 있고 창의적인', description: '아이디어 발상·크리에이티브' }
        ]
    },
    {
        id: 'structure',
        title: '원하는 출력 형태를 골라주세요',
        options: [
            { value: 'step_by_step', label: '단계별 가이드', description: '1,2,3 순서대로 정리' },
            { value: 'checklist', label: '체크리스트', description: '항목별 점검 포맷' },
            { value: 'narrative', label: '자연스러운 서술형', description: '문단 중심 서술' },
            { value: 'bullets', label: '요약된 불릿', description: '핵심만 빠르게' }
        ]
    }
];

const DEFAULT_PROMPT_GALLERY = [
    {
        id: 'gallery_brand_voice',
        title: '브랜드 톤 가이던스',
        description: '신규 브랜드의 톤 & 메시지를 정의하는 구조화된 질문 세트',
        tags: ['브랜드', '전략', '톤'],
        prompt: `You are a senior brand strategist helping a marketing team define a new brand voice.
Ask for: core audience, emotional keywords, forbidden phrases, sample copy. Output a short style guide that includes:
- Elevator pitch (two sentences)
- Voice principles (3 bullet points)
- Sample paragraph written in the new tone.
Never invent facts—only use the details provided.`
    },
    {
        id: 'gallery_code_review',
        title: '코드 리뷰 코파일럿',
        description: 'Pull Request 설명문을 더 구조화된 리뷰로 변환',
        tags: ['개발', '리뷰'],
        prompt: `You are a staff-level engineer conducting a structured pull-request review.
Given: PR description + diff summary.
Respond with sections:
1. Summary (2 bullet points)
2. Strengths (max 3 bullets)
3. Risks / Questions (max 3 bullets)
4. Action items (if any)
Keep tone concise and constructive.`
    },
    {
        id: 'gallery_research_brief',
        title: '리서치 브리프 생성기',
        description: '사용자 인터뷰 메모를 인사이트와 액션으로 정리',
        tags: ['리서치', '요약'],
        prompt: `You are a UX researcher.
Input: raw interview notes.
Output:
- Key insights (3 bullets)
- Evidence quotes mapped to each insight
- Recommended experiments or product changes
Use markdown tables when presenting quotes.`
    }
];

let currentSettingsSection = 'general';
let chatContextTargetId = null;

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
    ,
    {
        name: 'remember_memory',
        description: '사용자와의 대화에서 얻은 중요 정보를 저장합니다.',
        parameters: {
            type: 'object',
            properties: {
                note: {
                    type: 'string',
                    description: '기억해야 할 간단한 문장'
                },
                tags: {
                    type: 'array',
                    description: '메모리를 분류할 태그 목록',
                    items: { type: 'string' }
                }
            },
            required: ['note']
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

    static saveUserProfile(userId, profile) {
        if (!userId) return;
        this.save(`promptcraft_profile_${userId}`, profile);
    }

    static loadUserProfile(userId) {
        if (!userId) return null;
        return this.load(`promptcraft_profile_${userId}`);
    }

    static clearUserProfile(userId) {
        if (!userId) return;
        this.remove(`promptcraft_profile_${userId}`);
    }

    static saveMemories(userId, memories) {
        if (!userId) return;
        this.save(`promptcraft_memories_${userId}`, memories);
    }

    static loadMemories(userId) {
        if (!userId) return [];
        return this.load(`promptcraft_memories_${userId}`) || [];
    }

    static saveProjects(userId, projects) {
        if (!userId) return;
        this.save(`promptcraft_projects_${userId}`, projects);
    }

    static loadProjects(userId) {
        if (!userId) return {};
        return this.load(`promptcraft_projects_${userId}`) || {};
    }

    static savePromptLibrary(userId, prompts) {
        if (!userId) return;
        this.save(`promptcraft_prompt_library_${userId}`, prompts);
    }

    static loadPromptLibrary(userId) {
        if (!userId) return [];
        return this.load(`promptcraft_prompt_library_${userId}`) || [];
    }

    static savePromptGallery(entries) {
        this.save('promptcraft_prompt_gallery', entries);
    }

    static loadPromptGallery() {
        return this.load('promptcraft_prompt_gallery');
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
    projectMenuToggle: document.getElementById('project-menu-toggle'),
    projectMenu: document.getElementById('project-menu'),
    projectMenuCreate: document.getElementById('project-menu-create'),
    projectMenuManage: document.getElementById('project-menu-manage'),
    projectSidebar: document.getElementById('project-sidebar'),
    settingsBtn: document.getElementById('settings-btn'),

    toggleSidebarBtn: document.getElementById('toggle-sidebar'),
    
    // 채팅
    messagesContainer: document.getElementById('messages-container'),
    welcomeScreen: document.getElementById('welcome-screen'),
    projectView: document.getElementById('project-view'),
    chatForm: document.getElementById('chat-form'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    aiServiceSelect: document.getElementById('ai-service'),
    
    // 모달
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    openaiApiKeyInput: document.getElementById('openai-api-key'),
    saveSettingsBtn: document.getElementById('save-settings'),
    settingsLogoutBtn: document.getElementById('settings-logout-btn'),
    accountEmailLabel: document.getElementById('account-email'),
    upgradeBtn: document.getElementById('upgrade-btn'),
    pricingModal: document.getElementById('pricing-modal'),
    closePricing: document.getElementById('close-pricing'),
    settingsNav: document.getElementById('settings-nav'),
    memoryForm: document.getElementById('memory-form'),
    memoryInput: document.getElementById('memory-text'),
    memoryList: document.getElementById('memory-list'),

    // 프로젝트
    projectsModal: document.getElementById('projects-modal'),
    closeProjects: document.getElementById('close-projects'),
    projectForm: document.getElementById('project-form'),
    projectNameInput: document.getElementById('project-name'),
    projectDescInput: document.getElementById('project-description'),
    projectFileInput: document.getElementById('project-files'),
    projectList: document.getElementById('project-list'),

    // 라이브러리 & 갤러리
    libraryBtn: document.getElementById('library-btn'),
    libraryModal: document.getElementById('library-modal'),
    closeLibrary: document.getElementById('close-library'),
    libraryList: document.getElementById('library-list'),
    galleryBtn: document.getElementById('gallery-btn'),
    galleryModal: document.getElementById('gallery-modal'),
    closeGallery: document.getElementById('close-gallery'),
    galleryList: document.getElementById('gallery-list'),
    
    // 컨텍스트 메뉴
    chatContextMenu: document.getElementById('chat-context-menu'),

    // 온보딩
    onboardingModal: document.getElementById('onboarding-modal'),
    onboardingQuestions: document.getElementById('onboarding-questions'),
    submitOnboardingBtn: document.getElementById('submit-onboarding'),
    closeOnboardingBtn: document.getElementById('close-onboarding'),
    editProfileBtn: document.getElementById('edit-profile-btn')
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
    APP_STATE.userProfile = StorageManager.loadUserProfile(APP_STATE.currentUser.email);
    APP_STATE.memories = StorageManager.loadMemories(APP_STATE.currentUser.email);
    APP_STATE.projects = StorageManager.loadProjects(APP_STATE.currentUser.email);
    APP_STATE.promptLibrary = StorageManager.loadPromptLibrary(APP_STATE.currentUser.email);
    APP_STATE.promptGallery = StorageManager.loadPromptGallery() || DEFAULT_PROMPT_GALLERY;
    normalizeProjects();

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
    renderProjectSidebar();

    const chatIds = Object.keys(APP_STATE.chats);
    if (chatIds.length > 0) {
        loadChat(chatIds[chatIds.length - 1]);
    } else {
        createNewChat();
    }

    completeAppLoading();
    updateAccountInfo();
    maybeShowOnboardingModal();
}

// 이벤트 리스너 등록
function registerEventListeners() {
    // 사이드바
    if (elements.newChatBtn) {
        elements.newChatBtn.addEventListener('click', () => {
            closeProjectMenu();
            createNewChat();
        });
    }
    if (elements.projectMenuToggle) {
        elements.projectMenuToggle.addEventListener('click', toggleProjectMenu);
    }
    if (elements.projectMenuCreate) {
        elements.projectMenuCreate.addEventListener('click', () => {
            closeProjectMenu();
            renderProjectList();
            if (elements.projectsModal) {
                openModal(elements.projectsModal);
            }
            if (elements.projectNameInput) {
                elements.projectNameInput.focus();
            }
        });
    }
    if (elements.projectMenuManage) {
        elements.projectMenuManage.addEventListener('click', () => {
            closeProjectMenu();
            renderProjectList();
            if (elements.projectsModal) {
                openModal(elements.projectsModal);
            }
        });
    }
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => openSettingsModal('general'));
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
    if (elements.settingsLogoutBtn) {
        elements.settingsLogoutBtn.addEventListener('click', handleLogout);
    }

    if (elements.submitOnboardingBtn) {
        elements.submitOnboardingBtn.addEventListener('click', handleOnboardingSubmit);
    }
    if (elements.closeOnboardingBtn) {
        elements.closeOnboardingBtn.addEventListener('click', () => closeOnboardingModal());
    }
    if (elements.onboardingModal) {
        elements.onboardingModal.addEventListener('click', (event) => {
            if (event.target === elements.onboardingModal) {
                closeOnboardingModal();
            }
        });
    }
    if (elements.editProfileBtn) {
        elements.editProfileBtn.addEventListener('click', () => openOnboardingModal());
    }

    if (elements.closeProjects && elements.projectsModal) {
        elements.closeProjects.addEventListener('click', () => closeModal(elements.projectsModal));
    }
    if (elements.projectForm) {
        elements.projectForm.addEventListener('submit', handleProjectCreate);
    }

    if (elements.libraryBtn && elements.libraryModal) {
        elements.libraryBtn.addEventListener('click', () => {
            renderPromptLibrary();
            openModal(elements.libraryModal);
        });
    }
    if (elements.closeLibrary && elements.libraryModal) {
        elements.closeLibrary.addEventListener('click', () => closeModal(elements.libraryModal));
    }

    if (elements.galleryBtn && elements.galleryModal) {
        elements.galleryBtn.addEventListener('click', () => {
            renderPromptGallery();
            openModal(elements.galleryModal);
        });
    }
    if (elements.closeGallery && elements.galleryModal) {
        elements.closeGallery.addEventListener('click', () => closeModal(elements.galleryModal));
    }

    if (elements.memoryForm) {
        elements.memoryForm.addEventListener('submit', handleMemorySubmit);
    }

    if (elements.settingsNav) {
        elements.settingsNav.querySelectorAll('[data-settings-target]').forEach(tab => {
            tab.addEventListener('click', () => setSettingsSection(tab.dataset.settingsTarget));
        });
    }

    if (elements.chatContextMenu) {
        elements.chatContextMenu.querySelectorAll('[data-chat-menu]').forEach(btn => {
            btn.addEventListener('click', handleChatContextAction);
        });
    }

    document.addEventListener('click', (event) => {
        if (elements.projectMenu && elements.projectMenuToggle) {
            if (!elements.projectMenu.contains(event.target) && !elements.projectMenuToggle.contains(event.target)) {
                closeProjectMenu();
            }
        }
        if (elements.chatContextMenu && !elements.chatContextMenu.classList.contains('hidden')) {
            if (!elements.chatContextMenu.contains(event.target)) {
                closeChatContextMenu();
            }
        }
    });
    window.addEventListener('scroll', closeChatContextMenu, true);
    window.addEventListener('resize', closeChatContextMenu);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeChatContextMenu();
            closeProjectMenu();
        }
    });

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

function openSettingsModal(section = 'general') {
    if (!elements.settingsModal) return;
    setSettingsSection(section);
    if (section === 'memory') {
        renderMemoryList();
    }
    openModal(elements.settingsModal);
}

function setSettingsSection(section) {
    currentSettingsSection = section;
    if (elements.settingsNav) {
        elements.settingsNav.querySelectorAll('[data-settings-target]').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.settingsTarget === section);
        });
    }
    document.querySelectorAll('[data-settings-panel]').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.settingsPanel === section);
    });
    if (section === 'memory') {
        renderMemoryList();
    }
    if (section === 'account') {
        updateAccountInfo();
    }
}

function updateAccountInfo() {
    if (!elements.accountEmailLabel) return;
    const email = APP_STATE.currentUser?.email || '알 수 없음';
    elements.accountEmailLabel.textContent = `로그인된 이메일: ${email}`;
}

function maybeShowOnboardingModal(force = false) {
    if (!elements.onboardingModal) return;
    const hasProfile = APP_STATE.userProfile && Object.keys(APP_STATE.userProfile.selections || {}).length === ONBOARDING_QUESTIONS.length;
    if (force || !hasProfile) {
        openOnboardingModal();
    }
}

function openOnboardingModal() {
    if (!elements.onboardingModal) return;
    renderOnboardingQuestions();
    elements.onboardingModal.classList.add('active');
}

function closeOnboardingModal() {
    if (!elements.onboardingModal) return;
    elements.onboardingModal.classList.remove('active');
}

function renderOnboardingQuestions() {
    const container = elements.onboardingQuestions;
    if (!container) return;
    
    const selections = APP_STATE.userProfile?.selections || {};
    container.innerHTML = '';
    
    ONBOARDING_QUESTIONS.forEach(question => {
        const section = document.createElement('div');
        section.className = 'onboarding-question';
        
        const title = document.createElement('h3');
        title.textContent = question.title;
        section.appendChild(title);
        
        const optionWrap = document.createElement('div');
        optionWrap.className = 'onboarding-options';
        
        question.options.forEach(option => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'onboarding-option';
            button.dataset.questionId = question.id;
            button.dataset.value = option.value;
            button.innerHTML = `
                <span class="onboarding-option-title">${option.label}</span>
                <span class="onboarding-option-desc">${option.description || ''}</span>
            `;
            if (selections[question.id]?.value === option.value) {
                button.classList.add('active');
            }
            button.addEventListener('click', () => setOnboardingSelection(question.id, option.value));
            optionWrap.appendChild(button);
        });
        
        section.appendChild(optionWrap);
        container.appendChild(section);
    });
}

function toggleProjectMenu() {
    if (!elements.projectMenu) return;
    elements.projectMenu.classList.toggle('hidden');
}

function closeProjectMenu() {
    if (!elements.projectMenu) return;
    elements.projectMenu.classList.add('hidden');
}

function openChatContextMenu(event, chatId) {
    if (!elements.chatContextMenu) return;
    event.preventDefault();
    chatContextTargetId = chatId;
    const menu = elements.chatContextMenu;
    menu.classList.remove('hidden');
    
    const menuWidth = menu.offsetWidth || 180;
    const menuHeight = menu.offsetHeight || 90;
    let left = event.clientX + window.scrollX;
    let top = event.clientY + window.scrollY;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - menuWidth - 8;
    const maxTop = window.scrollY + document.documentElement.clientHeight - menuHeight - 8;
    left = Math.min(left, maxLeft);
    top = Math.min(top, maxTop);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

function closeChatContextMenu() {
    if (!elements.chatContextMenu) return;
    elements.chatContextMenu.classList.add('hidden');
    chatContextTargetId = null;
}

function handleChatContextAction(event) {
    const action = event.currentTarget.dataset.chatMenu;
    if (!chatContextTargetId) {
        closeChatContextMenu();
        return;
    }
    
    if (action === 'rename') {
        renameChat(chatContextTargetId);
    } else if (action === 'delete') {
        deleteChat(chatContextTargetId);
    }
    closeChatContextMenu();
}

function setOnboardingSelection(questionId, value) {
    if (!elements.onboardingQuestions) return;
    const options = elements.onboardingQuestions.querySelectorAll(`.onboarding-option[data-question-id="${questionId}"]`);
    options.forEach(option => {
        option.classList.toggle('active', option.dataset.value === value);
    });
}

function collectOnboardingAnswers() {
    if (!elements.onboardingQuestions) return null;
    const answers = {};
    
    ONBOARDING_QUESTIONS.forEach(question => {
        const active = elements.onboardingQuestions.querySelector(`.onboarding-option[data-question-id="${question.id}"].active`);
        if (active) {
            const selectedValue = active.dataset.value;
            const optionMeta = question.options.find(opt => opt.value === selectedValue);
            answers[question.id] = {
                value: optionMeta?.value || selectedValue,
                label: optionMeta?.label || selectedValue,
                description: optionMeta?.description || ''
            };
        }
    });
    
    return answers;
}

function handleOnboardingSubmit() {
    const answers = collectOnboardingAnswers();
    if (!answers) return;
    
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < ONBOARDING_QUESTIONS.length) {
        alert('모든 질문에 대한 선호를 선택해주세요.');
        return;
    }
    
    const profile = {
        selections: answers,
        updatedAt: Date.now()
    };
    
    APP_STATE.userProfile = profile;
    if (APP_STATE.currentUser?.email) {
        StorageManager.saveUserProfile(APP_STATE.currentUser.email, profile);
    }
    
    closeOnboardingModal();
}

function normalizeProjects() {
    Object.keys(APP_STATE.projects || {}).forEach(projectId => {
        const project = APP_STATE.projects[projectId];
        if (!project) return;
        project.chatIds = Array.isArray(project.chatIds) ? project.chatIds : [];
        project.assets = Array.isArray(project.assets) ? project.assets : [];
    });
}

// 프로젝트 관리
function handleProjectCreate(e) {
    e.preventDefault();
    
    const name = elements.projectNameInput.value.trim();
    const description = elements.projectDescInput.value.trim();
    if (!name) {
        alert('프로젝트 이름을 입력해주세요.');
        return;
    }
    
    const projectId = `project_${Date.now()}`;
    const assetFiles = elements.projectFileInput.files ? Array.from(elements.projectFileInput.files) : [];
    
    APP_STATE.projects[projectId] = {
        id: projectId,
        name,
        description,
        chatIds: [],
        assets: assetFiles.map(file => ({
            id: `${projectId}_asset_${file.lastModified}`,
            name: file.name,
            size: file.size,
            type: file.type,
            uploadedAt: Date.now()
        }))
    };
    
    persistProjects();
    renderProjectList();
    renderProjectSidebar();
    e.target.reset();
}

function renderProjectList() {
    if (!elements.projectList) return;
    const projectEntries = Object.values(APP_STATE.projects);
    
    if (projectEntries.length === 0) {
        elements.projectList.innerHTML = '<p class="help-text">아직 생성된 프로젝트가 없습니다.</p>';
        return;
    }
    
    elements.projectList.innerHTML = '';
    
    projectEntries.forEach(project => {
        project.assets = project.assets || [];
        project.chatIds = project.chatIds || [];
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <div class="project-card-header">
                <div>
                    <h4>${escapeHtml(project.name)}</h4>
                    <p class="project-meta">${escapeHtml(project.description || '설명이 없습니다.')}</p>
                </div>
                <span class="project-meta">${project.chatIds.length}개의 채팅</span>
            </div>
            <div class="project-actions">
                <button class="btn-secondary" data-project-action="assign" data-project-id="${project.id}">현재 채팅 연결</button>
                <label class="btn-secondary upload-label">
                    자료 업로드
                    <input type="file" data-project-upload="${project.id}" multiple hidden>
                </label>
            </div>
            <div class="project-asset-list">
                <strong>자료 (${project.assets.length})</strong>
                <ul>
                    ${project.assets.length > 0 ? project.assets.map(asset => `<li>${escapeHtml(asset.name)} (${formatFileSize(asset.size)})</li>`).join('') : '<li>등록된 자료가 없습니다.</li>'}
                </ul>
            </div>
        `;
        
        card.querySelector('[data-project-action="assign"]').addEventListener('click', () => assignCurrentChatToProject(project.id));
        card.querySelector('[data-project-upload]').addEventListener('change', (event) => handleProjectAssetUpload(project.id, event.target));
        
        elements.projectList.appendChild(card);
    });
}

function handleProjectAssetUpload(projectId, inputEl) {
    const project = APP_STATE.projects[projectId];
    if (!project || !inputEl || !inputEl.files || inputEl.files.length === 0) return;
    
    const files = Array.from(inputEl.files);
    files.forEach(file => {
        project.assets.push({
            id: `${projectId}_asset_${file.lastModified}_${file.name}`,
            name: file.name,
            size: file.size,
            type: file.type,
            uploadedAt: Date.now()
        });
    });
    
    persistProjects();
    renderProjectList();
    inputEl.value = '';
    renderProjectSidebar();
}

function assignCurrentChatToProject(projectId) {
    if (!APP_STATE.currentChatId) {
        alert('먼저 채팅을 선택하거나 생성해주세요.');
        return;
    }
    const project = APP_STATE.projects[projectId];
    if (!project) return;
    
    if (!project.chatIds.includes(APP_STATE.currentChatId)) {
        attachChatToProject(APP_STATE.currentChatId, projectId);
        renderProjectSidebar();
        renderProjectList();
        alert('현재 채팅이 프로젝트에 연결되었습니다.');
    } else {
        alert('이 채팅은 이미 해당 프로젝트에 연결되어 있습니다.');
    }
}

function persistProjects() {
    if (APP_STATE.currentUser?.email) {
        normalizeProjects();
        StorageManager.saveProjects(APP_STATE.currentUser.email, APP_STATE.projects);
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function renderProjectSidebar() {
    if (!elements.projectSidebar) return;
    const projectList = Object.values(APP_STATE.projects || {});
    if (projectList.length === 0) {
        APP_STATE.currentProjectId = null;
        if (elements.projectView) {
            elements.projectView.classList.add('hidden');
            elements.projectView.classList.remove('active');
            elements.projectView.innerHTML = '';
        }
        elements.projectSidebar.innerHTML = '<p class="project-sidebar-empty">프로젝트를 만들어보세요.</p>';
        return;
    }
    
    if (APP_STATE.currentProjectId && !APP_STATE.projects[APP_STATE.currentProjectId]) {
        APP_STATE.currentProjectId = null;
    }
    
    const itemsHtml = projectList.map(project => `
        <div class="project-item ${project.id === APP_STATE.currentProjectId ? 'active' : ''}" data-project-id="${project.id}">
            ${escapeHtml(project.name)}
        </div>
    `).join('');
    
    elements.projectSidebar.innerHTML = `
        <p class="project-sidebar-title">프로젝트</p>
        <div class="project-sidebar-items">${itemsHtml}</div>
    `;
    
    elements.projectSidebar.querySelectorAll('.project-item').forEach(item => {
        const projectId = item.dataset.projectId;
        item.addEventListener('click', () => {
            if (projectId === APP_STATE.currentProjectId) {
                closeProjectView();
            } else {
                openProjectView(projectId);
            }
        });
        item.addEventListener('contextmenu', (event) => handleProjectContextMenu(event, projectId));
    });
}

function handleProjectContextMenu(event, projectId) {
    event.preventDefault();
    const project = APP_STATE.projects[projectId];
    if (!project) return;
    
    const newName = prompt('프로젝트 이름을 수정하세요', project.name);
    if (newName === null) return;
    const trimmedName = newName.trim();
    if (trimmedName) {
        project.name = trimmedName;
    }
    const newDesc = prompt('프로젝트 설명을 수정하세요', project.description || '');
    if (newDesc !== null) {
        project.description = newDesc.trim();
    }
    
    persistProjects();
    renderProjectSidebar();
    renderProjectList();
    if (APP_STATE.currentProjectId === projectId) {
        renderProjectView();
    }
}

function openProjectView(projectId) {
    if (!projectId || !APP_STATE.projects[projectId]) return;
    APP_STATE.currentProjectId = projectId;
    clearMessages();
    hideWelcomeScreen();
    renderProjectSidebar();
    renderProjectView();
}

function closeProjectView() {
    APP_STATE.currentProjectId = null;
    if (elements.projectView) {
        elements.projectView.classList.add('hidden');
        elements.projectView.classList.remove('active');
        elements.projectView.innerHTML = '';
    }
    renderProjectSidebar();
    if (!APP_STATE.currentChatId) {
        showWelcomeScreen();
    }
}

function renderProjectView() {
    const container = elements.projectView;
    const projectId = APP_STATE.currentProjectId;
    if (!container || !projectId || !APP_STATE.projects[projectId]) {
        if (container) {
            container.classList.add('hidden');
            container.classList.remove('active');
            container.innerHTML = '';
        }
        return;
    }
    
    const project = APP_STATE.projects[projectId];
    const chats = (project.chatIds || [])
        .map(chatId => APP_STATE.chats[chatId])
        .filter(Boolean)
        .sort((a, b) => b.createdAt - a.createdAt);
    
    const chatListHtml = chats.length > 0
        ? chats.map(chat => `
            <div class="project-chat-item" data-chat-id="${chat.id}">
                <h4>${escapeHtml(chat.title || '제목 없음')}</h4>
                <div class="project-chat-meta">${new Date(chat.createdAt).toLocaleString()} · ${chat.messages.length}개의 메시지</div>
            </div>
        `).join('')
        : '<p class="help-text">아직 이 프로젝트에 속한 대화가 없습니다.</p>';
    
    container.innerHTML = `
        <div class="project-view-header">
            <div>
                <h3>${escapeHtml(project.name)}</h3>
                <p class="project-meta">${escapeHtml(project.description || '설명이 없습니다.')}</p>
            </div>
            <div class="project-actions">
                <button class="btn-secondary" id="project-manage-btn">프로젝트 관리</button>
                <button class="btn-primary" id="project-new-chat">새 대화 만들기</button>
            </div>
        </div>
        <div class="project-chats-list">
            ${chatListHtml}
        </div>
    `;
    
    container.classList.remove('hidden');
    container.classList.add('active');
    
    const manageBtn = document.getElementById('project-manage-btn');
    if (manageBtn) {
        manageBtn.addEventListener('click', () => {
            renderProjectList();
            openModal(elements.projectsModal);
        });
    }
    
    const newChatBtn = document.getElementById('project-new-chat');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => createNewChat(projectId));
    }
    
    container.querySelectorAll('[data-chat-id]').forEach(item => {
        item.addEventListener('click', () => {
            loadChat(item.dataset.chatId);
        });
    });
}

function attachChatToProject(chatId, projectId) {
    if (!projectId || !APP_STATE.projects[projectId]) return;
    const project = APP_STATE.projects[projectId];
    project.chatIds = Array.isArray(project.chatIds) ? project.chatIds : [];
    if (!project.chatIds.includes(chatId)) {
        project.chatIds.push(chatId);
    }
    APP_STATE.chats[chatId].projectId = projectId;
    persistProjects();
    StorageManager.saveChats(APP_STATE.chats);
    renderProjectSidebar();
    renderProjectList();
    if (APP_STATE.currentProjectId === projectId) {
        renderProjectView();
    }
}

// 라이브러리
function addPromptToLibraryEntry(promptText, summary, service) {
    const entry = {
        id: `prompt_${Date.now()}`,
        prompt: promptText,
        summary,
        service,
        savedAt: Date.now()
    };
    
    APP_STATE.promptLibrary.unshift(entry);
    if (APP_STATE.currentUser?.email) {
        StorageManager.savePromptLibrary(APP_STATE.currentUser.email, APP_STATE.promptLibrary);
    }
}

function renderPromptLibrary() {
    if (!elements.libraryList) return;
    
    if (APP_STATE.promptLibrary.length === 0) {
        elements.libraryList.innerHTML = '<p class="help-text">저장된 프롬프트가 없습니다.</p>';
        return;
    }
    
    elements.libraryList.innerHTML = '';
    
    APP_STATE.promptLibrary.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'library-card';
        card.innerHTML = `
            <h4>${escapeHtml(entry.summary || '요약 없음')}</h4>
            <p class="library-meta">${entry.service?.toUpperCase() || '서비스 미지정'} · ${new Date(entry.savedAt).toLocaleString()}</p>
            <pre class="library-prompt">${escapeHtml(entry.prompt)}</pre>
            <div class="library-actions">
                <button class="btn-secondary" data-copy="${entry.id}">복사</button>
                <button class="btn-secondary" data-edit="${entry.id}">수정 요청</button>
            </div>
        `;
        card.querySelector('[data-copy]').addEventListener('click', () => {
            navigator.clipboard.writeText(entry.prompt);
            alert('프롬프트가 클립보드에 복사되었습니다.');
        });
        card.querySelector('[data-edit]').addEventListener('click', () => startLibraryEdit(entry));
        elements.libraryList.appendChild(card);
    });
}

function startLibraryEdit(entry) {
    if (!elements.messageInput) return;
    const prompt = entry.prompt || '';
    elements.messageInput.value = `이 프롬프트를 개선해줘:\n${prompt}\n\n요청 사항: `;
    elements.messageInput.focus();
    autoResizeTextarea({ target: elements.messageInput });
    if (elements.libraryModal) {
        closeModal(elements.libraryModal);
    }
}

// 탐색
function renderPromptGallery() {
    if (!elements.galleryList) return;
    
    const entries = APP_STATE.promptGallery || [];
    if (entries.length === 0) {
        elements.galleryList.innerHTML = '<p class="help-text">탐색할 프롬프트가 없습니다.</p>';
        return;
    }
    
    elements.galleryList.innerHTML = '';
    
    entries.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        card.innerHTML = `
            <h4>${escapeHtml(entry.title)}</h4>
            <p>${escapeHtml(entry.description)}</p>
            <pre class="library-prompt">${escapeHtml(entry.prompt)}</pre>
            <div class="gallery-tags">
                ${entry.tags.map(tag => `<span class="gallery-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        `;
        elements.galleryList.appendChild(card);
    });
}

function renameChat(chatId) {
    const chat = APP_STATE.chats[chatId];
    if (!chat) return;
    const newTitle = prompt('채팅 이름을 입력하세요', chat.title || '');
    if (newTitle === null) return;
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    chat.title = trimmed;
    StorageManager.saveChats(APP_STATE.chats);
    renderChatHistory();
    if (APP_STATE.currentProjectId) {
        renderProjectView();
    }
}

function deleteChat(chatId) {
    const chat = APP_STATE.chats[chatId];
    if (!chat) return;
    if (!confirm('채팅을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    
    const projectId = chat.projectId;
    delete APP_STATE.chats[chatId];
    StorageManager.saveChats(APP_STATE.chats);
    
    if (projectId && APP_STATE.projects[projectId]) {
        APP_STATE.projects[projectId].chatIds = (APP_STATE.projects[projectId].chatIds || []).filter(id => id !== chatId);
        persistProjects();
    }
    
    if (APP_STATE.currentChatId === chatId) {
        APP_STATE.currentChatId = null;
        APP_STATE.conversationHistory = [];
        clearMessages();
        if (APP_STATE.currentProjectId) {
            renderProjectView();
        } else {
            showWelcomeScreen();
        }
    }
    
    renderChatHistory();
    renderProjectSidebar();
    renderProjectList();
    if (APP_STATE.currentProjectId) {
        renderProjectView();
    }
}

// 메모리
function handleMemorySubmit(e) {
    e.preventDefault();
    const text = elements.memoryInput.value.trim();
    if (!text) return;
    
    addMemoryEntry({
        text,
        source: 'manual',
        tags: ['manual']
    });
    
    elements.memoryInput.value = '';
    renderMemoryList();
}

function addMemoryEntry({ text, source = 'manual', tags = [] }) {
    const entry = {
        id: `memory_${Date.now()}`,
        text,
        source,
        tags,
        createdAt: Date.now()
    };
    
    APP_STATE.memories.unshift(entry);
    
    if (APP_STATE.currentUser?.email) {
        StorageManager.saveMemories(APP_STATE.currentUser.email, APP_STATE.memories);
    }
}

function deleteMemoryEntry(memoryId) {
    APP_STATE.memories = APP_STATE.memories.filter(memory => memory.id !== memoryId);
    if (APP_STATE.currentUser?.email) {
        StorageManager.saveMemories(APP_STATE.currentUser.email, APP_STATE.memories);
    }
    renderMemoryList();
}

function renderMemoryList() {
    if (!elements.memoryList) return;
    
    if (APP_STATE.memories.length === 0) {
        elements.memoryList.innerHTML = '<p class="help-text">저장된 메모리가 없습니다.</p>';
        return;
    }
    
    elements.memoryList.innerHTML = '';
    APP_STATE.memories.forEach(memory => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.innerHTML = `
            <p>${escapeHtml(memory.text)}</p>
            <div class="memory-meta">${new Date(memory.createdAt).toLocaleString()} · ${memory.source === 'conversation' ? '대화 기반' : memory.source === 'assistant' ? 'AI 자동' : '직접 추가'}</div>
            <div class="memory-actions">
                <button class="memory-delete-btn" data-memory-id="${memory.id}">삭제</button>
            </div>
        `;
        elements.memoryList.appendChild(card);
    });
    
    elements.memoryList.querySelectorAll('[data-memory-id]').forEach(btn => {
        btn.addEventListener('click', () => deleteMemoryEntry(btn.dataset.memoryId));
    });
}

function maybeStoreMemoryFromMessage(message) {
    const normalized = message.toLowerCase();
    const keywords = ['기억', '메모', 'remember', '기억해', '기억해줘', '기억해줘', 'memo'];
    if (keywords.some(keyword => normalized.includes(keyword))) {
        addMemoryEntry({
            text: message,
            source: 'conversation',
            tags: ['auto']
        });
        if (currentSettingsSection === 'memory' && elements.settingsModal?.classList.contains('active')) {
            renderMemoryList();
        }
    }
}

async function handleRememberMemory(args) {
    const note = (args.note || '').trim();
    if (!note) {
        return {
            success: false,
            message: '메모리에 저장할 문장이 없습니다.'
        };
    }
    
    const tags = Array.isArray(args.tags) ? args.tags : ['assistant'];
    addMemoryEntry({
        text: note,
        source: 'assistant',
        tags
    });
    renderMemoryList();
    
    return {
        success: true,
        message: '메모리가 저장되었습니다.'
    };
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
    APP_STATE.currentProjectId = null;
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
function createNewChat(projectId = null) {
    const chatId = 'chat_' + Date.now();
    
    APP_STATE.currentChatId = chatId;
    APP_STATE.chats[chatId] = {
        id: chatId,
        title: '새 대화',
        messages: [],
        createdAt: Date.now(),
        selectedService: 'chatgpt',
        projectId: projectId || null
    };
    
    APP_STATE.conversationHistory = [];
    
    StorageManager.saveChats(APP_STATE.chats);
    
    if (projectId && APP_STATE.projects[projectId]) {
        attachChatToProject(chatId, projectId);
    }
    
    renderChatHistory();
    renderProjectSidebar();
    clearMessages();
    if (projectId && APP_STATE.projects[projectId]) {
        loadChat(chatId);
        return;
    } else {
        showWelcomeScreen();
    }
    
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
    
    if (APP_STATE.currentProjectId) {
        closeProjectView();
    }
    
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
    closeChatContextMenu();
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
        const project = chat.projectId ? APP_STATE.projects[chat.projectId] : null;
        item.innerHTML = `
            <div class="chat-title-wrapper">
                <span class="chat-title">${escapeHtml(chat.title)}</span>
                ${project ? `<span class="chat-project-tag">${escapeHtml(project.name)}</span>` : ''}
            </div>
        `;
        item.addEventListener('click', () => loadChat(chatId));
        item.addEventListener('contextmenu', (event) => openChatContextMenu(event, chatId));
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
    maybeStoreMemoryFromMessage(userMessage);
    
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
    const profileContext = buildUserProfileContext();
    const memoryContext = buildMemoryContext();
    const payloadMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(profileContext ? [{ role: 'system', content: profileContext }] : []),
        ...(memoryContext ? [{ role: 'system', content: memoryContext }] : []),
        ...messages
    ];
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APP_STATE.apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4-turbo-preview',
            messages: payloadMessages,
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

function buildUserProfileContext() {
    const profile = APP_STATE.userProfile;
    if (!profile || !profile.selections) return '';
    
    const summaries = ONBOARDING_QUESTIONS
        .map(question => {
            const selection = profile.selections[question.id];
            if (!selection) return null;
            return `${question.title}: ${selection.label}`;
        })
        .filter(Boolean);
    
    if (summaries.length === 0) return '';
    
    return `USER PREFERENCES:\n${summaries.map(line => `- ${line}`).join('\n')}\n항상 위 선호를 반영하여 프롬프트 설계와 응답 스타일을 조정하세요.`;
}

function buildMemoryContext() {
    if (!Array.isArray(APP_STATE.memories) || APP_STATE.memories.length === 0) {
        return '';
    }
    
    const recent = APP_STATE.memories.slice(0, 5);
    const lines = recent.map(memory => `- ${memory.text}`);
    return `CONVERSATION MEMORY:\n${lines.join('\n')}\n위 항목은 사용자가 이전에 강조한 정보입니다. 필요할 때 자연스럽게 참고하세요.`;
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
        case 'remember_memory':
            functionResult = await handleRememberMemory(functionArgs);
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
        addPromptToLibraryEntry(promptText, summary, service);
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
    const projectView = elements.projectView;
    elements.messagesContainer.innerHTML = '';
    if (welcome) {
        elements.messagesContainer.appendChild(welcome);
    }
    if (projectView) {
        elements.messagesContainer.appendChild(projectView);
    }
}

function showWelcomeScreen() {
    if (!elements.welcomeScreen) return;
    if (APP_STATE.currentProjectId) return;
    elements.welcomeScreen.style.display = 'flex';
}

function hideWelcomeScreen() {
    if (!elements.welcomeScreen) return;
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
