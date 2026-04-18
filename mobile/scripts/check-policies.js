const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vfegrafhwrpepdcuqnms.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmZWdyYWZod3JwZXBkY3Vxbm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNTUwMzYsImV4cCI6MjA4NDYzMTAzNn0.U1-lTNNkn_UMWY9qzlH7L2sQ5nfI6AdF62UVHqcRZKM';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addDummyRow() {
    try {
        const { data, error } = await supabase
            .from('familymembers')
            .insert({
                name: 'Test',
                relationship: 'Self',
                age: 30,
                gender: 'Nam',
                dietary_preferences: [],
                health_conditions: {},
                user_id: 'c808f237-7e6d-49d7-8356-9bd900da6ddc' // Use a valid UUID format
            })
            .select();
        console.log("Insert Result:", JSON.stringify(data, null, 2));
        console.log("Insert Error:", error);
    } catch (e) {
        console.error(e);
    }
}
addDummyRow();
