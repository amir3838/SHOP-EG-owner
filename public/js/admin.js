// متغيرات عامة للوحة الإدارة
let allApplications = [];
let filteredApplications = [];
let currentApplication = null;

// تهيئة لوحة الإدارة
document.addEventListener('DOMContentLoaded', async () => {
    await initializeAdminPanel();
    setupEventListeners();
    await loadApplications();
});

// دالة تهيئة لوحة الإدارة
async function initializeAdminPanel() {
    // التحقق من تسجيل الدخول
    const user = await window.authUtils.getUser();
    if (!user) {
        window.authUtils.showToast('يجب تسجيل الدخول أولاً', 'error');
        window.location.href = '/';
        return;
    }

    // التحقق من صلاحيات الإدارة
    const isAdmin = await window.authUtils.isAdmin(user);
    if (!isAdmin) {
        window.authUtils.showToast('غير مصرح لك بالوصول لهذه الصفحة', 'error');
        window.location.href = '/';
        return;
    }

    // عرض معلومات المدير
    const adminInfo = document.getElementById('admin-info');
    if (adminInfo) {
        adminInfo.textContent = user.email;
    }
}

// دالة إعداد مستمعي الأحداث
function setupEventListeners() {
    // أزرار التنقل
    const themeToggle = document.getElementById('theme-toggle');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await window.authUtils.signOut();
            window.location.href = '/';
        });
    }

    // فلاتر البحث
    const applyFiltersBtn = document.getElementById('apply-filters');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const exportCsvBtn = document.getElementById('export-csv');
    const refreshBtn = document.getElementById('refresh-data');

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadApplications(true);
        });
    }

    // مودال تفاصيل الطلب
    setupModalEventListeners();
}

// دالة إعداد مستمعي أحداث المودال
function setupModalEventListeners() {
    const applicationModal = document.getElementById('application-modal');
    const rejectModal = document.getElementById('reject-modal');
    
    // إغلاق المودالات
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('show');
        });
    });

    // إغلاق عند النقر خارج المودال
    [applicationModal, rejectModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        }
    });

    // أزرار الإجراءات في مودال التفاصيل
    const approveBtn = document.getElementById('approve-btn');
    const rejectBtn = document.getElementById('reject-btn');

    if (approveBtn) {
        approveBtn.addEventListener('click', () => {
            handleApplicationAction('approve');
        });
    }

    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => {
            showRejectModal();
        });
    }

    // نموذج رفض الطلب
    const rejectForm = document.getElementById('reject-form');
    if (rejectForm) {
        rejectForm.addEventListener('submit', handleRejectSubmit);
    }
}

// دالة تحميل الطلبات
async function loadApplications(showLoading = false) {
    const loadingIndicator = document.getElementById('loading-indicator');
    const tableWrapper = document.querySelector('.table-wrapper');
    const noDataMessage = document.getElementById('no-data-message');

    if (showLoading && loadingIndicator) {
        loadingIndicator.style.display = 'flex';
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (noDataMessage) noDataMessage.style.display = 'none';
    }

    try {
        const result = await window.apiUtils.listApplicationsForAdmin();
        
        if (result.success) {
            allApplications = result.data;
            filteredApplications = [...allApplications];
            updateStatistics();
            renderApplicationsTable();
        } else {
            window.authUtils.showToast('خطأ في تحميل الطلبات: ' + result.error.message, 'error');
        }
    } catch (error) {
        console.error('خطأ في تحميل الطلبات:', error);
        window.authUtils.showToast('حدث خطأ في تحميل البيانات', 'error');
    } finally {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// دالة تحديث الإحصائيات
function updateStatistics() {
    const totalElement = document.getElementById('total-applications');
    const pendingElement = document.getElementById('pending-applications');
    const approvedElement = document.getElementById('approved-applications');
    const rejectedElement = document.getElementById('rejected-applications');

    const stats = {
        total: allApplications.length,
        pending: allApplications.filter(app => app.status === 'pending').length,
        approved: allApplications.filter(app => app.status === 'approved').length,
        rejected: allApplications.filter(app => app.status === 'rejected').length
    };

    if (totalElement) totalElement.textContent = stats.total;
    if (pendingElement) pendingElement.textContent = stats.pending;
    if (approvedElement) approvedElement.textContent = stats.approved;
    if (rejectedElement) rejectedElement.textContent = stats.rejected;
}

// دالة عرض جدول الطلبات
function renderApplicationsTable() {
    const tbody = document.getElementById('applications-tbody');
    const tableWrapper = document.querySelector('.table-wrapper');
    const noDataMessage = document.getElementById('no-data-message');

    if (!tbody) return;

    if (filteredApplications.length === 0) {
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (noDataMessage) noDataMessage.style.display = 'flex';
        return;
    }

    if (tableWrapper) tableWrapper.style.display = 'block';
    if (noDataMessage) noDataMessage.style.display = 'none';

    tbody.innerHTML = filteredApplications.map(app => `
        <tr>
            <td>${app.request_number || '---'}</td>
            <td>${window.apiUtils.translateBusinessType(app.type) || '---'}</td>
            <td>${app.business_name || '---'}</td>
            <td>${app.contact_name || '---'}</td>
            <td>${app.governorate || '---'}</td>
            <td>
                <span class="status-badge ${app.status}">
                    ${window.apiUtils.translateStatus(app.status)}
                </span>
            </td>
            <td>${window.apiUtils.formatDate(app.submitted_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-view" onclick="viewApplication(${app.id})">
                        عرض التفاصيل
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// دالة عرض تفاصيل الطلب
async function viewApplication(applicationId) {
    const application = allApplications.find(app => app.id === applicationId);
    if (!application) {
        window.authUtils.showToast('لم يتم العثور على الطلب', 'error');
        return;
    }

    currentApplication = application;
    
    // تحميل المستندات
    const documentsResult = await loadApplicationDocuments(applicationId);
    
    // عرض التفاصيل في المودال
    displayApplicationDetails(application, documentsResult.data || []);
    
    // إظهار المودال
    const modal = document.getElementById('application-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

// دالة تحميل مستندات الطلب
async function loadApplicationDocuments(applicationId) {
    try {
        const { data, error } = await window.authUtils.supabase
            .from('documents')
            .select('*')
            .eq('application_id', applicationId);

        if (error) {
            throw error;
        }

        return { success: true, data };
    } catch (error) {
        console.error('خطأ في تحميل المستندات:', error);
        return { success: false, error, data: [] };
    }
}

// دالة عرض تفاصيل الطلب في المودال
function displayApplicationDetails(application, documents) {
    const detailsContainer = document.getElementById('application-details');
    const modalTitle = document.getElementById('modal-title');

    if (modalTitle) {
        modalTitle.textContent = `تفاصيل الطلب - ${application.request_number || 'غير محدد'}`;
    }

    if (!detailsContainer) return;

    detailsContainer.innerHTML = `
        <div class="detail-section">
            <h4>البيانات الأساسية</h4>
            <div class="detail-item">
                <span class="detail-label">رقم الطلب:</span>
                <span class="detail-value">${application.request_number || '---'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">نوع النشاط:</span>
                <span class="detail-value">${window.apiUtils.translateBusinessType(application.type)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">اسم النشاط:</span>
                <span class="detail-value">${application.business_name || '---'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">السجل التجاري:</span>
                <span class="detail-value">${application.crn || '---'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">الرقم الضريبي:</span>
                <span class="detail-value">${application.tax_id || '---'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">الحالة:</span>
                <span class="detail-value">
                    <span class="status-badge ${application.status}">
                        ${window.apiUtils.translateStatus(application.status)}
                    </span>
                </span>
            </div>
        </div>

        <div class="detail-section">
            <h4>بيانات المسؤول</h4>
            <div class="detail-item">
                <span class="detail-label">الاسم:</span>
                <span class="detail-value">${application.contact_name || '---'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">البريد الإلكتروني:</span>
                <span class="detail-value">${application.profiles?.email || '---'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">الهاتف:</span>
                <span class="detail-value">${application.phone || '---'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">الرقم القومي:</span>
                <span class="detail-value">${application.national_id || '---'}</span>
            </div>
        </div>

        <div class="detail-section">
            <h4>العنوان</h4>
            <div class="detail-item">
                <span class="detail-label">المحافظة:</span>
                <span class="detail-value">${application.governorate || '---'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">المدينة:</span>
                <span class="detail-value">${application.city || '---'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">العنوان التفصيلي:</span>
                <span class="detail-value">${application.address || '---'}</span>
            </div>
        </div>

        ${generateSpecialtyFields(application)}

        <div class="detail-section documents-section">
            <h4>المستندات المرفقة</h4>
            <div class="documents-grid">
                ${documents.map(doc => `
                    <div class="document-item">
                        <h5>${doc.file_name}</h5>
                        <button class="btn btn-primary" onclick="downloadDocument('${doc.file_key}')">
                            تحميل المستند
                        </button>
                    </div>
                `).join('')}
            </div>
            ${documents.length === 0 ? '<p style="text-align: center; color: var(--text-secondary);">لا توجد مستندات مرفقة</p>' : ''}
        </div>

        ${application.review_note ? `
            <div class="detail-section">
                <h4>ملاحظات المراجعة</h4>
                <div class="detail-item">
                    <span class="detail-label">المراجع:</span>
                    <span class="detail-value">${application.reviewed_by || '---'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">تاريخ المراجعة:</span>
                    <span class="detail-value">${window.apiUtils.formatDate(application.reviewed_at)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">الملاحظة:</span>
                    <span class="detail-value">${application.review_note}</span>
                </div>
            </div>
        ` : ''}
    `;

    // إخفاء أزرار الإجراءات إذا تمت مراجعة الطلب
    const actionButtons = document.querySelector('.application-actions');
    if (actionButtons) {
        actionButtons.style.display = application.status === 'pending' ? 'flex' : 'none';
    }
}

// دالة توليد الحقول الخاصة بكل نوع نشاط
function generateSpecialtyFields(application) {
    if (application.type === 'pharmacy') {
        return `
            <div class="detail-section">
                <h4>بيانات الصيدلية</h4>
                <div class="detail-item">
                    <span class="detail-label">رقم الترخيص:</span>
                    <span class="detail-value">${application.pharmacy_license || '---'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">الصيدلي المسؤول:</span>
                    <span class="detail-value">${application.pharmacist_name || '---'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">مواعيد العمل:</span>
                    <span class="detail-value">${application.pharmacy_hours || '---'}</span>
                </div>
            </div>
        `;
    } else if (application.type === 'supermarket') {
        return `
            <div class="detail-section">
                <h4>بيانات السوبرماركت</h4>
                <div class="detail-item">
                    <span class="detail-label">المساحة:</span>
                    <span class="detail-value">${application.store_area ? application.store_area + ' متر مربع' : '---'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">نوع المتجر:</span>
                    <span class="detail-value">${application.store_type === 'independent' ? 'مستقل' : application.store_type === 'chain' ? 'جزء من سلسلة' : '---'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">مواعيد العمل:</span>
                    <span class="detail-value">${application.supermarket_hours || '---'}</span>
                </div>
            </div>
        `;
    } else if (application.type === 'restaurant') {
        return `
            <div class="detail-section">
                <h4>بيانات المطعم</h4>
                <div class="detail-item">
                    <span class="detail-label">نوع المطبخ:</span>
                    <span class="detail-value">${translateCuisineType(application.cuisine_type) || '---'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">درجة التجهيز الصحي:</span>
                    <span class="detail-value">${application.health_grade || '---'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">مواعيد العمل:</span>
                    <span class="detail-value">${application.restaurant_hours || '---'}</span>
                </div>
            </div>
        `;
    }
    return '';
}

// دالة ترجمة نوع المطبخ
function translateCuisineType(type) {
    const types = {
        'egyptian': 'مصري',
        'oriental': 'شرقي',
        'western': 'غربي',
        'seafood': 'مأكولات بحرية',
        'fast-food': 'وجبات سريعة',
        'mixed': 'متنوع'
    };
    return types[type] || type;
}

// دالة تحميل المستند
async function downloadDocument(fileKey) {
    try {
        const result = await window.apiUtils.getDownloadUrl(fileKey);
        
        if (result.success) {
            // فتح الملف في تبويب جديد
            window.open(result.url, '_blank');
        } else {
            window.authUtils.showToast('خطأ في تحميل المستند: ' + result.error.message, 'error');
        }
    } catch (error) {
        console.error('خطأ في تحميل المستند:', error);
        window.authUtils.showToast('حدث خطأ في تحميل المستند', 'error');
    }
}

// دالة التعامل مع إجراءات الطلب
async function handleApplicationAction(action) {
    if (!currentApplication) {
        window.authUtils.showToast('لا يوجد طلب محدد', 'error');
        return;
    }

    if (action === 'approve') {
        const confirmed = confirm('هل أنت متأكد من قبول هذا الطلب؟');
        if (!confirmed) return;

        const result = await window.apiUtils.reviewApplication(currentApplication.id, 'approve');
        
        if (result.success) {
            window.authUtils.showToast('تم قبول الطلب بنجاح', 'success');
            await loadApplications();
            document.getElementById('application-modal').classList.remove('show');
        } else {
            window.authUtils.showToast('خطأ في قبول الطلب: ' + result.error.message, 'error');
        }
    }
}

// دالة إظهار مودال الرفض
function showRejectModal() {
    const modal = document.getElementById('reject-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

// دالة إخفاء مودال الرفض
function hideRejectModal() {
    const modal = document.getElementById('reject-modal');
    if (modal) {
        modal.classList.remove('show');
    }
    
    // مسح النموذج
    const form = document.getElementById('reject-form');
    if (form) {
        form.reset();
    }
}

// دالة التعامل مع إرسال نموذج الرفض
async function handleRejectSubmit(e) {
    e.preventDefault();
    
    if (!currentApplication) {
        window.authUtils.showToast('لا يوجد طلب محدد', 'error');
        return;
    }

    const formData = new FormData(e.target);
    const reason = formData.get('reject_reason');

    if (!reason || !reason.trim()) {
        window.authUtils.showToast('يرجى إدخال سبب الرفض', 'error');
        return;
    }

    const result = await window.apiUtils.reviewApplication(currentApplication.id, 'reject', reason.trim());
    
    if (result.success) {
        window.authUtils.showToast('تم رفض الطلب بنجاح', 'success');
        await loadApplications();
        hideRejectModal();
        document.getElementById('application-modal').classList.remove('show');
    } else {
        window.authUtils.showToast('خطأ في رفض الطلب: ' + result.error.message, 'error');
    }
}

// دالة تطبيق الفلاتر
function applyFilters() {
    const statusFilter = document.getElementById('status-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    const governorateFilter = document.getElementById('governorate-filter').value;
    const dateFromFilter = document.getElementById('date-from').value;
    const dateToFilter = document.getElementById('date-to').value;

    filteredApplications = allApplications.filter(app => {
        // فلتر الحالة
        if (statusFilter && app.status !== statusFilter) return false;
        
        // فلتر نوع النشاط
        if (typeFilter && app.type !== typeFilter) return false;
        
        // فلتر المحافظة
        if (governorateFilter && app.governorate !== governorateFilter) return false;
        
        // فلتر التاريخ من
        if (dateFromFilter) {
            const appDate = new Date(app.submitted_at);
            const fromDate = new Date(dateFromFilter);
            if (appDate < fromDate) return false;
        }
        
        // فلتر التاريخ إلى
        if (dateToFilter) {
            const appDate = new Date(app.submitted_at);
            const toDate = new Date(dateToFilter);
            toDate.setHours(23, 59, 59, 999); // نهاية اليوم
            if (appDate > toDate) return false;
        }
        
        return true;
    });

    renderApplicationsTable();
    window.authUtils.showToast(`تم العثور على ${filteredApplications.length} طلب`, 'info');
}

// دالة مسح الفلاتر
function clearFilters() {
    document.getElementById('status-filter').value = '';
    document.getElementById('type-filter').value = '';
    document.getElementById('governorate-filter').value = '';
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    
    filteredApplications = [...allApplications];
    renderApplicationsTable();
    window.authUtils.showToast('تم مسح جميع الفلاتر', 'info');
}

// دالة تصدير البيانات إلى CSV
function exportToCSV() {
    if (filteredApplications.length === 0) {
        window.authUtils.showToast('لا توجد بيانات للتصدير', 'warning');
        return;
    }

    const result = window.apiUtils.exportToCSV(
        filteredApplications, 
        `applications_${new Date().toISOString().split('T')[0]}.csv`
    );

    if (result.success) {
        window.authUtils.showToast(`تم تصدير ${filteredApplications.length} طلب بنجاح`, 'success');
    } else {
        window.authUtils.showToast('خطأ في تصدير البيانات', 'error');
    }
}

// دوال مساعدة للتفاعل مع العناصر
window.viewApplication = viewApplication;
window.downloadDocument = downloadDocument;
window.hideRejectModal = hideRejectModal;

// تحميل الوضع المحفوظ
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);