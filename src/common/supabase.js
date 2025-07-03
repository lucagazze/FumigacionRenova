// /src/common/supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://tkwdlctneqlyzkystcxw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrd2RsY3RuZXFseXpreXN0Y3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0OTAwOTksImV4cCI6MjA2NzA2NjA5OX0.ZY4YyEuEiQ79lyv_Pc5cyZYFVsWVy4HwPS9pzlmpWtI';

export const supabase = createClient(supabaseUrl, supabaseKey);