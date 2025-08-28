-- سياسات الأمان على مستوى الصفوف (Row Level Security)

-- تفعيل RLS على جميع الجداول
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- سياسات جدول ملفات التعريف (profiles)
-- المستخدم يمكنه قراءة وتحديث ملفه التعريفي الخاص
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- المدراء يمكنهم عرض جميع الملفات التعريفية
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.email = auth.jwt() ->> 'email'
        )
    );

-- سياسات جدول المدراء (admins)
-- المدراء فقط يمكنهم قراءة قائمة المدراء
CREATE POLICY "Admins can view admin list" ON public.admins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.email = auth.jwt() ->> 'email'
        )
    );

-- سياسات جدول الطلبات (applications)
-- المستخدمون يمكنهم قراءة طلباتهم الخاصة
CREATE POLICY "Users can view own applications" ON public.applications
    FOR SELECT USING (auth.uid() = applicant_id);

-- المستخدمون يمكنهم إنشاء طلبات جديدة
CREATE POLICY "Users can insert own applications" ON public.applications
    FOR INSERT WITH CHECK (auth.uid() = applicant_id);

-- المستخدمون يمكنهم تحديث طلباتهم المسودة فقط
CREATE POLICY "Users can update own draft applications" ON public.applications
    FOR UPDATE USING (
        auth.uid() = applicant_id AND status = 'draft'
    )
    WITH CHECK (
        auth.uid() = applicant_id AND 
        (status = 'draft' OR status = 'pending') -- يمكن تغيير الحالة من draft إلى pending فقط
    );

-- المستخدمون يمكنهم حذف طلباتهم المسودة فقط
CREATE POLICY "Users can delete own draft applications" ON public.applications
    FOR DELETE USING (
        auth.uid() = applicant_id AND status = 'draft'
    );

-- المدراء يمكنهم عرض جميع الطلبات المرسلة (ليس المسودات)
CREATE POLICY "Admins can view submitted applications" ON public.applications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.email = auth.jwt() ->> 'email'
        ) AND status != 'draft'
    );

-- المدراء يمكنهم تحديث جميع الطلبات (للمراجعة)
CREATE POLICY "Admins can update applications for review" ON public.applications
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.email = auth.jwt() ->> 'email'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.email = auth.jwt() ->> 'email'
        )
    );

-- المدراء يمكنهم حذف الطلبات إذا لزم الأمر
CREATE POLICY "Admins can delete applications" ON public.applications
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.email = auth.jwt() ->> 'email'
        )
    );

-- سياسات جدول المستندات (documents)
-- المستخدمون يمكنهم قراءة مستندات طلباتهم الخاصة
CREATE POLICY "Users can view own application documents" ON public.documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.applications 
            WHERE applications.id = documents.application_id 
            AND applications.applicant_id = auth.uid()
        )
    );

-- المستخدمون يمكنهم إرفاق مستندات لطلباتهم
CREATE POLICY "Users can insert documents for own applications" ON public.documents
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.applications 
            WHERE applications.id = documents.application_id 
            AND applications.applicant_id = auth.uid()
            AND applications.status = 'draft'
        )
    );

-- المستخدمون يمكنهم حذف مستندات طلباتهم المسودة
CREATE POLICY "Users can delete documents from draft applications" ON public.documents
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.applications 
            WHERE applications.id = documents.application_id 
            AND applications.applicant_id = auth.uid()
            AND applications.status = 'draft'
        )
    );

-- المدراء يمكنهم عرض جميع المستندات
CREATE POLICY "Admins can view all documents" ON public.documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.email = auth.jwt() ->> 'email'
        )
    );

-- المدراء يمكنهم إدارة جميع المستندات
CREATE POLICY "Admins can manage all documents" ON public.documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.email = auth.jwt() ->> 'email'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.email = auth.jwt() ->> 'email'
        )
    );

-- دالة مساعدة للتحقق من كون المستخدم مدير
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins 
        WHERE admins.email = auth.jwt() ->> 'email'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة مساعدة للتحقق من ملكية الطلب
CREATE OR REPLACE FUNCTION public.is_application_owner(application_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.applications 
        WHERE applications.id = application_id 
        AND applications.applicant_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- سياسة إضافية لحماية التعديلات غير المصرح بها
CREATE POLICY "Prevent unauthorized status changes" ON public.applications
    FOR UPDATE USING (
        -- المستخدمون يمكنهم فقط تغيير الحالة من draft إلى pending
        CASE 
            WHEN auth.uid() = applicant_id THEN 
                (OLD.status = 'draft' AND NEW.status IN ('draft', 'pending'))
            WHEN EXISTS (SELECT 1 FROM public.admins WHERE admins.email = auth.jwt() ->> 'email') THEN 
                true
            ELSE 
                false
        END
    );

-- منع المستخدمين العاديين من الوصول لجدول المدراء
CREATE POLICY "Block regular users from admins table" ON public.admins
    FOR ALL USING (false);

-- السماح للمدراء بالوصول الكامل لجدول المدراء  
CREATE POLICY "Allow admin access to admins table" ON public.admins
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.email = auth.jwt() ->> 'email'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE admins.email = auth.jwt() ->> 'email'
        )
    );

-- تحديث سياسة حماية للتأكد من عدم تعديل البيانات الحساسة
ALTER POLICY "Users can update own draft applications" ON public.applications RENAME TO "Users can update own draft applications old";

CREATE POLICY "Users can update own draft applications" ON public.applications
    FOR UPDATE USING (
        auth.uid() = applicant_id AND status = 'draft'
    )
    WITH CHECK (
        auth.uid() = applicant_id AND 
        (NEW.status = 'draft' OR NEW.status = 'pending') AND
        -- منع تعديل معرف المتقدم
        NEW.applicant_id = OLD.applicant_id AND
        -- منع تعديل أوقات المراجعة والمراجع
        NEW.reviewed_at IS NOT DISTINCT FROM OLD.reviewed_at AND
        NEW.reviewed_by IS NOT DISTINCT FROM OLD.reviewed_by AND
        NEW.review_note IS NOT DISTINCT FROM OLD.review_note
    );

-- حذف السياسة القديمة
DROP POLICY "Users can update own draft applications old" ON public.applications;