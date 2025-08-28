// متغيرات عامة للتطبيق
let currentApplication = null;
let currentStep = 1;
let uploadedFiles = {};

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    setupEventListeners();
    setupFileUploads();
});

// دالة تهيئة النموذج
async function initializeForm() {
    // التحقق من تسجيل الدخول
    const user = await window.authUtils.getUser();
    if (user) {
        // إنشاء أو تحميل المسودة
        const result = await window.apiUtils.createOrLoadDraft();
        if (result.success) {
            currentApplication = result.data;
            loadFormData();
        } else {
            window.authUtils.showToast('خطأ في تحميل البيانات', 'error');
        }
    }
}

// دالة إعداد مستمعي الأحداث
function setupEventListeners() {
    const form = document.getElementById('merchant-form');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-btn');

    // أزرار التنقل
    if (nextBtn) {
        nextBtn.addEventListener('click', handleNext);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', handlePrevious);
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', handleSubmit);
    }

    // تغيير نوع النشاط
    const businessTypeInputs = document.querySelectorAll('input[name="business_type"]');
    businessTypeInputs.forEach(input => {
        input.addEventListener('change', handleBusinessTypeChange);
    });

    // تنسيق رقم الهاتف
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('blur', formatPhoneNumber);
    }

    // منع الإرسال الافتراضي للنموذج
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }
}

// دالة إعداد رفع الملفات
function setupFileUploads() {
    const uploadAreas = document.querySelectorAll('.file-upload-area');
    
    uploadAreas.forEach(area => {
        const targetId = area.getAttribute('data-target');
        const fileInput = document.getElementById(targetId);
        
        if (!fileInput) return;

        // النقر على المنطقة لفتح متصفح الملفات
        area.addEventListener('click', () => {
            fileInput.click();
        });

        // سحب وإفلات الملفات
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });

        area.addEventListener('dragleave', () => {
            area.classList.remove('dragover');
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelection(fileInput, files[0]);
            }
        });

        // تغيير الملف
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelection(fileInput, e.target.files[0]);
            }
        });
    });
}

// دالة التعامل مع اختيار الملفات
async function handleFileSelection(input, file) {
    const uploadArea = document.querySelector(`[data-target="${input.id}"]`);
    const fileInfo = uploadArea.parentElement.querySelector('.file-info');
    
    try {
        // التحقق من نوع وحجم الملف
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('نوع الملف غير مدعوم. يرجى استخدام PDF أو JPG أو PNG');
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            throw new Error('حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت');
        }

        // عرض معلومات الملف
        const fileSize = (file.size / 1024 / 1024).toFixed(2);
        fileInfo.innerHTML = `
            <div class="file-selected">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${fileSize} MB</span>
                <span class="file-status">محدد للرفع</span>
            </div>
        `;
        fileInfo.style.display = 'block';

        // تخزين الملف مؤقتاً
        uploadedFiles[input.name] = file;

    } catch (error) {
        window.authUtils.showToast(error.message, 'error');
        input.value = '';
        fileInfo.style.display = 'none';
    }
}

// دالة التعامل مع تغيير نوع النشاط
function handleBusinessTypeChange(e) {
    const selectedType = e.target.value;
    
    // إخفاء جميع الحقول الخاصة
    const specialtyFields = document.querySelectorAll('.specialty-fields');
    specialtyFields.forEach(field => {
        field.style.display = 'none';
    });

    // إظهار الحقول الخاصة بالنوع المحدد
    const targetFields = document.querySelector(`.${selectedType}-fields`);
    if (targetFields) {
        targetFields.style.display = 'block';
    }
}

// دالة تنسيق رقم الهاتف
function formatPhoneNumber(e) {
    const phone = e.target.value;
    if (phone && window.authUtils.isValidEgyptianPhone(phone)) {
        e.target.value = window.authUtils.formatEgyptianPhone(phone);
    }
}

// دالة التعامل مع الزر التالي
async function handleNext() {
    if (!await validateCurrentStep()) {
        return;
    }

    await saveCurrentStep();
    
    if (currentStep < 4) {
        currentStep++;
        updateFormStep();
        updateProgressBar();
    }
}

// دالة التعامل مع الزر السابق
function handlePrevious() {
    if (currentStep > 1) {
        currentStep--;
        updateFormStep();
        updateProgressBar();
    }
}

// دالة التعامل مع إرسال الطلب
async function handleSubmit() {
    if (!await validateCurrentStep()) {
        return;
    }

    // رفع الملفات أولاً
    const uploadSuccess = await uploadAllFiles();
    if (!uploadSuccess) {
        return;
    }

    // حفظ الخطوة الأخيرة
    await saveCurrentStep();

    // إرسال الطلب
    const result = await window.apiUtils.submitApplication(currentApplication.id);
    
    if (result.success) {
        window.authUtils.showToast('تم إرسال طلبك بنجاح', 'success');
        
        // إعادة التوجيه إلى صفحة النجاح
        setTimeout(() => {
            window.location.href = `/success.html?request=${result.requestNumber}`;
        }, 2000);
    } else {
        window.authUtils.showToast('خطأ في إرسال الطلب: ' + result.error.message, 'error');
    }
}

// دالة التحقق من الخطوة الحالية
async function validateCurrentStep() {
    const formData = getFormData();
    const errors = window.apiUtils.validateApplicationData(formData, currentStep);
    
    // عرض الأخطاء
    clearErrors();
    
    if (errors.length > 0) {
        errors.forEach(error => {
            window.authUtils.showToast(error, 'error');
        });
        return false;
    }

    // التحقق الخاص بكل خطوة
    switch (currentStep) {
        case 1:
            return validateStep1();
        case 2:
            return validateStep2();
        case 3:
            return validateStep3();
        case 4:
            return validateStep4();
        default:
            return true;
    }
}

// دوال التحقق لكل خطوة
function validateStep1() {
    const businessType = document.querySelector('input[name="business_type"]:checked');
    if (!businessType) {
        window.authUtils.showToast('يرجى اختيار نوع النشاط التجاري', 'error');
        return false;
    }
    return true;
}

function validateStep2() {
    const requiredFields = [
        'business_name', 'crn', 'tax_id', 'contact_name',
        'national_id', 'phone', 'governorate', 'city', 'address'
    ];
    
    for (const field of requiredFields) {
        const input = document.getElementById(field);
        if (!input || !input.value.trim()) {
            input?.focus();
            window.authUtils.showToast(`حقل ${window.apiUtils.getFieldLabel ? window.apiUtils.getFieldLabel(field) : field} مطلوب`, 'error');
            return false;
        }
    }

    // التحقق من صحة رقم الهاتف
    const phone = document.getElementById('phone').value;
    if (!window.authUtils.isValidEgyptianPhone(phone)) {
        document.getElementById('phone').focus();
        window.authUtils.showToast('رقم الهاتف غير صحيح', 'error');
        return false;
    }

    // التحقق من صحة الرقم القومي
    const nationalId = document.getElementById('national_id').value;
    if (!window.authUtils.isValidEgyptianNationalId(nationalId)) {
        document.getElementById('national_id').focus();
        window.authUtils.showToast('الرقم القومي غير صحيح', 'error');
        return false;
    }

    return true;
}

function validateStep3() {
    // التحقق من البيانات الخاصة (اختيارية)
    return true;
}

function validateStep4() {
    const requiredDocs = ['crn_document', 'tax_document', 'id_document'];
    
    for (const docName of requiredDocs) {
        if (!uploadedFiles[docName]) {
            const label = document.querySelector(`label[for="${docName}"]`).textContent;
            window.authUtils.showToast(`يرجى رفع ${label}`, 'error');
            return false;
        }
    }
    
    return true;
}

// دالة حفظ الخطوة الحالية
async function saveCurrentStep() {
    if (!currentApplication || !await window.authUtils.requireSession()) {
        return;
    }

    const formData = getFormData();
    const result = await window.apiUtils.saveStep(currentApplication.id, formData);
    
    if (!result.success) {
        console.error('خطأ في حفظ البيانات:', result.error);
    }
}

// دالة الحصول على بيانات النموذج
function getFormData() {
    const form = document.getElementById('merchant-form');
    const formData = new FormData(form);
    const data = {};
    
    // تحويل FormData إلى object
    for (const [key, value] of formData.entries()) {
        if (key !== 'business_type' || value) { // تجنب القيم الفارغة لنوع النشاط
            data[key] = value;
        }
    }
    
    // إضافة نوع النشاط إذا كان محدداً
    const businessType = document.querySelector('input[name="business_type"]:checked');
    if (businessType) {
        data.type = businessType.value;
    }
    
    return data;
}

// دالة تحديث خطوة النموذج
function updateFormStep() {
    // إخفاء جميع الخطوات
    const steps = document.querySelectorAll('.form-step');
    steps.forEach(step => {
        step.classList.remove('active');
    });
    
    // إظهار الخطوة الحالية
    const currentStepElement = document.querySelector(`[data-step="${currentStep}"]`);
    if (currentStepElement) {
        currentStepElement.classList.add('active');
    }
    
    // تحديث الأزرار
    updateNavigationButtons();
}

// دالة تحديث شريط التقدم
function updateProgressBar() {
    const progressSteps = document.querySelectorAll('.progress-step');
    
    progressSteps.forEach((step, index) => {
        const stepNumber = index + 1;
        
        if (stepNumber < currentStep) {
            step.classList.add('completed');
            step.classList.remove('active');
        } else if (stepNumber === currentStep) {
            step.classList.add('active');
            step.classList.remove('completed');
        } else {
            step.classList.remove('active', 'completed');
        }
    });
}

// دالة تحديث أزرار التنقل
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    // زر السابق
    if (prevBtn) {
        prevBtn.style.display = currentStep > 1 ? 'block' : 'none';
    }
    
    // زر التالي وزر الإرسال
    if (currentStep < 4) {
        if (nextBtn) nextBtn.style.display = 'block';
        if (submitBtn) submitBtn.style.display = 'none';
    } else {
        if (nextBtn) nextBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'block';
    }
}

// دالة رفع جميع الملفات
async function uploadAllFiles() {
    if (!currentApplication) {
        window.authUtils.showToast('خطأ: لم يتم العثور على الطلب', 'error');
        return false;
    }

    const filesToUpload = Object.keys(uploadedFiles);
    if (filesToUpload.length === 0) {
        return true;
    }

    window.authUtils.showToast('جارٍ رفع الملفات...', 'info');
    
    for (const fileName of filesToUpload) {
        const file = uploadedFiles[fileName];
        
        // ضغط الصورة إذا لزم الأمر
        const processedFile = await window.apiUtils.compressImage(file);
        
        const result = await window.apiUtils.getUploadUrl(currentApplication.id, processedFile);
        
        if (!result.success) {
            window.authUtils.showToast(`خطأ في رفع ${file.name}: ${result.error.message}`, 'error');
            return false;
        }
        
        // تحديث حالة الملف في الواجهة
        const fileInfo = document.querySelector(`input[name="${fileName}"]`).parentElement.parentElement.querySelector('.file-info');
        if (fileInfo) {
            fileInfo.innerHTML = `
                <div class="file-uploaded">
                    <span class="file-name">${file.name}</span>
                    <span class="file-status">تم الرفع بنجاح</span>
                </div>
            `;
        }
    }
    
    window.authUtils.showToast('تم رفع جميع الملفات بنجاح', 'success');
    return true;
}

// دالة تحميل البيانات المحفوظة
function loadFormData() {
    if (!currentApplication) return;
    
    const form = document.getElementById('merchant-form');
    if (!form) return;
    
    // تحميل البيانات في النموذج
    Object.keys(currentApplication).forEach(key => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input && currentApplication[key]) {
            if (input.type === 'radio') {
                const radioInput = form.querySelector(`[name="${key}"][value="${currentApplication[key]}"]`);
                if (radioInput) {
                    radioInput.checked = true;
                    // تشغيل حدث التغيير لإظهار الحقول الخاصة
                    radioInput.dispatchEvent(new Event('change'));
                }
            } else {
                input.value = currentApplication[key];
            }
        }
    });
}

// دالة إزالة رسائل الخطأ
function clearErrors() {
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(msg => msg.remove());
    
    const inputs = document.querySelectorAll('.form-group input, .form-group select, .form-group textarea');
    inputs.forEach(input => {
        input.classList.remove('error');
    });
}

// دالة عرض رسالة خطأ لحقل معين
function showFieldError(fieldName, message) {
    const field = document.getElementById(fieldName);
    if (!field) return;
    
    field.classList.add('error');
    
    // إزالة رسالة الخطأ السابقة إن وجدت
    const existingError = field.parentElement.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // إضافة رسالة الخطأ الجديدة
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    field.parentElement.appendChild(errorElement);
}

// دالة التحقق من الاتصال بالإنترنت
function checkConnectionStatus() {
    if (!window.authUtils.checkConnection()) {
        window.authUtils.showToast('لا يوجد اتصال بالإنترنت', 'error');
        return false;
    }
    return true;
}

// دالة حفظ تلقائي دوري
function startAutoSave() {
    setInterval(async () => {
        if (currentApplication && await window.authUtils.getUser()) {
            await saveCurrentStep();
        }
    }, 30000); // حفظ كل 30 ثانية
}

// دالة استرداد البيانات عند الرجوع للصفحة
window.addEventListener('beforeunload', async () => {
    if (currentApplication) {
        await saveCurrentStep();
    }
});

// بدء الحفظ التلقائي عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    startAutoSave();
});

// تصدير الدوال للاستخدام العام
window.appUtils = {
    handleNext,
    handlePrevious,
    handleSubmit,
    validateCurrentStep,
    saveCurrentStep,
    getFormData,
    updateFormStep,
    updateProgressBar,
    loadFormData,
    clearErrors,
    showFieldError,
    checkConnectionStatus
};