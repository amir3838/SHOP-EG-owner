-- مخطط قاعدة البيانات لبوابة تسجيل التجار

-- إنشاء أنواع البيانات المخصصة
CREATE TYPE business_type AS ENUM ('pharmacy', 'supermarket', 'restaurant');
CREATE TYPE application_status AS ENUM ('draft', 'pending', 'approved', 'rejected');

-- جدول ملفات التعريف للمستخدمين
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول المدراء
CREATE TABLE IF NOT EXISTS public.admins (
    email VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول طلبات التجار
CREATE TABLE IF NOT EXISTS public.applications (
    id BIGSERIAL PRIMARY KEY,
    applicant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- نوع النشاط والحالة
    type business_type,
    status application_status DEFAULT 'draft' NOT NULL,
    
    -- البيانات العامة
    business_name VARCHAR(255),
    crn VARCHAR(100), -- رقم السجل التجاري
    tax_id VARCHAR(100), -- رقم البطاقة الضريبية
    contact_name VARCHAR(255),
    national_id VARCHAR(14), -- الرقم القومي المصري
    phone VARCHAR(20),
    
    -- العنوان
    governorate VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    
    -- بيانات خاصة بالصيدليات
    pharmacy_license VARCHAR(100),
    pharmacist_name VARCHAR(255),
    pharmacy_hours VARCHAR(255),
    
    -- بيانات خاصة بالسوبرماركت
    store_area INTEGER, -- المساحة بالمتر المربع
    store_type VARCHAR(50), -- independent أو chain
    supermarket_hours VARCHAR(255),
    
    -- بيانات خاصة بالمطاعم
    cuisine_type VARCHAR(50),
    health_grade VARCHAR(10), -- A, B, C
    restaurant_hours VARCHAR(255),
    
    -- معلومات المراجعة
    request_number VARCHAR(50) UNIQUE,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(255),
    review_note TEXT,
    
    -- التوقيتات
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول المستندات
CREATE TABLE IF NOT EXISTS public.documents (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
    file_key VARCHAR(500) NOT NULL, -- مفتاح الملف في التخزين
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء الفهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON public.applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_type ON public.applications(type);
CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON public.applications(submitted_at);
CREATE INDEX IF NOT EXISTS idx_applications_request_number ON public.applications(request_number);
CREATE INDEX IF NOT EXISTS idx_documents_application_id ON public.documents(application_id);

-- إنشاء دوال التحديث التلقائي للتوقيت
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إضافة محفزات التحديث التلقائي
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_applications
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- دالة توليد رقم الطلب التلقائي
CREATE OR REPLACE FUNCTION public.generate_request_number()
RETURNS TRIGGER AS $$
DECLARE
    date_part TEXT;
    random_part TEXT;
    new_request_number TEXT;
BEGIN
    -- إذا كان رقم الطلب موجود بالفعل، لا نغيره
    IF NEW.request_number IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- توليد رقم الطلب فقط عند تغيير الحالة إلى pending
    IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status != 'pending') THEN
        -- تنسيق التاريخ YYYYMMDD
        date_part := TO_CHAR(NOW(), 'YYYYMMDD');
        
        -- توليد رقم عشوائي من 6 أرقام
        random_part := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        
        -- تكوين رقم الطلب النهائي
        new_request_number := 'LXB-' || date_part || '-' || random_part;
        
        -- التأكد من عدم وجود رقم مكرر
        WHILE EXISTS (SELECT 1 FROM public.applications WHERE request_number = new_request_number) LOOP
            random_part := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
            new_request_number := 'LXB-' || date_part || '-' || random_part;
        END LOOP;
        
        NEW.request_number := new_request_number;
        NEW.submitted_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- محفز توليد رقم الطلب
CREATE TRIGGER generate_request_number_trigger
    BEFORE INSERT OR UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_request_number();

-- إدراج بيانات المدراء الأولية
INSERT INTO public.admins (email) VALUES 
('admin@luxbyte.com')
ON CONFLICT (email) DO NOTHING;

-- دالة مساعدة لإنشاء ملف التعريف تلقائياً
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- محفز إنشاء ملف التعريف عند تسجيل مستخدم جديد
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- منح الصلاحيات المناسبة
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;