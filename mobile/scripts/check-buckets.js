const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vfegrafhwrpepdcuqnms.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmZWdyYWZod3JwZXBkY3Vxbm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNTUwMzYsImV4cCI6MjA4NDYzMTAzNn0.U1-lTNNkn_UMWY9qzlH7L2sQ5nfI6AdF62UVHqcRZKM';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function initBuckets() {
    const buckets = ['avatars', 'medical_records']; // buckets used in familyMemberService
    for (const bucket of buckets) {
        console.log(`Creating bucket: ${bucket}`);
        const { data, error } = await supabase.storage.createBucket(bucket, {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
            fileSizeLimit: 10485760
        });
        if (error) {
            console.error(`Error creating ${bucket}:`, error);
        } else {
            console.log(`Successfully created ${bucket}:`, data);
        }
    }
}

initBuckets();
