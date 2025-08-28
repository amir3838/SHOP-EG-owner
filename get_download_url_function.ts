import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface RequestBody {
  file_key: string
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
    const { file_key } = requestBody

    // التحقق من البيانات المطلوبة
    if (!file_key) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: file_key' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // البحث عن المستند في قاعدة البيانات
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select(`
        *,
        applications!inner (
          applicant_id,
          status
        )
      `)
      .eq('file_key', file_key)
      .single()

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // التحقق من صلاحيات الوصول
    let hasAccess = false

    // التحقق من كون المستخدم مالك الطلب
    if (document.applications.applicant_id === user.id) {
      hasAccess = true
    }

    // التحقق من كون المستخدم مدير
    if (!hasAccess) {
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('admins')
        .select('email')
        .eq('email', user.email)
        .single()

      if (!adminError && adminData) {
        hasAccess = true
      }
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied. You do not have permission to access this document.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // إنشاء رابط تحميل موقّت (صالح لـ 10 دقائق)
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('merchant-documents')
      .createSignedUrl(file_key, 600) // 10 minutes

    if (urlError) {
      console.error('Error creating signed download URL:', urlError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create download URL',
          details: urlError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // إرجاع رابط التحميل ومعلومات الملف
    return new Response(
      JSON.stringify({
        download_url: signedUrlData.signedUrl,
        file_name: document.file_name,
        mime_type: document.mime_type,
        size_bytes: document.size_bytes,
        expires_in: 600, // 10 minutes
        created_at: document.created_at
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in get-download-url function:', error)
    
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/get-download-url' \
    --header 'Authorization: Bearer [YOUR_TOKEN]' \
    --header 'Content-Type: application/json' \
    --data '{"file_key": "applications/1/1640995200000_document.pdf"}'

*/