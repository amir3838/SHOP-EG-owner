import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface RequestBody {
  application_id: number
  filename: string
  mime_type: string
  size?: number
}

serve(async (req) => {
  // التعامل مع طلبات CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // التحقق من وجود رأس التفويض
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // إنشاء عميل Supabase باستخدام service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // التحقق من صحة التوكن
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // قراءة بيانات الطلب
    const requestBody: RequestBody = await req.json()
    const { application_id, filename, mime_type, size } = requestBody

    // التحقق من البيانات المطلوبة
    if (!application_id || !filename || !mime_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: application_id, filename, mime_type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // التحقق من أن المستخدم يملك الطلب
    const { data: application, error: appError } = await supabaseAdmin
      .from('applications')
      .select('applicant_id, status')
      .eq('id', application_id)
      .eq('applicant_id', user.id)
      .single()

    if (appError || !application) {
      return new Response(
        JSON.stringify({ error: 'Application not found or access denied' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // التحقق من حالة الطلب (يجب أن يكون مسودة)
    if (application.status !== 'draft') {
      return new Response(
        JSON.stringify({ error: 'Cannot upload files to submitted applications' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // التحقق من نوع الملف المسموح
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png'
    ]
    
    if (!allowedTypes.includes(mime_type.toLowerCase())) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid file type. Allowed types: PDF, JPG, PNG',
          allowed_types: allowedTypes 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // التحقق من حجم الملف (10MB كحد أقصى)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (size && size > maxSize) {
      return new Response(
        JSON.stringify({ 
          error: 'File size too large. Maximum size: 10MB',
          max_size_bytes: maxSize 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // تنظيف اسم الملف
    const timestamp = Date.now()
    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const fileExtension = safeFilename.split('.').pop()
    const fileKey = `applications/${application_id}/${timestamp}_${safeFilename}`

    // إنشاء رابط رفع موقّت (صالح لـ 5 دقائق)
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('merchant-documents')
      .createSignedUploadUrl(fileKey, {
        upsert: false
      })

    if (urlError) {
      console.error('Error creating signed URL:', urlError)
      return new Response(
        JSON.stringify({ error: 'Failed to create upload URL' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // إرجاع رابط الرفع ومفتاح الملف
    return new Response(
      JSON.stringify({
        upload_url: signedUrlData.signedUrl,
        file_key: fileKey,
        expires_in: 300, // 5 minutes
        max_file_size: maxSize,
        allowed_types: allowedTypes
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in get-upload-url function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/get-upload-url' \
    --header 'Authorization: Bearer [YOUR_TOKEN]' \
    --header 'Content-Type: application/json' \
    --data '{"application_id": 1, "filename": "document.pdf", "mime_type": "application/pdf", "size": 1024000}'

*/