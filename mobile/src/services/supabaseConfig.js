import { createClient } from '@supabase/supabase-js';
import Constants from "expo-constants";

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'https://vfegrafhwrpepdcuqnms.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmZWdyYWZod3JwZXBkY3Vxbm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNTUwMzYsImV4cCI6MjA4NDYzMTAzNn0.U1-lTNNkn_UMWY9qzlH7L2sQ5nfI6AdF62UVHqcRZKM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For storage, Supabase has built-in storage
export const storage = supabase.storage;