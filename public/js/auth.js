// إعداد عميل Supabase
const supabase = window.supabase.createClient(
    'https://qjsvgpvbtrcnbhcjdcci.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1penZteGdpeXJuZm5yeGpocXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMjQxOTgsImV4cCI6MjA2NjcwMDE5OH0.v3r0rry9mhVo3-n64yTG0M2rToHyn_IVY6RNgkdY-h4'
);

// حالة المصادقة العامة
let currentUser = null;

// دالة إرسال رابط السحر (Magic Link)
async function sendMagicLink(email) {
    try {
        showToast('جارٍ إرسال رابط التسجيل...', 'info');
        
        const { data, error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: `${window.location.origin}/verify.html`,
                shouldCreateUser: true
            }
        });

        if (error) {
            throw error;
        }

        showToast('تم إرسال رابط التسجيل إلى بريدك الإلكتروني', 'success');
        return { success: true, data };
    } catch (error) {
        console.error('خطأ في إرسال رابط التسجيل:', error);
        showToast(`خطأ في إرسال رابط التسجيل: ${error.message}`, 'error');
        return { success: false, error };
    }
}

// دالة إكمال تسجيل الدخول من الرابط
async function finishMagicLink() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (!code) {
            throw new Error('رمز التحقق غير موجود');
        }

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            throw error;
        }

        // التأكد من إنشاء ملف تعريف للمستخدم
        await ensureUserProfile(data.user);

        showToast('تم تسجيل الدخول بنجاح', 'success');
        
        // إعادة التوجيه إلى الصفحة الرئيسية
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);

        return { success: true, user: data.user };
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        showToast(`خطأ في تسجيل الدخول: ${error.message}`, 'error');
        return { success: false, error };
    }
}

// دالة التأكد من وجود ملف تعريف المستخدم
async function ensureUserProfile(user) {
    try {
        // البحث عن ملف التعريف الموجود
        const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError;
        }

        // إذا لم يوجد الملف التعريفي، أنشئه
        if (!existingProfile) {
            const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || '',
                    phone: user.user_metadata?.phone || '',
                    created_at: new Date().toISOString()
                });

            if (insertError) {
                throw insertError;
            }
        }

        return { success: true };
    } catch (error) {
        console.error('خطأ في إنشاء ملف التعريف:', error);
        return { success: false, error };
    }
}

// دالة الحصول على المستخدم الحالي
async function getUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            throw error;
        }

        currentUser = user;
        return user;
    } catch (error) {
        console.error('خطأ في الحصول على المستخدم:', error);
        currentUser = null;
        return null;
    }
}

// دالة التحقق من الجلسة المطلوبة
async function requireSession() {
    const user = await getUser();
    if (!user) {
        showAuthModal();
        return false;
    }
    return true;
}

// دالة تسجيل الخروج
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw error;
        }

        currentUser = null;
        updateAuthUI();
        showToast('تم تسجيل الخروج بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في تسجيل الخروج:', error);
        showToast(`خطأ في تسجيل الخروج: ${error.message}`, 'error');
    }
}

// دالة التحقق من كون المستخدم مدير
async function isAdmin(user) {
    try {
        if (!user) return false;

        const { data, error } = await supabase
            .from('admins')
            .select('email')
            .eq('email', user.email)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return !!data;
    } catch (error) {
        console.error('خطأ في التحقق من صلاحيات الإدارة:', error);
        return false;
    }
}

// دالة تحديث واجهة المصادقة
function updateAuthUI() {
    const authBtn = document.getElementById('auth-btn');
    const registrationSection = document.getElementById('registration-form');
    
    if (currentUser) {
        if (authBtn) {
            authBtn.textContent = 'تسجيل خروج';
            authBtn.onclick = signOut;
        }
        
        // إظهار نموذج التسجيل للمستخدمين المسجلين
        if (registrationSection) {
            registrationSection.style.display = 'block';
        }
    } else {
        if (authBtn) {
            authBtn.textContent = 'تسجيل دخول';
            authBtn.onclick = showAuthModal;
        }
        
        // إخفاء نموذج التسجيل
        if (registrationSection) {
            registrationSection.style.display = 'none';
        }
    }
}

// دالة إظهار مودال تسجيل الدخول
function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

// دالة إخفاء مودال تسجيل الدخول
function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// دالة عرض الإشعارات
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const title = {
        success: 'نجح',
        error: 'خطأ',
        warning: 'تحذير',
        info: 'معلومات'
    };

    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">${title[type]}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
        <div class="toast-body">${message}</div>
    `;

    container.appendChild(toast);

    // إزالة الإشعار تلقائياً
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, duration);
}

// دالة تبديل الوضع الداكن/الفاتح
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// تهيئة التطبيق عند التحميل
document.addEventListener('DOMContentLoaded', async () => {
    // تحميل الوضع المحفوظ
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // إعداد أزرار التبديل
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // إعداد مودال تسجيل الدخول
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const modalClose = authModal?.querySelector('.modal-close');

    if (modalClose) {
        modalClose.addEventListener('click', hideAuthModal);
    }

    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                hideAuthModal();
            }
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target.email.value;
            
            if (!email) {
                showToast('يرجى إدخال البريد الإلكتروني', 'error');
                return;
            }

            const result = await sendMagicLink(email);
            if (result.success) {
                hideAuthModal();
                authForm.reset();
            }
        });
    }

    // التحقق من الجلسة الحالية
    await getUser();
    updateAuthUI();

    // الاستماع لتغييرات حالة المصادقة
    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        updateAuthUI();

        if (event === 'SIGNED_IN') {
            ensureUserProfile(session.user);
        }
    });
});

// دالة التحقق من صحة البريد الإلكتروني
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// دالة التحقق من صحة رقم الهاتف المصري
function isValidEgyptianPhone(phone) {
    const phoneRegex = /^(\+20|0020|20)?1[0-2,5]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
}

// دالة التحقق من صحة الرقم القومي المصري
function isValidEgyptianNationalId(id) {
    const idRegex = /^[2-3]\d{13}$/;
    return idRegex.test(id);
}

// دالة تنسيق أرقام الهواتف المصرية
function formatEgyptianPhone(phone) {
    const cleaned = phone.replace(/\s+/g, '').replace(/^\+20|^0020|^20/, '');
    if (cleaned.length === 10 && cleaned.startsWith('1')) {
        return `+20${cleaned}`;
    }
    return phone;
}

// دالة التحقق من الاتصال بالإنترنت
function checkConnection() {
    return navigator.onLine;
}

// معالج أخطاء Supabase
function handleSupabaseError(error) {
    let message = 'حدث خطأ غير متوقع';
    
    switch (error.code) {
        case 'invalid_credentials':
            message = 'بيانات تسجيل الدخول غير صحيحة';
            break;
        case 'email_not_confirmed':
            message = 'يرجى تأكيد بريدك الإلكتروني أولاً';
            break;
        case 'too_many_requests':
            message = 'عدد كثير من المحاولات، يرجى المحاولة لاحقاً';
            break;
        case 'network_error':
            message = 'خطأ في الاتصال، تحقق من اتصال الإنترنت';
            break;
        default:
            message = error.message || message;
    }
    
    return message;
}

// تصدير الدوال للاستخدام العام
window.authUtils = {
    sendMagicLink,
    finishMagicLink,
    getUser,
    requireSession,
    signOut,
    isAdmin,
    showToast,
    isValidEmail,
    isValidEgyptianPhone,
    isValidEgyptianNationalId,
    formatEgyptianPhone,
    checkConnection,
    handleSupabaseError,
    supabase
};