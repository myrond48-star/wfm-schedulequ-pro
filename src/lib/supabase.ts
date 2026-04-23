export const getDbCredentials = () => {
  // Priority 1: Check actual Vite environment variables (baked in at build time)
  // Priority 2: Check Local Storage (set by user or previous sessions)
  
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || '';
  const key = import.meta.env.VITE_SUPABASE_KEY || localStorage.getItem('SUPABASE_KEY') || '';
  
  const cleanedUrl = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  
  return { url: cleanedUrl, key };
};

export const callSupabaseAPI = async (tableName: string, method: string, payload?: any, queryStr = '') => {
  const { url, key } = getDbCredentials();
  
  if (!url || !key) {
    throw new Error("Database API not configured! Please provide URL and Key in System Settings.");
  }

  const headers: Record<string, string> = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  if (method.toLowerCase() === 'post') {
    headers['Prefer'] = 'return=minimal';
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (payload) {
    options.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  }

  const response = await fetch(`${url}/rest/v1/${tableName}${queryStr}`, options);
  
  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 404 && method.toUpperCase() === 'GET') {
      return [];
    }
    throw new Error(`Supabase API Error (${response.status}): ${errText}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};
