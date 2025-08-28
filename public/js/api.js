// دوال إدارة البيانات والـ API

// دالة إنشاء أو تحميل مسودة طلب
async function createOrLoadDraft() {
    try {
        const user = await window.authUtils.getUser();
        if (!user) {
            throw new Error('المستخدم غير مسجل الدخول');
        }

        // البحث عن مسودة موجودة
        const { data: existingDraft, error: fetchError } = await window.authUtils.supabase
            .from('applications')
            .select('*')
            .eq('applicant_id', user.id)
            .eq('status', 'draft')
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError;
        }

        if (existingDraft) {
            return { success: true, data: existingDraft };
        }

        // إنشاء مسودة جديدة
        const { data: newDraft, error: createError } = await window.authUtils.supabase
            .from('applications')
            .insert({
                applicant_id: user.id,
                status: 'draft',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (createError) {
            throw createError;
        }

        return { success: true, data: newDraft };
    } catch (error) {
        console.error('خطأ في إنشاء/تحميل المسودة:', error);
        return { success: false, error };
    }
}

// دالة حفظ خطوة من النموذج
async function saveStep(applicationId, stepData) {
    try {
        const { data, error } = await window.authUtils.supabase
            .from('applications')
            .update(stepData)
            .eq('id', applicationId)
            .eq('status', 'draft')
            .select()
            .single();

        if (error) {
            throw error;
        }

        return { success: true, data };
    } catch (error) {
        console.error('خطأ في حفظ البيانات:', error);
        return { success: false, error };
    }
}

// دالة إرسال الطلب النهائي
async function submitApplication(applicationId) {
    try {
        const user = await window.authUtils.getUser();
        if (!user) {
            throw new Error('المستخدم غير مسجل الدخول');
        }

        // توليد رقم الطلب
        const requestNumber = generateRequestNumber();

        const { data, error } = await window.authUtils.supabase
            .from('applications')
            .update({
                status: 'pending',
                submitted_at: new Date().toISOString(),
                request_number: requestNumber
            })
            .eq('id', applicationId)
            .eq('applicant_id', user.id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return { success: true, data, requestNumber };
    } catch (error) {
        console.error('خطأ في إرسال الطلب:', error);
        return { success: false, error };
    }
}

// دالة توليد رقم الطلب
function generateRequestNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    
    return `LXB-${year}${month}${day}-${random}`;
}

// دالة الحصول على رابط رفع الملف
async function getUploadUrl(applicationId, file) {
    try {
        const user = await window.authUtils.getUser();
        if (!user) {
            throw new Error('المستخدم غير مسجل الدخول');
        }

        // التحقق من نوع وحجم الملف
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('نوع الملف غير مدعوم. يرجى استخدام PDF أو JPG أو PNG');
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            throw new Error('حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت');
        }

        // استدعاء وظيفة الحافة للحصول على رابط الرفع
        const response = await fetch(
            `https://qjsvgpvbtrcnbhcjdcci.supabase.co/functions/v1/get-upload-url`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await window.authUtils.supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({
                    application_id: applicationId,
                    filename: file.name,
                    mime_type: file.type,
                    size: file.size
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'فشل في الحصول على رابط الرفع');
        }

        const result = await response.json();
        
        // رفع الملف إلى التخزين
        const uploadResponse = await fetch(result.upload_url, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type
            },
            body: file
        });

        if (!uploadResponse.ok) {
            throw new Error('فشل في رفع الملف');
        }

        // حفظ معلومات المستند في قاعدة البيانات
        const { data: documentData, error: docError } = await window.authUtils.supabase
            .from('documents')
            .insert({
                application_id: applicationId,
                file_key: result.file_key,
                file_name: file.name,
                mime_type: file.type,
                size_bytes: file.size,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (docError) {
            throw docError;
        }

        return { success: true, data: documentData };
    } catch (error) {
        console.error('خطأ في رفع الملف:', error);
        return { success: false, error };
    }
}

// دالة جلب طلبات التجار للمدراء
async function listApplicationsForAdmin(filters = {}) {
    try {
        const user = await window.authUtils.getUser();
        if (!user || !(await window.authUtils.isAdmin(user))) {
            throw new Error('غير مصرح بالوصول');
        }

        let query = window.authUtils.supabase
            .from('applications')
            .select(`
                *,
                profiles:applicant_id (
                    email,
                    full_name,
                    phone
                )
            `)
            .neq('status', 'draft')
            .order('submitted_at', { ascending: false });

        // تطبيق الفلاتر
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.type) {
            query = query.eq('type', filters.type);
        }
        if (filters.governorate) {
            query = query.eq('governorate', filters.governorate);
        }
        if (filters.dateFrom) {
            query = query.gte('submitted_at', filters.dateFrom);
        }
        if (filters.dateTo) {
            query = query.lte('submitted_at', filters.dateTo);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return { success: true, data };
    } catch (error) {
        console.error('خطأ في جلب الطلبات:', error);
        return { success: false, error };
    }
}

// دالة مراجعة طلب تاجر
async function reviewApplication(applicationId, action, note = '') {
    try {
        const user = await window.authUtils.getUser();
        if (!user || !(await window.authUtils.isAdmin(user))) {
            throw new Error('غير مصرح بالوصول');
        }

        const status = action === 'approve' ? 'approved' : 'rejected';

        const { data, error } = await window.authUtils.supabase
            .from('applications')
            .update({
                status: status,
                reviewed_by: user.email,
                review_note: note,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', applicationId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return { success: true, data };
    } catch (error) {
        console.error('خطأ في مراجعة الطلب:', error);
        return { success: false, error };
    }
}

// دالة الحصول على رابط تنزيل مؤقت للمستندات
async function getDownloadUrl(fileKey) {
    try {
        const user = await window.authUtils.getUser();
        if (!user) {
            throw new Error('المستخدم غير مسجل الدخول');
        }

        const response = await fetch(
            `https://qjsvgpvbtrcnbhcjdcci.supabase.co/functions/v1/get-download-url`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await window.authUtils.supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({
                    file_key: fileKey
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'فشل في الحصول على رابط التنزيل');
        }

        const result = await response.json();
        return { success: true, url: result.download_url };
    } catch (error) {
        console.error('خطأ في الحصول على رابط التنزيل:', error);
        return { success: false, error };
    }
}

// دالة تصدير البيانات إلى CSV
function exportToCSV(applications, filename = 'applications.csv') {
    try {
        const headers = [
            'رقم الطلب',
            'نوع النشاط',
            'اسم النشاط',
            'الاسم المسؤول',
            'البريد الإلكتروني',
            'الهاتف',
            'المحافظة',
            'المدينة',
            'الحالة',
            'تاريخ التقديم',
            'تاريخ المراجعة',
            'المراجع',
            'ملاحظات المراجعة'
        ];

        const csvContent = [
            '\ufeff' + headers.join(','), // BOM for Arabic support
            ...applications.map(app => [
                app.request_number || '',
                translateBusinessType(app.type) || '',
                app.business_name || '',
                app.contact_name || '',
                app.profiles?.email || '',
                app.phone || '',
                app.governorate || '',
                app.city || '',
                translateStatus(app.status) || '',
                formatDate(app.submitted_at) || '',
                formatDate(app.reviewed_at) || '',
                app.reviewed_by || '',
                app.review_note || ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);

        return { success: true };
    } catch (error) {
        console.error('خطأ في تصدير CSV:', error);
        return { success: false, error };
    }
}

// دوال مساعدة للترجمة والتنسيق
function translateBusinessType(type) {
    const types = {
        'pharmacy': 'صيدلية',
        'supermarket': 'سوبرماركت',
        'restaurant': 'مطعم'
    };
    return types[type] || type;
}

function translateStatus(status) {
    const statuses = {
        'draft': 'مسودة',
        'pending': 'قيد المراجعة',
        'approved': 'مقبول',
        'rejected': 'مرفوض'
    };
    return statuses[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// دالة ضغط الصور قبل الرفع (اختيارية)
function compressImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) {
            resolve(file);
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                const compressedFile = new File([blob], file.name, {
                    type: file.type,
                    lastModified: file.lastModified,
                });
                resolve(compressedFile);
            }, file.type, quality);
        };

        img.src = URL.createObjectURL(file);
    });
}

// دالة التحقق من صحة البيانات
function validateApplicationData(data, step) {
    const errors = [];

    switch (step) {
        case 1:
            if (!data.type) {
                errors.push('يرجى اختيار نوع النشاط التجاري');
            }
            break;

        case 2:
            const requiredFields = [
                'business_name', 'crn', 'tax_id', 'contact_name', 
                'national_id', 'phone', 'governorate', 'city', 'address'
            ];
            
            requiredFields.forEach(field => {
                if (!data[field] || !data[field].trim()) {
                    errors.push(`حقل ${getFieldLabel(field)} مطلوب`);
                }
            });

            if (data.phone && !window.authUtils.isValidEgyptianPhone(data.phone)) {
                errors.push('رقم الهاتف غير صحيح');
            }

            if (data.national_id && !window.authUtils.isValidEgyptianNationalId(data.national_id)) {
                errors.push('الرقم القومي غير صحيح');
            }
            break;

        case 3:
            // التحقق من البيانات الخاصة بكل نوع نشاط
            if (data.type === 'pharmacy') {
                // بيانات اختيارية للصيدلية
            } else if (data.type === 'supermarket') {
                // بيانات اختيارية للسوبرماركت
            } else if (data.type === 'restaurant') {
                // بيانات اختيارية للمطعم
            }
            break;

        case 4:
            // التحقق من المستندات المطلوبة
            const requiredDocs = ['crn_document', 'tax_document', 'id_document'];
            // سيتم التحقق من المستندات في الواجهة الأمامية
            break;
    }

    return errors;
}

function getFieldLabel(field) {
    const labels = {
        'business_name': 'اسم النشاط التجاري',
        'crn': 'رقم السجل التجاري',
        'tax_id': 'رقم البطاقة الضريبية',
        'contact_name': 'اسم الشخص المسؤول',
        'national_id': 'الرقم القومي',
        'phone': 'رقم الهاتف',
        'governorate': 'المحافظة',
        'city': 'المدينة',
        'address': 'العنوان التفصيلي'
    };
    return labels[field] || field;
}

// تصدير الدوال للاستخدام العام
window.apiUtils = {
    createOrLoadDraft,
    saveStep,
    submitApplication,
    getUploadUrl,
    listApplicationsForAdmin,
    reviewApplication,
    getDownloadUrl,
    exportToCSV,
    compressImage,
    validateApplicationData,
    translateBusinessType,
    translateStatus,
    formatDate,
    generateRequestNumber
};